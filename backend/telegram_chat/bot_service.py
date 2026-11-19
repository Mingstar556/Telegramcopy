import logging
import requests
from typing import Optional, Dict, Any
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone
from .models import BotAccount, TelegramUser, ChatMessage

logger = logging.getLogger(__name__)
TELEGRAM_API_BASE = "https://api.telegram.org"


class TelegramBotGateway:
    """
    Scalable Multi-Bot Gateway service.
    Handles communication between the operator dashboard and the Telegram Bot API.
    Each CS operator can have their own bot account or share a pool of bots.
    """

    @staticmethod
    def get_bot_token(user_id: str) -> Optional[str]:
        """Fetch bot token for the given CS operator."""
        try:
            bot = BotAccount.objects.get(user_id=user_id)
            return bot.bot_token if bot.bot_token else None
        except BotAccount.DoesNotExist:
            return None

    @staticmethod
    def send_telegram_message(
        bot_token: str,
        chat_id: str,
        text: str,
        media: Optional[Dict[str, Any]] = None,
        sticker: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Dispatch message to Telegram user via Telegram Bot API.
        Supports text, voice notes, photos, and stickers.
        """
        if not bot_token:
            logger.warning("[Telegram Gateway] No bot token provided, running in mock/offline mode.")
            return {"ok": True, "result": {"message_id": 99999, "simulated": True}}

        try:
            # 1. Voice Note Dispatch
            if media and media.get('type') == 'voice':
                voice_url = media.get('url', '')
                url = f"{TELEGRAM_API_BASE}/bot{bot_token}/sendVoice"
                payload = {'chat_id': chat_id, 'voice': voice_url}
                if text:
                    payload['caption'] = text
                resp = requests.post(url, json=payload, timeout=10)
                return resp.json()

            # 2. Photo Dispatch
            if media and media.get('type') == 'photo':
                photo_url = media.get('url', '')
                url = f"{TELEGRAM_API_BASE}/bot{bot_token}/sendPhoto"
                payload = {'chat_id': chat_id, 'photo': photo_url}
                if text:
                    payload['caption'] = text
                resp = requests.post(url, json=payload, timeout=10)
                return resp.json()

            # 3. Sticker Dispatch
            if sticker and sticker.get('id'):
                url = f"{TELEGRAM_API_BASE}/bot{bot_token}/sendMessage"
                text_to_send = f"{sticker.get('emoji', '⭐')} [{sticker.get('id')}]"
                resp = requests.post(url, json={'chat_id': chat_id, 'text': text_to_send}, timeout=10)
                return resp.json()

            # 4. Standard Text Message
            url = f"{TELEGRAM_API_BASE}/bot{bot_token}/sendMessage"
            payload = {'chat_id': chat_id, 'text': text}
            resp = requests.post(url, json=payload, timeout=10)
            return resp.json()

        except Exception as e:
            logger.error(f"[Telegram Gateway] Failed to send message to Telegram user {chat_id}: {e}")
            return {"ok": False, "error": str(e)}

    @staticmethod
    def notify_operator_via_websocket(operator_id: str, message_payload: dict):
        """Broadcast an incoming or status update to the operator's React frontend."""
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"operator_{operator_id}",
                    {
                        "type": "chat_message",
                        "data": message_payload
                    }
                )
        except Exception as e:
            logger.error(f"[WebSocket Gateway] Failed to broadcast event: {e}")

    @classmethod
    def handle_incoming_telegram_update(cls, operator_id: str, update: dict) -> bool:
        """
        Processes an incoming update from Telegram (Webhook or Polling worker).
        Upserts the customer TelegramUser, persists the ChatMessage, and pushes to frontend.
        """
        message_data = update.get('message') or update.get('edited_message')
        if not message_data:
            return False

        from_user = message_data.get('from', {})
        telegram_id = str(from_user.get('id', ''))
        if not telegram_id:
            return False

        first_name = from_user.get('first_name', 'Telegram Customer')
        last_name = from_user.get('last_name', '')
        username = from_user.get('username', '')

        # Upsert Telegram User
        tg_user, _ = TelegramUser.objects.update_or_create(
            telegram_id=telegram_id,
            defaults={
                'first_name': first_name,
                'last_name': last_name,
                'username': username,
                'is_online': True,
                'last_seen': 'online now',
            }
        )

        text_content = message_data.get('text', '')
        media_type = None
        media_url = None
        media_filename = None

        if 'photo' in message_data:
            media_type = 'photo'
            photos = message_data['photo']
            file_id = photos[-1]['file_id']
            media_url = f"https://api.telegram.org/file/bot/{file_id}"
            text_content = message_data.get('caption', '')
        elif 'voice' in message_data:
            media_type = 'voice'
            file_id = message_data['voice']['file_id']
            media_url = f"https://api.telegram.org/file/bot/{file_id}"
            text_content = message_data.get('caption', '')

        # Create ChatMessage record
        msg_uid = f"msg_{int(timezone.now().timestamp() * 1000)}"
        chat_msg = ChatMessage.objects.create(
            message_uid=msg_uid,
            sender_id=telegram_id,
            sender_name=f"{first_name} {last_name}".strip(),
            to_user=operator_id,
            message=text_content,
            action='send_message' if not media_type else 'send_media',
            is_outgoing=False,
            status='delivered',
            media_type=media_type,
            media_url=media_url,
            media_filename=media_filename,
        )

        # Broadcast real-time message to the operator's browser
        ws_payload = {
            "id": msg_uid,
            "sender_id": telegram_id,
            "sender_name": f"{first_name} {last_name}".strip(),
            "from_user": telegram_id,
            "User-ID": operator_id,
            "to-user": operator_id,
            "message": text_content,
            "timestamp": int(chat_msg.created_at.timestamp() * 1000),
            "action": "received",
            "is_outgoing": False,
            "status": "delivered",
        }
        if media_type:
            ws_payload["media"] = {"type": media_type, "url": media_url}

        cls.notify_operator_via_websocket(operator_id, ws_payload)
        return True
