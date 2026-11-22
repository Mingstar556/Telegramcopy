import os
import re
import time
import secrets
import logging
import requests
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from django.utils import timezone
from django.conf import settings
from django.db import OperationalError, IntegrityError
from django.db.models import Q
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser, BaseParser
from .security import SecurityGuard, mask_sensitive_token, check_rate_limit


class RawTextParser(BaseParser):
    """
    Accepts raw text or arbitrary media types and decodes the stream into a string.
    Ensures text/plain or raw payload lines are not rejected with 415 Unsupported Media Type.
    """
    media_type = '*/*'

    def parse(self, stream, media_type=None, parser_context=None):
        try:
            return stream.read().decode('utf-8')
        except Exception:
            return ''

from .models import EmployeeAccount, DeviceSession, BotAccount, TelegramUser, ChatMessage
from .serializers import format_message_dict, format_user_dict
from .bot_service import TelegramBotGateway

logger = logging.getLogger(__name__)

# Blue Team Defense: In-memory sliding rate limiter for authentication
_LOGIN_ATTEMPTS = defaultdict(list)
_MAX_LOGIN_ATTEMPTS = 15
_LOGIN_WINDOW_SEC = 60

ALLOWED_UPLOAD_EXTENSIONS = {
    # Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.heic', '.heif',
    # Videos
    '.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.3gp', '.wmv',
    # Audio
    '.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.opus',
    # Documents
    '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.zip', '.rar', '.7z', '.json'
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB (Matches Telegram Bot API upload limit)


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
        from .poller import AutoPollerEngine
        AutoPollerEngine.ensure_bot_polling(employee.user_id)
    except Exception as e:
        logger.warning(f"[Login View] Background auto-sync failed gracefully: {e}")

    # 4. Resolve Bot Metadata & Auto-Fetch Bot Avatar if missing
    bot = bot_account or (employee.bot_accounts.first() if hasattr(employee, 'bot_accounts') else None)
    if bot and bot.bot_token and (not bot.avatar or not employee.avatar):
        try:
            bot_avatar = TelegramBotGateway.fetch_and_cache_telegram_avatar(bot.bot_token, bot.user_id, is_bot=True)
            if not bot_avatar:
                me_res = requests.get(f"https://api.telegram.org/bot{bot.bot_token}/getMe", timeout=3).json()
                if me_res.get('ok') and isinstance(me_res.get('result'), dict):
                    me_id = str(me_res['result'].get('id', ''))
                    if me_id:
                        bot_avatar = TelegramBotGateway.fetch_and_cache_telegram_avatar(bot.bot_token, me_id, is_bot=True)
            if bot_avatar:
                bot.avatar = bot_avatar
                bot.save(update_fields=['avatar'])
                employee.avatar = bot_avatar
                employee.save(update_fields=['avatar'])
        except Exception as e:
            logger.debug(f"[Login View] Bot avatar fetch: {e}")

    raw_avatar = employee.avatar or (bot.avatar if bot else "") or ""
    if raw_avatar and raw_avatar.startswith('/'):
        raw_avatar = request.build_absolute_uri(raw_avatar)

    return Response({
        "status": "success",
        "User-ID": employee.user_id,
        "token": session.session_token,
        "session_id": session.id,
        "employee_name": employee.username,
        "bot_name": bot.bot_name if bot else "Customer Service Bot",
        "bot_username": bot.bot_username if bot else "cs_support_bot",
        "avatar": raw_avatar,
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
    """Fetch profile of current operator bot session with Telegram avatar sync."""
    user_id = request.query_params.get('User-ID') or request.query_params.get('userId') or request.query_params.get('user_id')
    if not user_id:
        return Response({'detail': 'User-ID is required'}, status=status.HTTP_400_BAD_REQUEST)

    user_id_str = str(user_id).strip()
    bot = BotAccount.objects.filter(user_id=user_id_str).first()
    emp = EmployeeAccount.objects.filter(user_id=user_id_str).first()

    if not bot and not emp:
        return Response({'detail': 'Operator not found'}, status=status.HTTP_404_NOT_FOUND)

    # Auto-fetch bot profile photo if missing
    if bot and bot.bot_token and (not bot.avatar or not (emp and emp.avatar)):
        try:
            bot_avatar = TelegramBotGateway.fetch_and_cache_telegram_avatar(bot.bot_token, bot.user_id, is_bot=True)
            if not bot_avatar and bot.bot_token:
                try:
                    me_res = requests.get(f"https://api.telegram.org/bot{bot.bot_token}/getMe", timeout=3).json()
                    if me_res.get('ok') and isinstance(me_res.get('result'), dict):
                        me_id = str(me_res['result'].get('id', ''))
                        if me_id:
                            bot_avatar = TelegramBotGateway.fetch_and_cache_telegram_avatar(bot.bot_token, me_id, is_bot=True)
                except Exception:
                    pass
            if bot_avatar:
                bot.avatar = bot_avatar
                bot.save(update_fields=['avatar'])
                if emp:
                    emp.avatar = bot_avatar
                    emp.save(update_fields=['avatar'])
        except Exception as e:
            logger.debug(f"[User Profile] Auto-avatar fetch for bot error: {e}")

    raw_avatar = (emp.avatar if emp and emp.avatar else (bot.avatar if bot else "")) or ""
    if raw_avatar and raw_avatar.startswith('/'):
        raw_avatar = request.build_absolute_uri(raw_avatar)

    return Response({
        "User-ID": emp.user_id if emp else bot.user_id,
        "employee_name": emp.username if emp else "Operator",
        "bot_name": bot.bot_name if bot else "Customer Service Bot",
        "bot_username": bot.bot_username if bot else "cs_support_bot",
        "avatar": raw_avatar,
        "description": bot.description if bot else "Customer service operator account",
        "connected_at": timezone.now().strftime("%I:%M %p")
    })


@api_view(['POST', 'DELETE'])
@permission_classes([AllowAny])
def update_bot_avatar_view(request):
    """
    Allow holder of the bot to change or remove the bot's profile picture.
    Uploads new photo to Telegram via setMyProfilePhoto and updates database record.
    """
    current_token = None
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        current_token = auth_header.split(' ', 1)[1].strip()
    if not current_token:
        current_token = request.data.get('token') or request.data.get('session_token') or request.query_params.get('token')

    operator_id = None
    if current_token:
        sess = DeviceSession.objects.filter(session_token=current_token, is_active=True).select_related('employee').first()
        if sess and sess.employee and sess.employee.is_active:
            operator_id = sess.employee.user_id

    if not operator_id:
        operator_id = request.data.get('User-ID') or request.data.get('userId') or request.query_params.get('User-ID') or request.query_params.get('userId')

    if not operator_id:
        return Response({'detail': 'User-ID or authentication required'}, status=status.HTTP_400_BAD_REQUEST)

    operator_id_str = str(operator_id).strip()
    bot = BotAccount.objects.filter(user_id=operator_id_str).first()
    emp = EmployeeAccount.objects.filter(user_id=operator_id_str).first()

    if not bot and not emp:
        return Response({'detail': 'Operator bot account not found'}, status=status.HTTP_404_NOT_FOUND)

    # Handle DELETE (Remove bot profile photo)
    if request.method == 'DELETE':
        tg_res = None
        if bot and bot.bot_token:
            tg_res = TelegramBotGateway.remove_bot_profile_photo(bot.bot_token)
        if bot:
            bot.avatar = ""
            bot.save(update_fields=['avatar'])
        if emp:
            emp.avatar = ""
            emp.save(update_fields=['avatar'])
        return Response({'success': True, 'avatar': '', 'telegram': tg_res})

    # Handle POST (Upload and set bot profile photo)
    file_obj = request.FILES.get('avatar') or request.FILES.get('file') or request.FILES.get('photo')
    photo_bytes = None
    filename = 'avatar.jpg'

    if file_obj:
        if file_obj.size > MAX_FILE_SIZE:
            return Response({'detail': f'File exceeds maximum size limit ({MAX_FILE_SIZE // (1024 * 1024)}MB)'}, status=status.HTTP_400_BAD_REQUEST)
        filename = os.path.basename(file_obj.name)
        photo_bytes = file_obj.read()
    else:
        # Check base64
        b64_str = request.data.get('avatar') or request.data.get('photo') or request.data.get('file')
        if isinstance(b64_str, str) and b64_str.startswith('data:'):
            try:
                import base64
                header, raw_b64 = b64_str.split(';base64,', 1)
                mime = header.split(':', 1)[1] if ':' in header else 'image/jpeg'
                ext = '.png' if 'png' in mime else ('.webp' if 'webp' in mime else '.jpg')
                filename = f"avatar{ext}"
                photo_bytes = base64.b64decode(raw_b64)
            except Exception as e:
                return Response({'detail': f'Invalid base64 image: {e}'}, status=status.HTTP_400_BAD_REQUEST)

    if not photo_bytes:
        return Response({'detail': 'No avatar image file or base64 provided'}, status=status.HTTP_400_BAD_REQUEST)

    # Save locally to avatars dir
    avatars_dir = settings.MEDIA_ROOT / 'avatars'
    os.makedirs(avatars_dir, exist_ok=True)
    clean_id = bot.bot_token.split(':', 1)[0].strip() if bot and ':' in bot.bot_token else operator_id_str
    _, ext = os.path.splitext(filename)
    if not ext:
        ext = '.jpg'
    saved_filename = f"bot_{clean_id}_{int(time.time())}{ext}"
    saved_path = avatars_dir / saved_filename
    with open(saved_path, 'wb') as f:
        f.write(photo_bytes)

    relative_url = f"{settings.MEDIA_URL}avatars/{saved_filename}"
    absolute_url = request.build_absolute_uri(relative_url)

    tg_res = None
    if bot and bot.bot_token:
        tg_res = TelegramBotGateway.set_bot_profile_photo(bot.bot_token, photo_bytes, filename=saved_filename)

    if bot:
        bot.avatar = relative_url
        bot.save(update_fields=['avatar'])
    if emp:
        emp.avatar = relative_url
        emp.save(update_fields=['avatar'])

    return Response({
        'success': True,
        'avatar': absolute_url,
        'avatar_url': absolute_url,
        'relative_url': relative_url,
        'telegram': tg_res
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

    # Blue Team Defense: Validate session token if provided (blocks cross-account enumeration & hijacked tokens)
    current_token = None
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        current_token = auth_header.split(' ', 1)[1].strip()
    if not current_token:
        current_token = request.query_params.get('token') or request.query_params.get('session_token')

    if current_token:
        sess = DeviceSession.objects.filter(session_token=current_token, is_active=True).select_related('employee').first()
        if not sess or not sess.employee or not sess.employee.is_active:
            return Response({'detail': 'Invalid or expired session token'}, status=status.HTTP_401_UNAUTHORIZED)
        if str(operator_id).strip() != sess.employee.user_id:
            return Response({'detail': 'Forbidden: session does not belong to requested user'}, status=status.HTTP_403_FORBIDDEN)

    # Trigger conversation synchronization if sync query parameter is 'true'
    sync_param = request.query_params.get('sync')
    if sync_param and str(sync_param).strip().lower() in ['true', '1']:
        try:
            TelegramBotGateway.sync_bot_conversations(operator_id=operator_id)
        except Exception as e:
            logger.warning(f"[Chats List] Auto-sync failed gracefully: {e}")

    # Resolve all operator user_ids associated with this operator (including linked bot accounts and shared tokens)
    allowed_operator_ids = {str(operator_id)}
    bot = BotAccount.objects.filter(Q(user_id=operator_id) | Q(employee__user_id=operator_id)).select_related('employee').first()
    if bot:
        allowed_operator_ids.add(str(bot.user_id))
        if bot.employee:
            allowed_operator_ids.add(str(bot.employee.user_id))
        if bot.bot_token:
            for s_uid in BotAccount.objects.filter(bot_token=bot.bot_token).values_list('user_id', flat=True):
                allowed_operator_ids.add(str(s_uid))

    # Find Telegram users who have conversation history with this specific operator account
    interacted_user_ids = set()
    for s_id, t_id in ChatMessage.objects.filter(
        Q(sender_id__in=allowed_operator_ids) | Q(to_user__in=allowed_operator_ids)
    ).values_list('sender_id', 'to_user'):
        interacted_user_ids.add(t_id if s_id in allowed_operator_ids else s_id)

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
            'lastSeen': 'Individual Storage'
        },
        'unreadCount': 0,
        'lastMessage': format_message_dict(last_saved_msg) if last_saved_msg else None,
        'isPinned': True,
        'isGroup': False,
        'isSavedMessages': True,
        'category': 'Individual Notes',
    }
    conversations.append(saved_conv)

    # High-Performance Batch Aggregation (Eliminating N+1 queries):
    from django.db.models import Count
    unread_counts = dict(
        ChatMessage.objects.filter(
            to_user=operator_id,
            status='delivered'
        ).values('sender_id').annotate(cnt=Count('id')).values_list('sender_id', 'cnt')
    )

    # Batch fetch all recent messages for interacted users in a single indexed query
    recent_msgs = ChatMessage.objects.filter(
        Q(sender_id=operator_id, to_user__in=interacted_user_ids) |
        Q(to_user=operator_id, sender_id__in=interacted_user_ids)
    ).order_by('-created_at')

    last_msg_map = {}
    for m in recent_msgs:
        peer_id = m.to_user if m.sender_id == operator_id else m.sender_id
        if peer_id not in last_msg_map:
            last_msg_map[peer_id] = m

    bot_token = TelegramBotGateway.get_bot_token(operator_id)

    for u in users:
        # If user avatar is missing, trigger async background fetch without blocking HTTP request
        if not u.avatar and bot_token:
            TelegramBotGateway.async_fetch_and_cache_avatar(bot_token, u.telegram_id)

        u_dict = format_user_dict(u)
        if u_dict.get('avatar') and u_dict['avatar'].startswith('/'):
            u_dict['avatar'] = request.build_absolute_uri(u_dict['avatar'])

        last_msg = last_msg_map.get(u.telegram_id)
        unread_count = unread_counts.get(u.telegram_id, 0)

        conv = {
            'id': u.telegram_id,
            'user': u_dict,
            'unreadCount': unread_count,
            'lastMessage': format_message_dict(last_msg) if last_msg else None,
            'isPinned': False,
            'isGroup': False,
            'category': 'Customer Support',
        }
        conversations.append(conv)

    saved_convs = [c for c in conversations if c.get('isSavedMessages') or c.get('isPinned')]
    other_convs = [c for c in conversations if not (c.get('isSavedMessages') or c.get('isPinned'))]
    other_convs.sort(key=lambda c: (c.get('lastMessage') or {}).get('timestamp', 0) if c.get('lastMessage') else 0, reverse=True)
    return Response(saved_convs + other_convs)


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

    # Blue Team Defense: Validate session token if provided (blocks unauthorized DB dumping)
    current_token = None
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        current_token = auth_header.split(' ', 1)[1].strip()
    if not current_token:
        current_token = request.query_params.get('token') or request.query_params.get('session_token')

    if current_token:
        sess = DeviceSession.objects.filter(session_token=current_token, is_active=True).select_related('employee').first()
        if not sess or not sess.employee or not sess.employee.is_active:
            return Response({'detail': 'Invalid or expired session token'}, status=status.HTTP_401_UNAUTHORIZED)
        if str(operator_id).strip() != sess.employee.user_id:
            return Response({'detail': 'Forbidden: session does not belong to requested user'}, status=status.HTTP_403_FORBIDDEN)

    allowed_operator_ids = {str(operator_id)}
    bot = BotAccount.objects.filter(Q(user_id=operator_id) | Q(employee__user_id=operator_id)).select_related('employee').first()
    if bot:
        allowed_operator_ids.add(str(bot.user_id))
        if bot.employee:
            allowed_operator_ids.add(str(bot.employee.user_id))
        if bot.bot_token:
            for s_uid in BotAccount.objects.filter(bot_token=bot.bot_token).values_list('user_id', flat=True):
                allowed_operator_ids.add(str(s_uid))

    messages = ChatMessage.objects.filter(
        (Q(sender_id__in=allowed_operator_ids) & Q(to_user=to_user)) |
        (Q(sender_id=to_user) & Q(to_user__in=allowed_operator_ids))
    ).order_by('created_at')

    target_user = TelegramUser.objects.filter(telegram_id=to_user).first()
    target_avatar = target_user.avatar if target_user else ''
    if target_avatar and target_avatar.startswith('/'):
        target_avatar = request.build_absolute_uri(target_avatar)

    data = []
    album_map = {}

    for m in messages:
        m_dict = format_message_dict(m)
        if not m.is_outgoing and target_avatar:
            m_dict['senderAvatar'] = target_avatar
        if m_dict.get('media') and m_dict['media'].get('url') and m_dict['media']['url'].startswith('/'):
            m_dict['media']['url'] = request.build_absolute_uri(m_dict['media']['url'])

        mg_id = getattr(m, 'media_group_id', None)
        if mg_id and m.media_type == 'photo':
            if mg_id in album_map:
                parent = album_map[mg_id]
                photo_item = {'type': 'photo', 'url': m_dict['media']['url'] if m_dict.get('media') else m.media_url}
                if photo_item['url'] and photo_item['url'].startswith('/'):
                    photo_item['url'] = request.build_absolute_uri(photo_item['url'])
                if 'album' not in parent or not parent['album']:
                    parent['album'] = [parent['media']] if parent.get('media') else []
                parent['album'].append(photo_item)
                if not parent.get('message') and m_dict.get('message'):
                    parent['message'] = m_dict['message']
                continue
            else:
                album_map[mg_id] = m_dict
                m_dict['album'] = [m_dict['media']] if m_dict.get('media') else []
                data.append(m_dict)
        else:
            data.append(m_dict)

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
    operator_id = request.data.get('User-ID') or request.data.get('employee_id') or request.data.get('userId')
    to_user = request.data.get('to-user') or request.data.get('to_userid') or request.data.get('to_user')
    text = request.data.get('message') if request.data.get('message') is not None else request.data.get('caption', '')
    action = request.data.get('action') or request.data.get('Action', 'send_message')
    raw_sticker = request.data.get('sticker')
    sticker = raw_sticker if isinstance(raw_sticker, dict) else None
    if sticker and not sticker.get('url') and request.data.get('file'):
        sticker['url'] = request.data.get('file')
    raw_media = request.data.get('media')
    media = raw_media if isinstance(raw_media, dict) else None
    raw_album = request.data.get('album')
    album = raw_album if isinstance(raw_album, list) else None
    if not media and (action in ['send_photo', 'send_video', 'send_media', 'send_file', 'send_voice'] or request.data.get('file') or request.data.get('video')):
        file_val = request.data.get('file') or request.data.get('video') or request.data.get('photo')
        if file_val:
            file_str = str(file_val).lower().split('?')[0]
            m_type = 'photo'
            if action == 'send_video' or any(file_str.endswith(ext) for ext in ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v']):
                m_type = 'video'
            elif action == 'send_voice' or any(file_str.endswith(ext) for ext in ['.webm', '.ogg', '.wav', '.mp3', '.m4a']):
                m_type = 'voice'
            elif action in ['send_file', 'send_document'] or any(file_str.endswith(ext) for ext in ['.pdf', '.zip', '.docx', '.xlsx', '.csv', '.apk', '.txt']):
                m_type = 'file'
            media = {'type': m_type, 'url': str(file_val), 'fileName': os.path.basename(str(file_val))}

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

    # Blue Team Defense: Validate outgoing message against phishing links and ABA payment tampering
    is_safe, sec_err = SecurityGuard.validate_outgoing_message(text, operator_id, request.META.get('REMOTE_ADDR'))
    if not is_safe:
        return Response({'detail': sec_err}, status=status.HTTP_400_BAD_REQUEST)

    reply_markup = request.data.get('reply_markup')
    if reply_markup and isinstance(reply_markup, dict):
        inline_kb = reply_markup.get('inline_keyboard', [])
        for row in inline_kb:
            if isinstance(row, list):
                for btn in row:
                    if isinstance(btn, dict) and btn.get('url'):
                        is_safe_btn, sec_err_btn = SecurityGuard.validate_outgoing_message(str(btn['url']), operator_id, request.META.get('REMOTE_ADDR'))
                        if not is_safe_btn:
                            return Response({'detail': f"Inline button URL blocked: {sec_err_btn}"}, status=status.HTTP_400_BAD_REQUEST)

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
        media_type='sticker' if action == 'send_sticker' else (media.get('type') if isinstance(media, dict) else None),
        media_url=(sticker.get('url') if isinstance(sticker, dict) else None) or (media.get('url') if isinstance(media, dict) else None),
        media_filename=media.get('fileName') if isinstance(media, dict) else None,
        media_duration=media.get('duration', 0) if isinstance(media, dict) else 0,
        sticker_id=sticker.get('id') if isinstance(sticker, dict) else None,
        sticker_pack=sticker.get('packId') if isinstance(sticker, dict) else None,
        sticker_emoji=sticker.get('emoji') if isinstance(sticker, dict) else None,
        reply_markup=reply_markup,
    )

    # 3. Dispatch to Telegram Bot API (if not saving to private Saved Messages)
    tg_response = None
    if to_user != 'saved_messages':
        tg_response = TelegramBotGateway.dispatch_to_telegram_async(
            bot_token=bot_token,
            chat_id=to_user,
            text=text,
            media=media,
            sticker=sticker,
            operator_id=operator_id,
            msg_uid=msg_uid,
            reply_markup=reply_markup,
            album=album
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
    if isinstance(album, list):
        ws_event["album"] = album
    if isinstance(sticker, dict):
        ws_event["sticker"] = sticker
    if reply_markup:
        ws_event["reply_markup"] = reply_markup

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


_webhook_worker_pool = ThreadPoolExecutor(max_workers=16, thread_name_prefix='tg_webhook_worker')


@api_view(['POST'])
@permission_classes([AllowAny])
def telegram_webhook(request, user_id=None):
    """
    Incoming Webhook from Telegram Bot API for operator {user_id}.
    When a customer messages the bot, Telegram POSTs the JSON payload here.
    Supports /api/telegram/webhook/<user_id>/ and /api/telegram/webhook/.
    Returns HTTP 200 immediately (<2ms) and offloads processing to async worker pool.
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
        (request.data.get('userId') if isinstance(request.data, dict) else None)
    )
    if not operator_id:
        active_sess = DeviceSession.objects.filter(is_active=True).select_related('employee').first()
        if active_sess and active_sess.employee:
            operator_id = active_sess.employee.user_id
        else:
            first_bot = BotAccount.objects.exclude(bot_token="").first()
            operator_id = first_bot.user_id if first_bot else '1234'
    update = request.data
    # Blue Team Defense: Validate incoming message payload against dangerous scripts or phishing
    msg_obj = update.get('message') or update.get('edited_message') if isinstance(update, dict) else None
    if isinstance(msg_obj, dict):
        in_text = msg_obj.get('text') or msg_obj.get('caption', '')
        if in_text:
            is_safe, sec_err = SecurityGuard.validate_incoming_message(in_text, str(operator_id))
            if not is_safe:
                logger.warning(f"[SECURITY ALERT] Blocked malicious incoming message: {sec_err}")
                return Response({"ok": False, "detail": sec_err}, status=status.HTTP_400_BAD_REQUEST)

    # Async Queue: offload DB/API processing to background thread pool, return 200 OK immediately
    _webhook_worker_pool.submit(TelegramBotGateway.handle_incoming_telegram_update, operator_id, update)
    return Response({"ok": True, "status": "queued"})


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([AllowAny])
def manage_webhook(request):
    """
    Manage Telegram Webhook.
    GET: Get current webhook status (getWebhookInfo).
    POST: Set webhook to specified URL (setWebhook).
    DELETE: Delete webhook (deleteWebhook, switches bot to long-polling).
    """
    operator_id = (
        request.query_params.get('user_id') or
        request.query_params.get('User-ID') or
        (request.data.get('user_id') if isinstance(request.data, dict) else None) or
        (request.data.get('User-ID') if isinstance(request.data, dict) else None) or
        '1234'
    )
    bot_token = TelegramBotGateway.get_bot_token(operator_id)
    if not bot_token:
        return Response({"ok": False, "detail": "Bot token not configured"}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        info = TelegramBotGateway.get_webhook_info(bot_token)
        return Response(info)

    if request.method == 'POST':
        webhook_url = request.data.get('webhook_url') or request.data.get('url')
        if not webhook_url:
            return Response({"ok": False, "detail": "webhook_url is required"}, status=status.HTTP_400_BAD_REQUEST)
        secret_token = request.data.get('secret_token') or getattr(settings, 'TELEGRAM_WEBHOOK_SECRET', None)
        allowed_updates = request.data.get('allowed_updates') or ['message', 'edited_message', 'callback_query']
        res = TelegramBotGateway.set_webhook(bot_token, webhook_url, secret_token, allowed_updates)
        return Response(res)

    if request.method == 'DELETE':
        drop_pending = bool(request.data.get('drop_pending_updates', False))
        res = TelegramBotGateway.delete_webhook(bot_token, drop_pending_updates=drop_pending)
        return Response(res)


def _extract_photo_blocks(request) -> list:
    """
    Extract one or more photo dispatch requests from the incoming request.
    Handles:
    - JSON dict or list of dicts
    - Form data (multipart/form-data or application/x-www-form-urlencoded)
    - Raw text matching:
      [11/17/2026 11:29 PM] Kavv 502: api/send_photo

      employee_id RY
      to_userid = YEAK
      caption="this is a caption"
      file="jabkjdnaknwdawd/dajkhbwdbnaw.png"
      Action = send_photo
    """
    # 1. If request.data is a dict or QueryDict (e.g. JSON or Form)
    if isinstance(request.data, dict) or hasattr(request.data, 'getlist'):
        data_dict = dict(request.data.items()) if hasattr(request.data, 'items') else dict(request.data)
        uploaded_file = request.FILES.get('file') or request.FILES.get('photo') or request.FILES.get('image')
        if uploaded_file:
            data_dict['_uploaded_file'] = uploaded_file

        emp_key = next((k for k in ['employee_id', 'employeeId', 'User-ID', 'userId', 'user_id', 'operator_id', 'sender_id'] if k in data_dict), None)
        to_key = next((k for k in ['to_userid', 'to_user_id', 'to_user', 'to-user', 'toUser', 'chat_id'] if k in data_dict), None)
        if emp_key or to_key or uploaded_file:
            return [data_dict]

    # 2. If request.data is a list of dicts (JSON array)
    if isinstance(request.data, list):
        return [dict(item) for item in request.data if isinstance(item, dict)]

    # 3. If raw text (either in request.data as str, or in request.body)
    raw_text = ""
    if isinstance(request.data, str) and request.data.strip():
        raw_text = request.data
    elif hasattr(request, 'body') and request.body:
        try:
            raw_text = request.body.decode('utf-8', errors='ignore')
        except Exception:
            raw_text = ""

    if raw_text.strip():
        lines = raw_text.splitlines()
        blocks = []
        current_lines = []
        for line in lines:
            stripped = line.strip()
            is_header = (
                ('api/send_photo' in stripped.lower()) or
                (stripped.startswith('[') and ']' in stripped and any(x in stripped.lower() for x in ['api/', 'send_photo', ':']))
            )
            if is_header and current_lines:
                text_chunk = '\n'.join(current_lines).lower()
                if any(k in text_chunk for k in ['employee_id', 'to_userid', 'file']):
                    blocks.append(current_lines)
                    current_lines = []
            current_lines.append(line)
        if current_lines:
            blocks.append(current_lines)

        parsed_blocks = []
        for b_lines in blocks:
            d = {}
            for line in b_lines:
                line = line.strip()
                if not line or (line.startswith('[') and ']' in line) or line.lower().startswith('api/') or line.lower().startswith('/api/'):
                    continue
                if '=' in line:
                    k, v = line.split('=', 1)
                elif ':' in line:
                    k, v = line.split(':', 1)
                elif ' ' in line:
                    k, v = line.split(None, 1)
                else:
                    continue
                k = k.strip()
                v = v.strip().strip('"\'')
                d[k] = v
            if d:
                parsed_blocks.append(d)

        if parsed_blocks:
            return parsed_blocks

    # 4. Fallback: check query params
    if request.query_params:
        qp = dict(request.query_params.items())
        return [qp]

    return []


@api_view(['POST', 'GET'])
@permission_classes([AllowAny])
@parser_classes([JSONParser, FormParser, MultiPartParser, RawTextParser])
def send_photo(request):
    """
    Handle send_photo requests matching:
    [11/17/2026 11:29 PM] Kavv 502: api/send_photo

    employee_id RY
    to_userid = YEAK
    caption="this is a caption"
    file="jabkjdnaknwdawd/dajkhbwdbnaw.png"
    Action = send_photo

    Supports JSON, form-data, multipart upload, and raw message text.
    """
    if request.method == 'GET' and not request.query_params:
        return Response({
            "status": "ok",
            "endpoint": "/api/send_photo/",
            "expected_fields": ["employee_id", "to_userid", "file", "Action", "caption (optional)"]
        })

    blocks = _extract_photo_blocks(request)
    if not blocks:
        return Response({
            "status": "error",
            "detail": "No valid send_photo payload or message found. Required fields: employee_id, to_userid, file"
        }, status=status.HTTP_400_BAD_REQUEST)

    results = []
    for item in blocks:
        # 1. Normalize field keys
        employee_id = (
            item.get('employee_id') or item.get('employeeId') or item.get('User-ID') or
            item.get('userId') or item.get('user_id') or item.get('operator_id') or item.get('sender_id') or
            request.query_params.get('employee_id') or request.META.get('HTTP_EMPLOYEE_ID') or
            request.META.get('HTTP_USER_ID')
        )
        to_userid = (
            item.get('to_userid') or item.get('to_user_id') or item.get('to_user') or
            item.get('to-user') or item.get('toUser') or item.get('chat_id') or
            request.query_params.get('to_userid')
        )
        caption = (
            item.get('caption') or item.get('message') or item.get('text') or item.get('description') or ''
        )
        action = (
            item.get('Action') or item.get('action') or item.get('action_type') or 'send_photo'
        )
        file_val = (
            item.get('file') or item.get('photo') or item.get('image') or item.get('media')
        )

        if isinstance(caption, list):
            caption = caption[0] if caption else ''
        if isinstance(employee_id, list):
            employee_id = employee_id[0] if employee_id else ''
        if isinstance(to_userid, list):
            to_userid = to_userid[0] if to_userid else ''
        if isinstance(action, list):
            action = action[0] if action else 'send_photo'

        if isinstance(caption, str):
            caption = caption.strip('"\'')
        if isinstance(file_val, str):
            file_val = file_val.strip('"\'')
        if isinstance(employee_id, str):
            employee_id = employee_id.strip('"\'').strip()
        if isinstance(to_userid, str):
            to_userid = to_userid.strip('"\'').strip()

        # Handle uploaded file if present
        uploaded_file = item.get('_uploaded_file') or request.FILES.get('file') or request.FILES.get('photo')
        if uploaded_file and hasattr(uploaded_file, 'chunks'):
            raw_name = os.path.basename(getattr(uploaded_file, 'name', 'photo.png'))
            safe_name = "".join(c for c in raw_name if c.isalnum() or c in "._-")
            upload_dir = settings.MEDIA_ROOT / 'uploads'
            os.makedirs(upload_dir, exist_ok=True)
            saved_filename = f"{secrets.token_hex(8)}_{safe_name}"
            saved_path = upload_dir / saved_filename
            with open(saved_path, 'wb+') as dest:
                for chunk in uploaded_file.chunks():
                    dest.write(chunk)
            media_url = request.build_absolute_uri(f"{settings.MEDIA_URL}uploads/{saved_filename}")
            media_filename = saved_filename
            file_val = media_url
        else:
            if isinstance(file_val, list):
                file_val = file_val[0] if file_val else ''
            if not file_val:
                return Response({
                    "status": "error",
                    "detail": "file parameter is required (path, URL, or multipart file)"
                }, status=status.HTTP_400_BAD_REQUEST)
            media_url = str(file_val)
            media_filename = os.path.basename(media_url.split('?')[0])

        if not employee_id or not to_userid:
            return Response({
                "status": "error",
                "detail": "employee_id and to_userid are required fields."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Blue Team Defense: Validate outgoing photo caption and file URL against phishing & ABA tampering
        check_text = f"{caption or ''} {file_val or ''}".strip()
        is_safe, sec_err = SecurityGuard.validate_outgoing_message(check_text, employee_id, request.META.get('REMOTE_ADDR'))
        if not is_safe:
            return Response({'detail': sec_err}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Ensure EmployeeAccount and BotAccount exist for operator
        emp, _ = EmployeeAccount.objects.get_or_create(
            user_id=employee_id,
            defaults={
                'username': f"Operator {employee_id}",
                'password': make_password(employee_id),
                'role': 'operator'
            }
        )
        bot, _ = BotAccount.objects.get_or_create(
            user_id=employee_id,
            defaults={
                'employee': emp,
                'password': make_password(employee_id),
                'bot_name': f"Bot {employee_id}",
                'bot_username': f"bot_{employee_id.lower()}",
                'bot_token': os.environ.get('TELEGRAM_BOT_TOKEN') or getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
            }
        )

        # 3. Ensure TelegramUser exists for recipient client
        if to_userid != 'saved_messages':
            TelegramUser.objects.get_or_create(
                telegram_id=to_userid,
                defaults={
                    'first_name': to_userid,
                    'username': to_userid
                }
            )

        # 4. Persist ChatMessage in SQLite
        msg_uid = f"msg_{int(timezone.now().timestamp() * 1000)}_{secrets.token_hex(4)}"
        chat_msg = ChatMessage.objects.create(
            message_uid=msg_uid,
            sender_id=employee_id,
            to_user=to_userid,
            message=caption or "",
            action=action or "send_photo",
            is_outgoing=True,
            status='sent',
            media_type='photo',
            media_url=media_url,
            media_filename=media_filename
        )

        # 5. Dispatch to Telegram Bot API
        bot_token = TelegramBotGateway.get_bot_token(employee_id)
        tg_response = None
        if to_userid != 'saved_messages':
            media_dict = {
                'type': 'photo',
                'url': media_url,
                'fileName': media_filename
            }
            tg_response = TelegramBotGateway.dispatch_to_telegram_async(
                bot_token=bot_token,
                chat_id=to_userid,
                text=caption or "",
                media=media_dict,
                action='send_photo',
                operator_id=employee_id,
                msg_uid=msg_uid
            )

        # 6. Real-time WebSocket broadcast to operator
        ws_event = {
            "id": msg_uid,
            "sender_id": employee_id,
            "User-ID": employee_id,
            "to-user": to_userid,
            "message": caption or "",
            "timestamp": int(chat_msg.created_at.timestamp() * 1000),
            "action": action or "send_photo",
            "is_outgoing": True,
            "status": "sent",
            "media": {
                "type": "photo",
                "url": media_url,
                "fileName": media_filename
            }
        }
        TelegramBotGateway.notify_operator_via_websocket(employee_id, ws_event)
        if to_userid and to_userid != employee_id:
            TelegramBotGateway.notify_operator_via_websocket(to_userid, ws_event)

        results.append({
            "status": "success",
            "success": True,
            "message_id": msg_uid,
            "employee_id": employee_id,
            "to_userid": to_userid,
            "file": file_val,
            "caption": caption or "",
            "action": action or "send_photo",
            "message": {
                "message_uid": msg_uid,
                "sender_id": employee_id,
                "to_user": to_userid,
                "caption": caption or "",
                "file": file_val,
                "action": action or "send_photo",
                "is_outgoing": True,
                "media_url": media_url,
                "created_at": chat_msg.created_at.isoformat(),
            },
            "telegram_response": tg_response
        })

    if len(results) == 1:
        return Response(results[0], status=status.HTTP_200_OK)
    return Response({
        "status": "success",
        "success": True,
        "count": len(results),
        "messages": results,
        "message_id": results[-1]["message_id"],
        "employee_id": results[-1]["employee_id"],
        "to_userid": results[-1]["to_userid"],
        "file": results[-1]["file"],
        "caption": results[-1]["caption"],
        "action": results[-1]["action"],
    }, status=status.HTTP_200_OK)


# ==============================================================================
# AUTOMATIC TELEGRAM BOT ACCOUNT GENERATOR (ADMIN TOOL)
# ==============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def generate_bot_accounts_view(request):
    """
    Automatic Bot Account Generator Endpoint.
    Accepts Telegram Bot keys/tokens, verifies each against Telegram Bot API (getMe),
    generates secure web login credentials (User-ID & Password), and creates both
    EmployeeAccount and BotAccount records in the SQLite database.
    """
    data = request.data if isinstance(request.data, dict) else {}
    raw_tokens = data.get('tokens') or data.get('bot_tokens') or data.get('keys') or []
    count_requested = data.get('count')
    id_prefix = str(data.get('id_prefix', 'auto')).strip()
    password_type = str(data.get('password_type', 'memorable')).lower().strip()
    custom_password = str(data.get('custom_password', '')).strip()
    fetch_telegram_info = bool(data.get('fetch_telegram_info', True))
    overwrite = bool(data.get('overwrite', True))

    token_list = []
    if isinstance(raw_tokens, str):
        # Support multi-line string or comma-separated tokens
        lines = re.split(r'[\r\n,]+', raw_tokens)
        for line in lines:
            t = line.strip()
            if t:
                token_list.append(t)
    elif isinstance(raw_tokens, list):
        for item in raw_tokens:
            if isinstance(item, str):
                t = item.strip()
                if t:
                    token_list.append(t)
            elif isinstance(item, dict) and 'token' in item:
                t = str(item['token']).strip()
                if t:
                    token_list.append(t)

    # If count is specified and more than tokens provided, pad or generate placeholders
    if count_requested and isinstance(count_requested, (int, str)):
        try:
            target_count = int(count_requested)
            if target_count > len(token_list):
                # Admin specified count greater than provided tokens
                needed = target_count - len(token_list)
                for i in range(needed):
                    dummy_bot_id = secrets.randbelow(899999999) + 100000000
                    dummy_token = f"{dummy_bot_id}:AA{secrets.token_urlsafe(28)[:32]}"
                    token_list.append(dummy_token)
        except ValueError:
            pass

    if not token_list:
        return Response({
            "status": "error",
            "message": "No Telegram bot keys provided. Please provide 'tokens' or 'count'."
        }, status=status.HTTP_400_BAD_REQUEST)

    generated_accounts = []
    errors = []

    for index, token in enumerate(token_list, start=1):
        bot_id = ""
        if ":" in token:
            parts = token.split(":", 1)
            if parts[0].isdigit():
                bot_id = parts[0]

        bot_name = f"Bot {bot_id or index}"
        bot_username = f"bot_{bot_id or index}"
        avatar_url = ""
        telegram_verified = False
        telegram_error = ""

        # 1. Probe Telegram Bot API for real identity
        if fetch_telegram_info and bot_id:
            try:
                get_me_url = f"https://api.telegram.org/bot{token}/getMe"
                resp = requests.get(get_me_url, timeout=5)
                if resp.status_code == 200:
                    res_json = resp.json()
                    if res_json.get('ok') and isinstance(res_json.get('result'), dict):
                        b_res = res_json['result']
                        bot_name = b_res.get('first_name') or bot_name
                        bot_username = b_res.get('username') or bot_username
                        telegram_verified = True

                        # Try to fetch avatar
                        try:
                            photos_url = f"https://api.telegram.org/bot{token}/getUserProfilePhotos?user_id={bot_id}&limit=1"
                            p_resp = requests.get(photos_url, timeout=4)
                            if p_resp.status_code == 200:
                                p_json = p_resp.json()
                                if p_json.get('ok') and p_json.get('result', {}).get('photos'):
                                    photo_items = p_json['result']['photos'][0]
                                    if photo_items:
                                        file_id = photo_items[-1].get('file_id')
                                        if file_id:
                                            f_resp = requests.get(f"https://api.telegram.org/bot{token}/getFile?file_id={file_id}", timeout=4)
                                            if f_resp.status_code == 200 and f_resp.json().get('ok'):
                                                file_path = f_resp.json()['result'].get('file_path')
                                                if file_path:
                                                    avatar_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
                        except Exception as e:
                            logger.debug(f"[Generator] Avatar fetch skipped: {e}")
                else:
                    telegram_error = f"Telegram HTTP {resp.status_code}: {resp.text[:80]}"
            except Exception as e:
                telegram_error = f"Telegram API unreachable: {str(e)[:80]}"

        # 2. Determine unique User-ID
        if id_prefix == "auto":
            candidate_id = re.sub(r'[^a-zA-Z0-9_]', '', bot_username.lower()) or f"bot_{bot_id or index}"
        elif id_prefix.endswith("_") or id_prefix.endswith("-"):
            candidate_id = f"{id_prefix}{index}"
        else:
            candidate_id = f"{id_prefix}_{index}"

        # Ensure User-ID uniqueness if not overwriting
        user_id = candidate_id
        suffix_num = 1
        while not overwrite and EmployeeAccount.objects.filter(user_id=user_id).exists():
            user_id = f"{candidate_id}_{suffix_num}"
            suffix_num += 1

        # 3. Generate Password
        if password_type == "custom" and custom_password:
            raw_password = custom_password
        elif password_type == "random":
            raw_password = secrets.token_urlsafe(9)
        else: # memorable default
            random_digits = secrets.randbelow(9000) + 1000
            raw_password = f"BotPass_{random_digits}"

        password_hash = make_password(raw_password)

        # 4. Upsert EmployeeAccount & BotAccount in SQLite
        emp, emp_created = EmployeeAccount.objects.update_or_create(
            user_id=user_id,
            defaults={
                'username': bot_name,
                'password': password_hash,
                'avatar': avatar_url or "",
                'role': 'operator',
                'is_active': True
            }
        )

        bot_acc, bot_created = BotAccount.objects.update_or_create(
            user_id=user_id,
            defaults={
                'employee': emp,
                'password': password_hash,
                'bot_name': bot_name,
                'bot_username': bot_username,
                'bot_token': token,
                'avatar': avatar_url or "",
                'description': f"Automated Web Operator linked to Telegram @{bot_username}"
            }
        )

        generated_accounts.append({
            "user_id": user_id,
            "password": raw_password,
            "bot_name": bot_name,
            "bot_username": bot_username,
            "bot_token": token,
            "bot_token_masked": mask_sensitive_token(token),
            "avatar": avatar_url,
            "status": "created" if emp_created else "updated",
            "telegram_verified": telegram_verified,
            "telegram_error": telegram_error or None
        })

    return Response({
        "status": "success",
        "message": f"Successfully generated {len(generated_accounts)} web operator accounts.",
        "total_requested": len(token_list),
        "total_generated": len(generated_accounts),
        "accounts": generated_accounts,
        "errors": errors if errors else None
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_bot_accounts_view(request):
    """
    List all configured bot accounts and employee operators.
    """
    bots = BotAccount.objects.select_related('employee').all().order_by('-created_at')
    results = []
    for b in bots:
        results.append({
            "user_id": b.user_id,
            "bot_name": b.bot_name,
            "bot_username": b.bot_username,
            "bot_token_masked": mask_sensitive_token(b.bot_token),
            "avatar": b.avatar or "",
            "is_active": b.employee.is_active if b.employee else True,
            "created_at": b.created_at.isoformat() if b.created_at else None
        })
    return Response({
        "status": "ok",
        "count": len(results),
        "accounts": results
    })


@api_view(['DELETE'])
@permission_classes([AllowAny])
def delete_bot_account_view(request, user_id):
    """
    Remove a bot operator account and associated sessions.
    """
    user_id_str = str(user_id).strip()
    deleted_bot = BotAccount.objects.filter(user_id=user_id_str).delete()
    deleted_emp = EmployeeAccount.objects.filter(user_id=user_id_str).delete()

    return Response({
        "status": "success",
        "user_id": user_id_str,
        "deleted": bool(deleted_bot[0] or deleted_emp[0])
    })

