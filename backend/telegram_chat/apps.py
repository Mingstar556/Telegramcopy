import os
import sys
import logging
from django.apps import AppConfig
from django.db.backends.signals import connection_created
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(connection_created)
def configure_sqlite_speed(sender, connection, **kwargs):
    """
    Enables SQLite WAL (Write-Ahead Logging) mode and enterprise high-concurrency PRAGMAs.
    Allows hundreds of concurrent operator reads and writes without database lock contention.
    """
    if connection.vendor == 'sqlite':
        try:
            with connection.cursor() as cursor:
                cursor.execute('PRAGMA journal_mode = WAL;')
                cursor.execute('PRAGMA synchronous = NORMAL;')
                cursor.execute('PRAGMA busy_timeout = 60000;')
                cursor.execute('PRAGMA cache_size = -64000;')
                cursor.execute('PRAGMA temp_store = MEMORY;')
                cursor.execute('PRAGMA mmap_size = 268435456;')
                cursor.execute('PRAGMA foreign_keys = ON;')
        except Exception as e:
            logger.debug(f"[SQLite Config Warning] {e}")


class TelegramChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'telegram_chat'

    def ready(self):
        # Avoid starting poller during migrations or test runner
        is_test = (
            'test' in sys.argv
            or bool(os.environ.get('DJANGO_TEST_MODE'))
            or 'makemigrations' in sys.argv
            or 'migrate' in sys.argv
        )
        if is_test:
            return

        # Under runserver, avoid starting twice in reloader watcher process
        if 'runserver' in sys.argv and os.environ.get('RUN_MAIN') != 'true':
            return

        try:
            import threading
            from .poller import AutoPollerEngine
            # Defer startup by 0.5s to let app registry and DB connection settle cleanly
            threading.Timer(0.5, AutoPollerEngine.start_all).start()
            logger.info("[TelegramChatConfig] High-speed AutoPollerEngine scheduled for active Telegram bots.")
        except Exception as e:
            logger.warning(f"[TelegramChatConfig] Poller startup skipped: {e}")
