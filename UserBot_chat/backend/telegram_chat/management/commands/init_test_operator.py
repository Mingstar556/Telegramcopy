import os
from django.core.management.base import BaseCommand
from telegram_chat.models import EmployeeAccount, BotAccount, TelegramUser, ChatMessage


class Command(BaseCommand):
    help = 'Seeds initial test operator accounts and bots for ah fu, Bingo, and mrlioma'

    def handle(self, *args, **options):
        # Configuration for the 3 demo accounts hooked up to the 3 Telegram bots
        bot_configs = [
            {
                "user_id": os.environ.get("BOT1_USER_ID", "ahfu"),
                "password": os.environ.get("BOT1_PASSWORD", "ahfu1234"),
                "bot_name": os.environ.get("BOT1_NAME", "ah fu"),
                "bot_username": "Ah_fu_bot",
                "bot_token": os.environ.get("BOT1_TOKEN", "9197397912:AAHC1HOhNvV-exC9uzRBsHZ6BJbmTFEoXyo"),
                "avatar": "/media/bot_avatars/ahfu_avatar.jpg",
            },
            {
                "user_id": os.environ.get("BOT2_USER_ID", "bingo"),
                "password": os.environ.get("BOT2_PASSWORD", "bingo1234"),
                "bot_name": os.environ.get("BOT2_NAME", "Bingo"),
                "bot_username": "mr_Bingoobot",
                "bot_token": os.environ.get("BOT2_TOKEN", "9273467556:AAGsimmiJEQIoiuep62Xtuw_VcXOzaHWB3U"),
                "avatar": "/media/bot_avatars/bingo_avatar.jpg",
            },
            {
                "user_id": os.environ.get("BOT3_USER_ID", "mrlioma"),
                "password": os.environ.get("BOT3_PASSWORD", "mrlioma1234"),
                "bot_name": os.environ.get("BOT3_NAME", "mrlioma"),
                "bot_username": "mrlionabot",
                "bot_token": os.environ.get("BOT3_TOKEN", "9020018332:AAHLzQTJ04TUzqWOx5x-k8ydYRRQCOKBvQ0"),
                "avatar": "/media/bot_avatars/mrlioma_avatar.jpg",
            },
            # Default backward-compatible operator 1234
            {
                "user_id": "1234",
                "password": "1234",
                "bot_name": "kjel tv rean",
                "bot_username": "anhkjeltvrean_bot",
                "bot_token": os.environ.get("BOT1_TOKEN", "9197397912:AAHC1HOhNvV-exC9uzRBsHZ6BJbmTFEoXyo"),
                "avatar": "/media/bot_avatars/ahfu_avatar.jpg",
            }
        ]

        for cfg in bot_configs:
            # 1. Create or update EmployeeAccount
            employee, _ = EmployeeAccount.objects.update_or_create(
                user_id=cfg["user_id"],
                defaults={
                    "username": cfg["bot_name"],
                    "password": cfg["password"],
                    "role": "operator",
                    "avatar": cfg["avatar"],
                    "is_active": True,
                }
            )

            # 2. Create or update BotAccount linked to employee
            operator, _ = BotAccount.objects.update_or_create(
                user_id=cfg["user_id"],
                defaults={
                    "employee": employee,
                    "password": cfg["password"],
                    "bot_name": cfg["bot_name"],
                    "bot_username": cfg["bot_username"],
                    "bot_token": cfg["bot_token"],
                    "description": f"Dedicated Telegram Bot operator account for {cfg['bot_name']}.",
                    "avatar": cfg["avatar"],
                }
            )
            self.stdout.write(self.style.SUCCESS(
                f"Configured: User ID: '{cfg['user_id']}' | Password: '{cfg['password']}' | Bot: '{cfg['bot_name']}'"
            ))

        # 3. Create sample customer Telegram users
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

        # 4. Seed sample messages for user 1234
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

        self.stdout.write(self.style.SUCCESS("Successfully seeded all 3 demo accounts and linked Telegram bots!"))
