import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        self.user_id = "default"

        for param in query_string.split('&'):
            if param.startswith('user_id='):
                self.user_id = param.split('=')[1]

        self.room_group = f"operator_{self.user_id}"

        # Join operator group
        await self.channel_layer.group_add(
            self.room_group,
            self.channel_name
        )
        await self.accept()
        logger.info(f"[WebSocket] Operator {self.user_id} connected to {self.room_group}")

    async def disconnect(self, close_code):
        # Leave operator group
        await self.channel_layer.group_discard(
            self.room_group,
            self.channel_name
        )
        logger.info(f"[WebSocket] Operator {self.user_id} disconnected with code {close_code}")

    async def receive(self, text_data):
        """Receive message directly from operator WebSocket."""
        try:
            payload = json.loads(text_data)
            logger.info(f"[WebSocket Receive] Operator {self.user_id} payload: {payload}")
            # Echo back confirmation if needed
        except Exception as e:
            logger.error(f"[WebSocket Receive Error]: {e}")

    async def chat_message(self, event):
        """Push real-time message event from Django/Telegram to operator frontend."""
        await self.send(text_data=json.dumps(event["data"]))
