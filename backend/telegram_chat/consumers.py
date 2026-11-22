import json
import secrets
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .security import SecurityGuard

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    @database_sync_to_async
    def validate_session_token(self, token: str):
        from telegram_chat.models import DeviceSession
        try:
            session = DeviceSession.objects.select_related('employee').get(
                session_token=token,
                is_active=True
            )
            session.last_activity = timezone.now()
            session.save(update_fields=['last_activity'])
            return session.employee.user_id
        except DeviceSession.DoesNotExist:
            return None

    @database_sync_to_async
    def validate_user_id(self, user_id: str):
        from telegram_chat.models import EmployeeAccount, BotAccount
        if EmployeeAccount.objects.filter(user_id=user_id, is_active=True).exists():
            return True
        if BotAccount.objects.filter(user_id=user_id).exists():
            return True
        return False

    @database_sync_to_async
    def save_outgoing_message(self, operator_id: str, to_user: str, text: str, action: str, sticker: dict = None, media: dict = None):
        from telegram_chat.models import ChatMessage
        msg_uid = f"msg_{int(timezone.now().timestamp() * 1000)}_{secrets.token_hex(4)}"
        chat_msg = ChatMessage.objects.create(
            message_uid=msg_uid,
            sender_id=operator_id,
            to_user=to_user,
            message=text or "",
            action=action or 'send_message',
            is_outgoing=True,
            status='sent',
            media_type=media.get('type') if isinstance(media, dict) else None,
            media_url=media.get('url') if isinstance(media, dict) else None,
            media_filename=media.get('fileName') or media.get('file_name') if isinstance(media, dict) else None,
            media_duration=media.get('duration', 0) if isinstance(media, dict) else 0,
            sticker_id=sticker.get('id') if isinstance(sticker, dict) else None,
            sticker_pack=sticker.get('packId') or sticker.get('pack_id') if isinstance(sticker, dict) else None,
            sticker_emoji=sticker.get('emoji') if isinstance(sticker, dict) else None,
        )
        return msg_uid, chat_msg.id

    @database_sync_to_async
    def get_bot_token(self, operator_id: str):
        from telegram_chat.bot_service import TelegramBotGateway
        return TelegramBotGateway.get_bot_token(operator_id)

    @database_sync_to_async
    def ensure_poller_started(self, operator_id: str):
        from telegram_chat.poller import AutoPollerEngine
        AutoPollerEngine.ensure_bot_polling(operator_id)

    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = {}
        if query_string:
            for part in query_string.split('&'):
                if '=' in part:
                    k, v = part.split('=', 1)
                    params[k] = v

        token = params.get('token')
        user_id = params.get('user_id') or params.get('User-ID')

        self.user_id = None
        self.session_token = token

        if not token:
            logger.warning("[WebSocket] Connection rejected: valid session token is required")
            await self.close(code=4001)
            return

        valid_user_id = await self.validate_session_token(token)
        if not valid_user_id:
            logger.warning(f"[WebSocket] Invalid or expired session token: {token}")
            await self.close(code=4001)
            return

        if user_id and str(user_id) != str(valid_user_id):
            logger.warning(f"[WebSocket] Token does not match requested user_id: {user_id} vs {valid_user_id}")
            await self.close(code=4001)
            return

        self.user_id = valid_user_id

        self.room_group = f"operator_{self.user_id}"

        # Join operator group
        await self.channel_layer.group_add(
            self.room_group,
            self.channel_name
        )
        await self.accept()
        logger.info(f"[WebSocket] Operator {self.user_id} connected to {self.room_group} (token={bool(token)})")

        # Make sure background bot poller is active for instant message reception
        await self.ensure_poller_started(self.user_id)

    async def disconnect(self, close_code):
        # Leave operator group
        if hasattr(self, 'room_group'):
            await self.channel_layer.group_discard(
                self.room_group,
                self.channel_name
            )
        logger.info(f"[WebSocket] Operator {getattr(self, 'user_id', 'unknown')} disconnected with code {close_code}")

    async def receive(self, text_data):
        """Receive message or ping directly from operator WebSocket with sub-10ms response."""
        try:
            payload = json.loads(text_data)
        except Exception as e:
            logger.error(f"[WebSocket Receive Error]: {e}")
            return

        # Handle keep-alive ping immediately
        if payload.get('type') == 'ping' or payload.get('action') == 'ping':
            await self.send(text_data=json.dumps({
                "type": "pong",
                "timestamp": int(timezone.now().timestamp() * 1000)
            }))
            return

        action = payload.get('action', 'send_message')

        # Handle typing indicator broadcast
        if action == 'typing':
            to_user = payload.get('to-user') or payload.get('to_user')
            if to_user:
                await self.channel_layer.group_send(
                    self.room_group,
                    {
                        "type": "chat_message",
                        "data": {
                            "action": "typing",
                            "to-user": to_user,
                            "from_user": self.user_id,
                            "timestamp": int(timezone.now().timestamp() * 1000)
                        }
                    }
                )
            return

        to_user = payload.get('to-user') or payload.get('to_user') or payload.get('to_userid')
        text = payload.get('message', '')
        sticker = payload.get('sticker') if isinstance(payload.get('sticker'), dict) else None
        media = payload.get('media') if isinstance(payload.get('media'), dict) else None

        if not to_user:
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "to-user is required"
            }))
            return

        # Security check on outgoing message
        client_ip = self.scope.get('client', [''])[0]
        is_safe, sec_err = SecurityGuard.validate_outgoing_message(text, self.user_id, client_ip)
        if not is_safe:
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": sec_err
            }))
            return

        # 1. Instantly save to database
        msg_uid, chat_msg_id = await self.save_outgoing_message(
            operator_id=self.user_id,
            to_user=to_user,
            text=text,
            action=action,
            sticker=sticker,
            media=media
        )

        now_ms = int(timezone.now().timestamp() * 1000)

        # 2. Immediately broadcast to operator group (< 5ms)
        event_data = {
            "id": msg_uid,
            "sender_id": self.user_id,
            "User-ID": self.user_id,
            "to-user": to_user,
            "message": text or "",
            "timestamp": now_ms,
            "action": "sent",
            "is_outgoing": True,
            "status": "sent",
        }
        if sticker:
            event_data["sticker"] = sticker
        if media:
            event_data["media"] = media

        await self.channel_layer.group_send(
            self.room_group,
            {
                "type": "chat_message",
                "data": event_data
            }
        )

        # 3. Dispatch to Telegram asynchronously without blocking WebSocket
        if to_user != 'saved_messages':
            from telegram_chat.bot_service import TelegramBotGateway
            bot_token = await self.get_bot_token(self.user_id)
            TelegramBotGateway.dispatch_to_telegram_async(
                bot_token=bot_token,
                chat_id=to_user,
                text=text,
                media=media,
                sticker=sticker,
                action=action,
                operator_id=self.user_id,
                msg_uid=msg_uid
            )

        # 4. Immediate ACK to sender socket
        await self.send(text_data=json.dumps({
            "action": "ack",
            "id": msg_uid,
            "status": "sent"
        }))

    async def chat_message(self, event):
        """Push real-time message event from Django/Telegram to operator frontend."""
        await self.send(text_data=json.dumps(event["data"]))

    async def session_revoked(self, event):
        """Notify operator device that session has been revoked."""
        await self.send(text_data=json.dumps({
            "type": "session_revoked",
            "data": event.get("data", {})
        }))
