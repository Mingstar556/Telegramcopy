import os
import secrets
from django.utils import timezone
from django.conf import settings
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import BotAccount, TelegramUser, ChatMessage
from .serializers import format_message_dict, format_user_dict
from .bot_service import TelegramBotGateway


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check for React client."""
    return Response({
        "status": "ok",
        "service": "django_telegram_bridge",
        "timestamp": timezone.now().isoformat()
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Operator login matching frontend schema:
    Body: {"User-ID": "1234", "password": "..."}
    """
    user_id = request.data.get('User-ID') or request.data.get('userId')
    password = request.data.get('password')

    if not user_id or not password:
        return Response({'detail': 'User-ID and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        account = BotAccount.objects.get(user_id=str(user_id))
        if account.password != str(password):
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        return Response({
            "User-ID": account.user_id,
            "bot_name": account.bot_name,
            "bot_username": account.bot_username,
            "token": account.auth_token,
            "avatar": account.avatar or "",
            "description": account.description,
        })
    except BotAccount.DoesNotExist:
        return Response({'detail': 'Operator account not found'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
@permission_classes([AllowAny])
def user_profile(request):
    """Fetch profile of current operator bot session."""
    user_id = request.query_params.get('User-ID') or request.query_params.get('userId')
    if not user_id:
        return Response({'detail': 'User-ID is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        account = BotAccount.objects.get(user_id=str(user_id))
        return Response({
            "User-ID": account.user_id,
            "bot_name": account.bot_name,
            "bot_username": account.bot_username,
            "avatar": account.avatar or "",
            "description": account.description,
            "connected_at": timezone.now().strftime("%I:%M %p")
        })
    except BotAccount.DoesNotExist:
        return Response({'detail': 'Operator not found'}, status=status.HTTP_404_NOT_FOUND)


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

    # Find all Telegram users with conversations
    users = TelegramUser.objects.all().order_by('-updated_at')
    conversations = []

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
    sticker = request.data.get('sticker')
    media = request.data.get('media')

    if not operator_id or not to_user:
        return Response({'detail': 'User-ID and to-user are required'}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Fetch Operator & Bot Token
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
        media_type=media.get('type') if media else None,
        media_url=media.get('url') if media else None,
        media_filename=media.get('fileName') if media else None,
        media_duration=media.get('duration', 0) if media else 0,
        sticker_id=sticker.get('id') if sticker else None,
        sticker_pack=sticker.get('packId') if sticker else None,
        sticker_emoji=sticker.get('emoji') if sticker else None,
    )

    # 3. Dispatch to Telegram Bot API
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
    if media:
        ws_event["media"] = media
    if sticker:
        ws_event["sticker"] = sticker

    TelegramBotGateway.notify_operator_via_websocket(operator_id, ws_event)

    return Response({
        "success": True,
        "message_id": msg_uid,
        "status": "sent",
        "telegram_response": tg_response
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def media_upload(request):
    """
    Handle audio voice notes, photo, and media uploads from React client.
    """
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'detail': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

    upload_dir = settings.MEDIA_ROOT / 'uploads'
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{secrets.token_hex(8)}_{file_obj.name}"
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
def telegram_webhook(request, user_id):
    """
    Incoming Webhook from Telegram Bot API for operator {user_id}.
    When a customer messages the bot, Telegram POSTs the JSON payload here.
    """
    update = request.data
    success = TelegramBotGateway.handle_incoming_telegram_update(user_id, update)
    return Response({"ok": success})
