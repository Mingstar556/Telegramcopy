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
    def save_outgoing_message(self, operator_id: str, to_user: str, text: str, action: str, sticker: dict = None, media: dict = None, album: list = None):
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
            media_type='sticker' if action == 'send_sticker' else (media.get('type') if isinstance(media, dict) else ('photo' if album else None)),
            media_url=(sticker.get('url') if isinstance(sticker, dict) else None) or (media.get('url') if isinstance(media, dict) else ((album[0].get('url') if album and isinstance(album[0], dict) else None))),
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

    @database_sync_to_async
    def get_related_operator_ids(self, user_id: str):
        from telegram_chat.models import BotAccount, EmployeeAccount
        from django.db.models import Q
        ids = {str(user_id)}
        try:
            bot = BotAccount.objects.filter(Q(user_id=user_id) | Q(employee__user_id=user_id)).select_related('employee').first()
            if bot:
                ids.add(str(bot.user_id))
                if bot.employee:
                    ids.add(str(bot.employee.user_id))
                if bot.bot_token:
                    for s_uid in BotAccount.objects.filter(bot_token=bot.bot_token).values_list('user_id', flat=True):
                        ids.add(str(s_uid))
        except Exception:
            pass
        return list(ids)

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
        self.related_rooms = []

        # Join operator group & all sibling bot rooms
        related_ids = await self.get_related_operator_ids(self.user_id)
        for rid in related_ids:
            r_group = f"operator_{rid}"
            await self.channel_layer.group_add(r_group, self.channel_name)
            self.related_rooms.append(r_group)

        await self.accept()
        logger.info(f"[WebSocket] Operator {self.user_id} connected to {self.related_rooms} (token={bool(token)})")

        # Make sure background bot poller is active for instant message reception
        await self.ensure_poller_started(self.user_id)

    async def disconnect(self, close_code):
        # Leave all operator groups
        if hasattr(self, 'related_rooms'):
            for r_group in self.related_rooms:
                await self.channel_layer.group_discard(r_group, self.channel_name)
        elif hasattr(self, 'room_group'):
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

        # Handle reaction action: dispatch setMessageReaction to Telegram and broadcast reaction badge update
        if action == 'reaction':
            to_user = payload.get('to-user') or payload.get('to_user') or payload.get('to_userid')
            reaction_data = payload.get('reaction') or {}
            target_msg_id = str(reaction_data.get('message_id') or payload.get('message_id') or '')
            emoji = reaction_data.get('emoji') or payload.get('message') or ''
            is_removed = bool(payload.get('is_removed') or reaction_data.get('is_removed', False))

            # Extract integer telegram message ID if formatted like msg_tg_<chat>_<id>
            tg_msg_id = None
            if target_msg_id:
                if '_' in target_msg_id:
                    parts = target_msg_id.split('_')
                    if parts[-1].isdigit():
                        tg_msg_id = int(parts[-1])
                elif target_msg_id.isdigit():
                    tg_msg_id = int(target_msg_id)

            if not tg_msg_id and target_msg_id:
                from telegram_chat.models import ChatMessage
                db_msg = await database_sync_to_async(
                    lambda: ChatMessage.objects.filter(message_uid=target_msg_id).first()
                )()
                if db_msg and db_msg.message_uid:
                    if '_' in db_msg.message_uid:
                        parts = db_msg.message_uid.split('_')
                        if parts[-1].isdigit():
                            tg_msg_id = int(parts[-1])
                    elif db_msg.message_uid.isdigit():
                        tg_msg_id = int(db_msg.message_uid)

            if to_user and tg_msg_id and to_user != 'saved_messages':
                from telegram_chat.bot_service import TelegramBotGateway
                bot_token = await self.get_bot_token(self.user_id)
                TelegramBotGateway.set_message_reaction_async(
                    bot_token=bot_token,
                    chat_id=to_user,
                    message_id=tg_msg_id,
                    emoji=None if is_removed else emoji,
                    operator_id=self.user_id
                )

            # Broadcast reaction event to operator group so UI displays reaction badge without creating a message/sticker
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "chat_message",
                    "data": {
                        "action": "reaction",
                        "chatId": to_user,
                        "to-user": to_user,
                        "messageId": target_msg_id,
                        "reaction": {
                            "message_id": target_msg_id,
                            "emoji": emoji,
                            "is_removed": is_removed
                        },
                        "message": emoji,
                        "is_removed": is_removed,
                        "userId": self.user_id,
                        "sender_id": self.user_id,
                        "is_outgoing": True,
                        "timestamp": int(timezone.now().timestamp() * 1000)
                    }
                }
            )

            await self.send(text_data=json.dumps({
                "action": "ack",
                "status": "reaction_set"
            }))
            return

        # Handle delete_message action: remove from DB, delete from Telegram if requested, broadcast update
        if action == 'delete_message':
            to_user = payload.get('to-user') or payload.get('to_user') or payload.get('to_userid')
            target_msg_id = str(payload.get('message_id') or payload.get('messageId') or payload.get('message') or '')
            delete_for_everyone = bool(payload.get('delete_for_everyone', True))

            tg_msg_id = None
            if target_msg_id:
                from telegram_chat.models import ChatMessage
                db_msg = await database_sync_to_async(
                    lambda: ChatMessage.objects.filter(
                        Q(message_uid=target_msg_id) | Q(id=int(target_msg_id) if target_msg_id.isdigit() else -1)
                    ).first()
                )()
                if db_msg:
                    if db_msg.message_uid:
                        if '_' in db_msg.message_uid:
                            parts = db_msg.message_uid.split('_')
                            if parts[-1].isdigit():
                                tg_msg_id = int(parts[-1])
                        elif db_msg.message_uid.isdigit():
                            tg_msg_id = int(db_msg.message_uid)
                    await database_sync_to_async(lambda: db_msg.delete())()

            if delete_for_everyone and to_user and to_user != 'saved_messages':
                if not tg_msg_id and target_msg_id:
                    if '_' in target_msg_id:
                        parts = target_msg_id.split('_')
                        if parts[-1].isdigit():
                            tg_msg_id = int(parts[-1])
                    elif target_msg_id.isdigit():
                        tg_msg_id = int(target_msg_id)

                if tg_msg_id:
                    from telegram_chat.bot_service import TelegramBotGateway
                    bot_token = await self.get_bot_token(self.user_id)
                    TelegramBotGateway.delete_message_async(
                        bot_token=bot_token,
                        chat_id=to_user,
                        message_id=tg_msg_id,
                        operator_id=self.user_id
                    )

            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "chat_message",
                    "data": {
                        "action": "delete_message",
                        "chatId": to_user,
                        "to-user": to_user,
                        "messageId": target_msg_id,
                        "is_removed": True,
                        "timestamp": int(timezone.now().timestamp() * 1000)
                    }
                }
            )

            await self.send(text_data=json.dumps({
                "action": "ack",
                "status": "message_deleted",
                "messageId": target_msg_id
            }))
            return

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
        file_url = payload.get('file')
        if sticker and file_url and not sticker.get('url'):
            sticker['url'] = file_url
        media = payload.get('media') if isinstance(payload.get('media'), dict) else None
        album = payload.get('album') if isinstance(payload.get('album'), list) else None

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
            media=media,
            album=album
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
        if album:
            event_data["album"] = album

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
                msg_uid=msg_uid,
                album=album
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
