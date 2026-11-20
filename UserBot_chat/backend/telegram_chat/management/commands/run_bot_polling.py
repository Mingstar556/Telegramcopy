import time
import requests
import logging
from django.core.management.base import BaseCommand
from telegram_chat.models import BotAccount
from telegram_chat.bot_service import TelegramBotGateway

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Runs long-polling update worker for an operator Telegram bot (for local development without webhooks)'

    def add_arguments(self, parser):
        parser.add_argument('--user-id', type=str, default='1234', help='Operator User-ID to poll for')

    def handle(self, *args, **options):
        user_id = options['user_id']
        try:
            bot = BotAccount.objects.get(user_id=user_id)
        except BotAccount.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Bot account for operator {user_id} not found."))
            return

        token = bot.bot_token
        if not token:
            self.stdout.write(self.style.WARNING(f"Operator {user_id} does not have a bot_token set. Add your token in Django admin or database."))
            return

        self.stdout.write(self.style.SUCCESS(f"Starting long polling worker for operator {user_id} (@{bot.bot_username})..."))
        offset = None

        while True:
            try:
                params = {'timeout': 20}
                if offset:
                    params['offset'] = offset

                url = f"https://api.telegram.org/bot{token}/getUpdates"
                res = requests.get(url, params=params, timeout=25)
                data = res.json()

                if data.get('ok'):
                    for update in data.get('result', []):
                        update_id = update['update_id']
                        offset = update_id + 1
                        TelegramBotGateway.handle_incoming_telegram_update(user_id, update)
                        self.stdout.write(self.style.SUCCESS(f"Processed update {update_id}"))
                time.sleep(1)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Polling error: {e}"))
                time.sleep(3)
