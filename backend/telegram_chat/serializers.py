from rest_framework import serializers
from .models import BotAccount, TelegramUser, ChatMessage


class BotAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotAccount
        fields = ['user_id', 'bot_name', 'bot_username', 'avatar', 'description']


def format_message_dict(msg: ChatMessage) -> dict:
    """Format ChatMessage model into the React client's ChatMessage interface."""
    data = {
        'id': msg.message_uid,
        'senderId': msg.sender_id,
        'senderName': msg.sender_name or '',
        'toUser': msg.to_user,
        'message': msg.message,
        'timestamp': int(msg.created_at.timestamp() * 1000),
        'isOutgoing': msg.is_outgoing,
        'status': msg.status,
        'action': msg.action,
    }

    if msg.media_type and msg.media_url:
        data['media'] = {
            'type': msg.media_type,
            'url': msg.media_url,
            'fileName': msg.media_filename or '',
            'duration': msg.media_duration or 0,
        }

    if msg.sticker_id:
        data['sticker'] = {
            'id': msg.sticker_id,
            'packId': msg.sticker_pack or '',
            'emoji': msg.sticker_emoji or '⭐',
            'url': '',
            'name': msg.sticker_id,
        }

    if getattr(msg, 'reply_markup', None):
        data['reply_markup'] = msg.reply_markup

    return data


def format_user_dict(user: TelegramUser) -> dict:
    """Format TelegramUser into React client's TelegramUser interface."""
    return {
        'id': user.telegram_id,
        'username': user.username or '',
        'firstName': user.first_name,
        'lastName': user.last_name or '',
        'avatar': user.avatar or '',
        'isBot': False,
        'online': user.is_online,
        'lastSeen': user.last_seen or 'recently',
    }
