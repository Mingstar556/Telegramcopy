import os
import time
import secrets
import logging
from collections import defaultdict
from django.utils import timezone
from django.conf import settings
from django.db import OperationalError, IntegrityError
from django.db.models import Q
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import EmployeeAccount, DeviceSession, BotAccount, TelegramUser, ChatMessage
from .serializers import format_message_dict, format_user_dict
from .bot_service import TelegramBotGateway

logger = logging.getLogger(__name__)

# Blue Team Defense: In-memory sliding rate limiter for authentication
_LOGIN_ATTEMPTS = defaultdict(list)
_MAX_LOGIN_ATTEMPTS = 15
_LOGIN_WINDOW_SEC = 60

ALLOWED_UPLOAD_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.webm', '.mp3', '.ogg', '.wav', '.mp4',
    '.pdf', '.txt', '.doc', '.docx'
}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    valid_attempts = [t for t in _LOGIN_ATTEMPTS[ip] if now - t < _LOGIN_WINDOW_SEC]
    _LOGIN_ATTEMPTS[ip] = valid_attempts
    return len(valid_attempts) >= _MAX_LOGIN_ATTEMPTS


def _record_failed_attempt(ip: str):
    _LOGIN_ATTEMPTS[ip].append(time.time())


def _clear_attempts(ip: str):
    _LOGIN_ATTEMPTS.pop(ip, None)


def _verify_and_upgrade_password(account, input_pass: str) -> bool:
    if not account or not input_pass:
        return False
    if account.password.startswith(('pbkdf2_', 'argon2', 'bcrypt')):
        return check_password(input_pass, account.password)
    if account.password == input_pass:
        account.password = make_password(input_pass)
        account.save(update_fields=['password'])
        return True
    return False



@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check for React client and live database connectivity."""
    db_connected = False
    bots_count = 0
    db_error = None
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        bots_count = BotAccount.objects.count()
        db_connected = True
    except Exception as e:
        logger.error(f"Health check DB probe failed: {e}")
        db_error = str(e)

    if not db_connected:
        return Response({
            "status": "error",
            "database": "disconnected",
            "error": db_error or "Database inaccessible",
            "timestamp": timezone.now().isoformat()
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response({
        "status": "ok",
        "database": "connected",
        "bots_configured": bots_count,
        "service": "django_telegram_bridge",
        "timestamp": timezone.now().isoformat()
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Operator login matching frontend schema and supporting multi-device sessions:
    Body: {"User-ID": "1234", "password": "...", "device_name": "...", "device_type": "..."}
    """
    user_id = request.data.get('User-ID') or request.data.get('userId') or request.data.get('user_id')
    password = request.data.get('password')
    device_name = request.data.get('device_name')
    device_type = request.data.get('device_type', 'desktop')

    if not user_id or not password:
        return Response({'detail': 'User-ID and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    user_id_str = str(user_id).strip()
    password_str = str(password)

    # 1. Extract Network & Device Metadata
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip_address = x_forwarded_for.split(',')[0].strip()
    else:
        ip_address = request.META.get('REMOTE_ADDR', '127.0.0.1')

    if _is_rate_limited(ip_address):
        logger.warning(f"[Login View] Rate limit exceeded for IP: {ip_address}")
        return Response({'detail': 'Too many login attempts. Please wait 1 minute.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    # 2. Authenticate against EmployeeAccount
    employee = EmployeeAccount.objects.filter(user_id=user_id_str).first()
    bot_account = BotAccount.objects.filter(user_id=user_id_str).first()

    if employee:
        if not _verify_and_upgrade_password(employee, password_str):
            _record_failed_attempt(ip_address)
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        if not employee.is_active:
            return Response({'detail': 'Account is inactive'}, status=status.HTTP_403_FORBIDDEN)
        # Ensure linkage if bot_account exists
        if bot_account and not bot_account.employee:
            bot_account.employee = employee
            bot_account.save(update_fields=['employee'])
    elif bot_account:
        # Fallback to BotAccount and auto-create EmployeeAccount
        if not _verify_and_upgrade_password(bot_account, password_str):
            _record_failed_attempt(ip_address)
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        employee = EmployeeAccount.objects.create(
            user_id=bot_account.user_id,
            username=bot_account.bot_name or "Operator",
            password=make_password(password_str),
            avatar=bot_account.avatar or "",
            role="operator",
            is_active=True
        )
        bot_account.employee = employee
        bot_account.save(update_fields=['employee'])
    else:
        _record_failed_attempt(ip_address)
        return Response({'detail': 'Operator account not found'}, status=status.HTTP_401_UNAUTHORIZED)

    _clear_attempts(ip_address)

    if not device_name:
        ua_lower = user_agent.lower()
        if 'mobile' in ua_lower or 'android' in ua_lower or 'iphone' in ua_lower:
            device_name = "Mobile Device"
            if device_type == 'desktop':
                device_type = 'mobile'
        elif 'ipad' in ua_lower or 'tablet' in ua_lower:
            device_name = "Tablet Device"
            if device_type == 'desktop':
                device_type = 'tablet'
        else:
            device_name = "Web Browser"

    if device_type not in ['desktop', 'mobile', 'tablet']:
        device_type = 'desktop'

    # 3. Create independent DeviceSession
    session = DeviceSession.create_session(
        employee=employee,
        device_name=device_name,
        device_type=device_type,
        user_agent=user_agent,
        ip_address=ip_address
    )

    # Auto-fetch conversations upon login
    try:
        TelegramBotGateway.sync_bot_conversations(operator_id=employee.user_id)
    except Exception as e:
        logger.warning(f"[Login View] Background auto-sync failed gracefully: {e}")

    # 4. Resolve Bot Metadata
    bot = bot_account or (employee.bot_accounts.first() if hasattr(employee, 'bot_accounts') else None)

    return Response({
        "status": "success",
        "User-ID": employee.user_id,
        "token": session.session_token,
        "session_id": session.id,
        "employee_name": employee.username,
        "bot_name": bot.bot_name if bot else "Customer Service Bot",
        "bot_username": bot.bot_username if bot else "cs_support_bot",
        "avatar": employee.avatar or (bot.avatar if bot else "") or "",
        "description": bot.description if bot else "Customer service operator account",
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    """
    Logout specific device session:
    Accepts session_token in body or Authorization header (Bearer ...).
    Deactivates ONLY that DeviceSession.
    """
    session_token = request.data.get('session_token') or request.data.get('token')
    if not session_token:
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            session_token = auth_header.split(' ', 1)[1].strip()

    if not session_token:
        return Response({'detail': 'session_token is required'}, status=status.HTTP_400_BAD_REQUEST)

    session = DeviceSession.objects.filter(session_token=session_token).first()
    if not session:
        return Response({'detail': 'Session not found', 'status': 'not_found'}, status=status.HTTP_404_NOT_FOUND)

    session.revoke()
    return Response({
        "status": "logged_out",
        "revoked_session": session_token
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def active_sessions_view(request):
    """
    List active device sessions for the authenticated employee.
    Accepts:
    - User-ID header or query param
    - or session token in header / query param
    """
    current_token = (
        request.query_params.get('token') or
        request.query_params.get('session_token') or
        request.headers.get('token')
    )
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not current_token and auth_header.startswith('Bearer '):
        current_token = auth_header.split(' ', 1)[1].strip()

    requested_user_id = (
        request.query_params.get('User-ID') or
        request.query_params.get('userId') or
        request.query_params.get('user_id') or
        request.META.get('HTTP_USER_ID')
    )

    employee = None
    if current_token:
        sess = DeviceSession.objects.filter(session_token=current_token, is_active=True).select_related('employee').first()
        if not sess or not sess.employee or not sess.employee.is_active:
            return Response({'detail': 'Invalid or expired session token'}, status=status.HTTP_401_UNAUTHORIZED)
        employee = sess.employee
        if requested_user_id and str(requested_user_id).strip() != employee.user_id:
            return Response({'detail': 'Forbidden: session does not belong to requested user'}, status=status.HTTP_401_UNAUTHORIZED)
        sess.last_activity = timezone.now()
        sess.save(update_fields=['last_activity'])
    elif requested_user_id:
        employee = EmployeeAccount.objects.filter(user_id=str(requested_user_id).strip(), is_active=True).first()
        if not employee:
            return Response({'detail': 'Invalid or unknown User-ID'}, status=status.HTTP_401_UNAUTHORIZED)
    else:
        return Response({'detail': 'Authentication session token or User-ID required'}, status=status.HTTP_401_UNAUTHORIZED)

    sessions = employee.sessions.filter(is_active=True).order_by('-last_activity')
    data = []
    for s in sessions:
        data.append({
            "session_id": s.id,
            "device_name": s.device_name,
            "device_type": s.device_type,
            "ip_address": s.ip_address,
            "last_activity": s.last_activity.isoformat() if s.last_activity else None,
            "is_current": (s.session_token == current_token) if current_token else False,
        })

    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def user_profile(request):
    """Fetch profile of current operator bot session."""
    user_id = request.query_params.get('User-ID') or request.query_params.get('userId') or request.query_params.get('user_id')
    if not user_id:
        return Response({'detail': 'User-ID is required'}, status=status.HTTP_400_BAD_REQUEST)

    user_id_str = str(user_id).strip()
    bot = BotAccount.objects.filter(user_id=user_id_str).first()
    emp = EmployeeAccount.objects.filter(user_id=user_id_str).first()

    if not bot and not emp:
        return Response({'detail': 'Operator not found'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        "User-ID": emp.user_id if emp else bot.user_id,
        "employee_name": emp.username if emp else "Operator",
        "bot_name": bot.bot_name if bot else "Customer Service Bot",
        "bot_username": bot.bot_username if bot else "cs_support_bot",
        "avatar": (emp.avatar if emp and emp.avatar else (bot.avatar if bot else "")) or "",
        "description": bot.description if bot else "Customer service operator account",
        "connected_at": timezone.now().strftime("%I:%M %p")
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def chats_list(request):
    """
    Retrieve conversation list for current operator.
    Returns: Array of ChatConversation objects.
    """
    operator_id = request.query_params.get('User-ID') or request.query_params.get('userId')
    if not operator_id:
        return Response({'detail': 'User-ID is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Trigger conversation synchronization if sync query parameter is 'true'
    sync_param = request.query_params.get('sync')
    if sync_param and str(sync_param).strip().lower() in ['true', '1']:
        try:
            TelegramBotGateway.sync_bot_conversations(operator_id=operator_id)
        except Exception as e:
            logger.warning(f"[Chats List] Auto-sync failed gracefully: {e}")

    # Find Telegram users who have conversation history with this specific operator account
    interacted_user_ids = set()
    for s_id, t_id in ChatMessage.objects.filter(
        Q(sender_id=operator_id) | Q(to_user=operator_id)
    ).values_list('sender_id', 'to_user'):
        interacted_user_ids.add(t_id if s_id == operator_id else s_id)

    # Exclude internal saved_messages from external client users
    interacted_user_ids.discard('saved_messages')

    users = TelegramUser.objects.filter(telegram_id__in=interacted_user_ids).order_by('-updated_at')
    conversations = []

    # 1. Always prepend private "Saved Messages" as default first conversation for this bot
    last_saved_msg = ChatMessage.objects.filter(
        sender_id=operator_id,
        to_user='saved_messages'
    ).order_by('-created_at').first()

    saved_conv = {
        'id': 'saved_messages',
        'user': {
            'id': 'saved_messages',
            'username': 'saved_messages',
            'firstName': 'Saved Messages',
            'lastName': '',
            'avatar': '',
            'isBot': False,
            'isOnline': True,
            'lastSeen': 'Cloud Storage'
        },
        'unreadCount': 0,
        'lastMessage': format_message_dict(last_saved_msg) if last_saved_msg else None,
        'isPinned': True,
        'isGroup': False,
        'isSavedMessages': True,
        'category': 'Private Notes',
    }
    conversations.append(saved_conv)

    for u in users:
        # Get last message between operator and this user
        last_msg = ChatMessage.objects.filter(
            (Q(sender_id=operator_id) & Q(to_user=u.telegram_id)) |
            (Q(sender_id=u.telegram_id) & Q(to_user=operator_id))
        ).order_by('-created_at').first()

        unread_count = ChatMessage.objects.filter(
            sender_id=u.telegram_id,
            to_user=operator_id,
            status='delivered'
        ).count()

        conv = {
            'id': u.telegram_id,
            'user': format_user_dict(u),
            'unreadCount': unread_count,
            'lastMessage': format_message_dict(last_msg) if last_msg else None,
            'isPinned': False,
            'isGroup': False,
            'category': 'Customer Support',
        }
        conversations.append(conv)

    return Response(conversations)


@api_view(['GET'])
@permission_classes([AllowAny])
def messages_history(request):
    """
    Retrieve message history for selected conversation.
    Query: ?User-ID=1234&to-user=user_id
    """
    operator_id = request.query_params.get('User-ID')
    to_user = request.query_params.get('to-user')

    if not operator_id or not to_user:
        return Response({'detail': 'User-ID and to-user parameters are required'}, status=status.HTTP_400_BAD_REQUEST)

    messages = ChatMessage.objects.filter(
        (Q(sender_id=operator_id) & Q(to_user=to_user)) |
        (Q(sender_id=to_user) & Q(to_user=operator_id))
    ).order_by('created_at')

    data = [format_message_dict(m) for m in messages]
    return Response(data)


@api_view(['POST'])
@permission_classes([AllowAny])
def send_message(request):
    """
    Handle outgoing message sent by operator from React frontend.
    Schema:
    {
      "User-ID": "1234",
      "to-user": "telegram_chat_id",
      "message": "Hello!",
      "action": "send_message",
      "sticker": {...},
      "media": {...}
    }
    """
    operator_id = request.data.get('User-ID')
    to_user = request.data.get('to-user')
    text = request.data.get('message', '')
    action = request.data.get('action', 'send_message')
    raw_sticker = request.data.get('sticker')
    sticker = raw_sticker if isinstance(raw_sticker, dict) else None
    raw_media = request.data.get('media')
    media = raw_media if isinstance(raw_media, dict) else None

    if not operator_id or not to_user:
        return Response({'detail': 'User-ID and to-user are required'}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Validate active session token for operator_id
    session_token = request.data.get('session_token') or request.data.get('token')
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not session_token and auth_header.startswith('Bearer '):
        session_token = auth_header.split(' ', 1)[1].strip()

    if not session_token:
        return Response({'detail': 'Authentication session token required'}, status=status.HTTP_401_UNAUTHORIZED)

    sess = DeviceSession.objects.filter(session_token=session_token, is_active=True).select_related('employee').first()
    if not sess or not sess.employee or not sess.employee.is_active:
        return Response({'detail': 'Invalid or revoked session token'}, status=status.HTTP_401_UNAUTHORIZED)

    if sess.employee.user_id != str(operator_id).strip():
        return Response({'detail': 'Session token does not belong to specified User-ID'}, status=status.HTTP_401_UNAUTHORIZED)

    sess.last_activity = timezone.now()
    sess.save(update_fields=['last_activity'])

    # 2. Fetch Operator & Bot Token
    bot_token = TelegramBotGateway.get_bot_token(operator_id)

    # 2. Persist outgoing message in DB
    msg_uid = f"msg_{int(timezone.now().timestamp() * 1000)}_{secrets.token_hex(4)}"
    chat_msg = ChatMessage.objects.create(
        message_uid=msg_uid,
        sender_id=operator_id,
        to_user=to_user,
        message=text,
        action=action,
        is_outgoing=True,
        status='sent',
        media_type=media.get('type') if isinstance(media, dict) else None,
        media_url=media.get('url') if isinstance(media, dict) else None,
        media_filename=media.get('fileName') if isinstance(media, dict) else None,
        media_duration=media.get('duration', 0) if isinstance(media, dict) else 0,
        sticker_id=sticker.get('id') if isinstance(sticker, dict) else None,
        sticker_pack=sticker.get('packId') if isinstance(sticker, dict) else None,
        sticker_emoji=sticker.get('emoji') if isinstance(sticker, dict) else None,
    )

    # 3. Dispatch to Telegram Bot API (if not saving to private Saved Messages)
    tg_response = None
    if to_user != 'saved_messages':
        tg_response = TelegramBotGateway.send_telegram_message(
            bot_token=bot_token,
            chat_id=to_user,
            text=text,
            media=media,
            sticker=sticker
        )

    # 4. Broadcast to operator's WebSocket channel
    ws_event = {
        "id": msg_uid,
        "sender_id": operator_id,
        "User-ID": operator_id,
        "to-user": to_user,
        "message": text,
        "timestamp": int(chat_msg.created_at.timestamp() * 1000),
        "action": "sent",
        "is_outgoing": True,
        "status": "sent",
    }
    if isinstance(media, dict):
        ws_event["media"] = media
    if isinstance(sticker, dict):
        ws_event["sticker"] = sticker

    TelegramBotGateway.notify_operator_via_websocket(operator_id, ws_event)

    return Response({
        "status": "success",
        "success": True,
        "message_id": msg_uid,
        "message": {
            "message_uid": msg_uid,
            "sender_id": operator_id,
            "to_user": to_user,
            "message": text,
            "action": action,
            "is_outgoing": True,
            "created_at": chat_msg.created_at.isoformat(),
        },
        "telegram_response": tg_response
    })


@api_view(['POST', 'GET'])
@permission_classes([AllowAny])
def sync_telegram_view(request):
    """
    Explicit endpoint to trigger Telegram conversation auto-fetching.
    Accepts User-ID from headers, query params, or request body.
    Returns sync statistics: { status, synced_users, synced_messages, last_update_id }
    """
    user_id = (
        request.META.get('HTTP_USER_ID') or
        request.query_params.get('User-ID') or
        request.query_params.get('userId') or
        request.query_params.get('user_id') or
        (request.data.get('User-ID') if isinstance(request.data, dict) else None) or
        (request.data.get('userId') if isinstance(request.data, dict) else None) or
        (request.data.get('user_id') if isinstance(request.data, dict) else None)
    )
    try:
        result = TelegramBotGateway.sync_bot_conversations(operator_id=user_id)
    except (OperationalError, IntegrityError) as e:
        logger.warning(f"[Sync Telegram View] DB concurrency error: {e}")
        result = {
            "status": "offline_or_failed",
            "synced_users": 0,
            "synced_messages": 0,
            "new_messages": 0,
            "last_update_id": getattr(TelegramBotGateway, '_last_update_id', 0),
            "error": f"Database concurrency error: {e}"
        }
    except Exception as e:
        logger.error(f"[Sync Telegram View] Unexpected error: {e}")
        result = {
            "status": "offline_or_failed",
            "synced_users": 0,
            "synced_messages": 0,
            "new_messages": 0,
            "last_update_id": getattr(TelegramBotGateway, '_last_update_id', 0),
            "error": str(e)
        }
    return Response(result)


@api_view(['POST'])
@permission_classes([AllowAny])
def media_upload(request):
    """
    Handle audio voice notes, photo, and media uploads from React client with validation.
    """
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'detail': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

    if file_obj.size > MAX_FILE_SIZE:
        return Response({'detail': f'File exceeds maximum size limit ({MAX_FILE_SIZE // (1024 * 1024)}MB)'}, status=status.HTTP_400_BAD_REQUEST)

    raw_name = os.path.basename(file_obj.name)
    _, ext = os.path.splitext(raw_name)
    ext_lower = ext.lower()
    if ext_lower not in ALLOWED_UPLOAD_EXTENSIONS:
        return Response({'detail': f'File extension {ext_lower} is not allowed'}, status=status.HTTP_400_BAD_REQUEST)

    safe_name = "".join(c for c in raw_name if c.isalnum() or c in "._-")
    upload_dir = settings.MEDIA_ROOT / 'uploads'
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{secrets.token_hex(8)}_{safe_name}"
    file_path = upload_dir / filename

    with open(file_path, 'wb+') as destination:
        for chunk in file_obj.chunks():
            destination.write(chunk)

    media_url = request.build_absolute_uri(f"{settings.MEDIA_URL}uploads/{filename}")
    return Response({
        "success": True,
        "url": media_url,
        "filename": filename
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def telegram_webhook(request, user_id=None):
    """
    Incoming Webhook from Telegram Bot API for operator {user_id}.
    When a customer messages the bot, Telegram POSTs the JSON payload here.
    Supports /api/telegram/webhook/<user_id>/ and /api/telegram/webhook/.
    """
    webhook_secret = getattr(settings, 'TELEGRAM_WEBHOOK_SECRET', None) or os.environ.get('TELEGRAM_WEBHOOK_SECRET')
    if webhook_secret:
        received_token = request.headers.get('X-Telegram-Bot-Api-Secret-Token') or request.META.get('HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN')
        if not received_token or not secrets.compare_digest(received_token, webhook_secret):
            logger.warning("[Telegram Webhook] Unauthorized webhook update: token mismatch or absent")
            return Response({"detail": "Unauthorized webhook source"}, status=status.HTTP_403_FORBIDDEN)

    operator_id = (
        user_id or
        request.META.get('HTTP_USER_ID') or
        request.query_params.get('User-ID') or
        request.query_params.get('userId') or
        (request.data.get('User-ID') if isinstance(request.data, dict) else None) or
        (request.data.get('userId') if isinstance(request.data, dict) else None) or
        '1234'
    )
    update = request.data
    success = TelegramBotGateway.handle_incoming_telegram_update(operator_id, update)
    return Response({"ok": success})
