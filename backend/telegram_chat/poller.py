import os
import sys
import time
import json
import logging
import threading
from typing import Dict, Optional, Set
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from django.conf import settings

logger = logging.getLogger(__name__)
TELEGRAM_API_BASE = "https://api.telegram.org"


class BotPollerThread(threading.Thread):
    """
    Dedicated background long-polling daemon for an operator Telegram Bot.
    Uses persistent HTTP keep-alive connection with Telegram long polling (timeout=20s).
    Dispatches incoming updates to Django and WebSockets with sub-50ms latency.
    """
    def __init__(self, user_id: str, bot_token: str):
        super().__init__(name=f"BotPoller-{user_id}", daemon=True)
        self.user_id = str(user_id)
        self.bot_token = bot_token
        self.stop_event = threading.Event()
        from .bot_service import TelegramBotGateway
        self.last_update_id = TelegramBotGateway._last_update_ids.get(bot_token, TelegramBotGateway._last_update_id)
        self.session = self._create_session()

    def _create_session(self) -> requests.Session:
        session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=0.3,
            status_forcelist=[500, 502, 503, 504],
            raise_on_status=False
        )
        adapter = HTTPAdapter(pool_connections=5, pool_maxsize=10, max_retries=retries)
        session.mount('https://', adapter)
        session.mount('http://', adapter)
        return session

    def stop(self):
        self.stop_event.set()

    def run(self):
        from .bot_service import TelegramBotGateway
        logger.info(f"[AutoPoller] Started high-speed background poller for operator {self.user_id}")
        
        # Staggered start to prevent thundering herd
        time.sleep(0.2)

        while not self.stop_event.is_set():
            try:
                params = {
                    'timeout': 25,
                    'allowed_updates': json.dumps(["message", "edited_message", "callback_query", "channel_post", "edited_channel_post"])
                }
                if self.last_update_id > 0:
                    params['offset'] = self.last_update_id + 1

                url = f"{TELEGRAM_API_BASE}/bot{self.bot_token}/getUpdates"
                res = self.session.get(url, params=params, timeout=35)

                if res.status_code == 200:
                    data = res.json()
                    if data.get('ok'):
                        updates = data.get('result', [])
                        for update in updates:
                            if not isinstance(update, dict):
                                continue
                            up_id = update.get('update_id')
                            if up_id is not None and isinstance(up_id, int):
                                if up_id > self.last_update_id:
                                    self.last_update_id = up_id
                                    TelegramBotGateway._last_update_ids[self.bot_token] = up_id
                                    TelegramBotGateway._last_update_id = max(TelegramBotGateway._last_update_id, up_id)

                            try:
                                from .models import BotAccount
                                ops = list(BotAccount.objects.filter(bot_token=self.bot_token).values_list('user_id', flat=True))
                                target_op = self.user_id if self.user_id in ops else (ops[0] if ops else self.user_id)
                                TelegramBotGateway.handle_incoming_telegram_update(target_op, update)
                            except Exception as up_err:
                                logger.error(f"[AutoPoller] Error processing update {up_id} for {self.user_id}: {up_err}")
                elif res.status_code == 409:
                    # Concurrency or active webhook
                    logger.info(f"[AutoPoller] getUpdates returned 409 Conflict for {self.user_id}. Backing off 3s...")
                    self.stop_event.wait(3)
                elif res.status_code in (401, 404):
                    logger.warning(f"[AutoPoller] Invalid or revoked bot token for operator {self.user_id}. Sleeping 30s...")
                    self.stop_event.wait(30)
                else:
                    logger.warning(f"[AutoPoller] Unexpected Telegram response ({res.status_code}) for {self.user_id}")
                    self.stop_event.wait(2)

            except requests.exceptions.Timeout:
                # Normal long-polling cycle completed with no updates; immediately reconnect
                continue
            except requests.exceptions.RequestException as req_err:
                # Network hiccup or DNS glitch; brief backoff then retry
                logger.debug(f"[AutoPoller] Network hiccup for {self.user_id}: {req_err}")
                self.stop_event.wait(2)
            except Exception as e:
                logger.error(f"[AutoPoller] Unexpected error in poller {self.user_id}: {e}")
                self.stop_event.wait(2)

        try:
            self.session.close()
        except Exception:
            pass
        logger.info(f"[AutoPoller] Poller thread for operator {self.user_id} stopped.")


class AutoPollerEngine:
    """
    Singleton manager managing background long-polling workers across all active bot accounts.
    Guarantees instant message reception from Telegram without requiring external webhooks.
    Deduplicates workers by bot_token so only ONE thread polls Telegram per token, preventing 409 conflicts.
    """
    _lock = threading.Lock()
    _pollers: Dict[str, BotPollerThread] = {}
    _running = False

    @classmethod
    def _is_test_mode(cls) -> bool:
        return (
            'test' in sys.argv
            or getattr(settings, 'TESTING', False)
            or bool(os.environ.get('DJANGO_TEST_MODE'))
        )

    @classmethod
    def start_all(cls):
        """Start pollers for all configured BotAccounts with a bot_token (deduplicated by token)."""
        if cls._is_test_mode():
            return

        with cls._lock:
            cls._running = True
            from .models import BotAccount
            try:
                bots = BotAccount.objects.exclude(bot_token__isnull=True).exclude(bot_token="")
                for bot in bots:
                    cls._ensure_bot_thread_locked(bot.user_id, bot.bot_token)
            except Exception as e:
                logger.warning(f"[AutoPollerEngine] Could not load bot accounts for auto-poller: {e}")

    @classmethod
    def ensure_bot_polling(cls, user_id: str):
        """Ensure a poller is running for the specified operator User-ID."""
        if cls._is_test_mode() or not user_id:
            return

        with cls._lock:
            from .models import BotAccount
            try:
                bot = BotAccount.objects.filter(user_id=str(user_id)).first()
                if not bot:
                    bot = BotAccount.objects.filter(employee__user_id=str(user_id)).first()
                if bot and bot.bot_token:
                    cls._ensure_bot_thread_locked(bot.user_id, bot.bot_token)
            except Exception as e:
                logger.warning(f"[AutoPollerEngine] Failed to initialize poller for {user_id}: {e}")

    @classmethod
    def _ensure_bot_thread_locked(cls, user_id: str, bot_token: str):
        if not bot_token:
            return
        token_key = str(bot_token).strip()
        existing = cls._pollers.get(token_key)
        if existing and existing.is_alive():
            return

        thread = BotPollerThread(user_id=user_id, bot_token=token_key)
        cls._pollers[token_key] = thread
        cls._pollers[str(user_id)] = thread
        thread.start()

    @classmethod
    def stop_all(cls):
        """Stop all background poller threads."""
        with cls._lock:
            cls._running = False
            for token_or_user, poller in list(cls._pollers.items()):
                poller.stop()
            cls._pollers.clear()
