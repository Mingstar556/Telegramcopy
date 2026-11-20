import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

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

    async def disconnect(self, close_code):
        # Leave operator group
        if hasattr(self, 'room_group'):
            await self.channel_layer.group_discard(
                self.room_group,
                self.channel_name
            )
        logger.info(f"[WebSocket] Operator {getattr(self, 'user_id', 'unknown')} disconnected with code {close_code}")

    async def receive(self, text_data):
        """Receive message directly from operator WebSocket."""
        try:
            payload = json.loads(text_data)
            logger.info(f"[WebSocket Receive] Operator {self.user_id} payload: {payload}")
        except Exception as e:
            logger.error(f"[WebSocket Receive Error]: {e}")

    async def chat_message(self, event):
        """Push real-time message event from Django/Telegram to operator frontend."""
        await self.send(text_data=json.dumps(event["data"]))

    async def session_revoked(self, event):
        """Notify operator device that session has been revoked."""
        await self.send(text_data=json.dumps({
            "type": "session_revoked",
            "data": event.get("data", {})
        }))
