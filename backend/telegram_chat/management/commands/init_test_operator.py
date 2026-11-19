import os
from django.core.management.base import BaseCommand
from telegram_chat.models import BotAccount, TelegramUser, ChatMessage


class Command(BaseCommand):
    help = 'Seeds initial test operator account and sample customers for the operator dashboard'

    def handle(self, *args, **options):
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '8290871821:AAF9tDx7ygLuVxb76d5XkNt6VfkyT2tqP3g')

        # 1. Create or update test operator 1234
        operator, created = BotAccount.objects.update_or_create(
            user_id="1234",
            defaults={
                "password": "1234",
                "bot_name": "kjel tv rean",
                "bot_username": "anhkjeltvrean_bot",
                "bot_token": bot_token,
                "description": "Telegram bot operator session actively connected to Python/Django backend.",
                "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
            }
        )
        self.stdout.write(self.style.SUCCESS(f"Operator {operator.user_id} ready (password: 1234, token: {bot_token[:15]}...)."))

        # 2. Create sample customer Telegram users
        cust1, _ = TelegramUser.objects.update_or_create(
            telegram_id="tg_982341",
            defaults={
                "first_name": "Sarah",
                "last_name": "Connor",
                "username": "sconnor",
                "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
                "is_online": True,
                "last_seen": "online now",
            }
        )

        cust2, _ = TelegramUser.objects.update_or_create(
            telegram_id="tg_541920",
            defaults={
                "first_name": "Alex",
                "last_name": "Mercer",
                "username": "amercer",
                "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
                "is_online": False,
                "last_seen": "12m ago",
            }
        )

        # 3. Create initial sample messages
        if not ChatMessage.objects.filter(to_user="1234").exists():
            ChatMessage.objects.create(
                message_uid="msg_sample_01",
                sender_id="tg_982341",
                sender_name="Sarah Connor",
                to_user="1234",
                message="Hi! I have a question regarding my order shipment.",
                action="send_message",
                is_outgoing=False,
                status="delivered",
            )
            ChatMessage.objects.create(
                message_uid="msg_sample_02",
                sender_id="1234",
                sender_name="CS Support Desk",
                to_user="tg_982341",
                message="Hello Sarah! I would be glad to help you track your order. Could you share your order number?",
                action="send_message",
                is_outgoing=True,
                status="read",
            )

        self.stdout.write(self.style.SUCCESS("Successfully seeded test operator and customer data!"))
