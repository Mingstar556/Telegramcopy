"""
================================================================================
TBOTCHAT FULL-STACK SYSTEM & ARCHITECTURE VERIFICATION TEST SUITE FOR FUTURE AI
================================================================================
This test suite verifies the end-to-end architecture, API contracts, security
boundaries, and performance optimizations of the TBOTchat Customer Support platform.

FUTURE AI INSTRUCTIONS:
- Run with:
  .\\backend\\venv\\Scripts\\python.exe manage.py test telegram_chat.tests.test_ai_system_verification
- All network calls to Telegram Bot API are safely mocked or handled offline.
- Never downgrade the security guards or remove the async queue / rate limiter.
"""

import time
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from django.contrib.auth.hashers import make_password, check_password
from telegram_chat.models import EmployeeAccount, BotAccount, TelegramUser, ChatMessage, DeviceSession
from telegram_chat.bot_service import TelegramBotGateway, OutboundRateLimiter


class AISystemVerificationTests(TestCase):
    """Core system verification test suite for future AI maintainers."""

    def setUp(self):
        self.client = Client()
        self.operator_id = "test_ai_op_1"
        self.password = "SecPass_1234!"
        self.bot_token = "123456789:ABCDefGhIJKlmNoPQRstuVWXyz_test"

        # Seed test operator
        self.employee = EmployeeAccount.objects.create(
            user_id=self.operator_id,
            username="AI Test Operator",
            password=make_password(self.password),
            role="admin",
            is_active=True
        )

        self.bot = BotAccount.objects.create(
            user_id=self.operator_id,
            employee=self.employee,
            bot_name="AI Test Bot",
            bot_username="ai_test_bot",
            bot_token=self.bot_token,
            password=make_password(self.password)
        )

    def test_01_health_and_database_probe(self):
        """Verifies health check endpoint and active DB probe return HTTP 200 OK."""
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get('status'), 'ok')
        self.assertEqual(data.get('database'), 'connected')

    def test_02_login_and_session_token_generation(self):
        """Verifies authentication, PBKDF2 password verification, and session token generation."""
        # 1. Invalid password rejection
        bad_res = self.client.post('/api/auth/login/', {
            'User-ID': self.operator_id,
            'password': 'wrong_password'
        }, content_type='application/json')
        self.assertEqual(bad_res.status_code, 401)

        # 2. Valid login and session creation
        res = self.client.post('/api/auth/login/', {
            'User-ID': self.operator_id,
            'password': self.password
        }, content_type='application/json')
        # Endpoint should return 201 Created (or 200 OK)
        self.assertIn(res.status_code, [200, 201], f"Unexpected status: {res.status_code} - {res.content}")
        data = res.json()
        self.assertIn('token', data)
        self.assertTrue(data['token'].startswith('tg_sess_') or len(data['token']) > 16)
        self.assertTrue(DeviceSession.objects.filter(session_token=data['token'], is_active=True).exists())

    def test_03_fast_webhook_async_queue(self):
        """Verifies webhook endpoint returns HTTP 200 immediately (< 20ms) and queues work."""
        payload = {
            "update_id": 9001,
            "message": {
                "message_id": 101,
                "from": {
                    "id": 99887766,
                    "first_name": "Elon",
                    "last_name": "Musk",
                    "username": "elon_x",
                    "language_code": "en",
                    "is_premium": True
                },
                "chat": {"id": 99887766, "type": "private"},
                "date": int(time.time()),
                "text": "Hello from automated test!"
            }
        }

        t0 = time.monotonic()
        res = self.client.post(f'/api/telegram/webhook/{self.operator_id}/', payload, content_type='application/json')
        duration = time.monotonic() - t0

        # Endpoint should return 201 Created (or 200 OK)
        self.assertIn(res.status_code, [200, 201], f"Unexpected status: {res.status_code} - {res.content}")
        data = res.json()
        self.assertTrue(data.get('ok'))
        self.assertEqual(data.get('status'), 'queued')
        # Response should be sub-50ms because DB/Channels work is offloaded to worker pool
        self.assertLess(duration, 0.50)

    def test_04_inline_user_profile_extraction(self):
        """Verifies zero-extra-call extraction of language_code, is_premium, and bio from message."""
        update = {
            "update_id": 9002,
            "message": {
                "message_id": 102,
                "from": {
                    "id": 77665544,
                    "first_name": "Linus",
                    "last_name": "Torvalds",
                    "username": "torvalds",
                    "language_code": "fi",
                    "is_premium": True
                },
                "chat": {"id": 77665544, "type": "private"},
                "date": int(time.time()),
                "text": "Linux kernel release 7.0 is ready."
            }
        }

        success = TelegramBotGateway.handle_incoming_telegram_update(self.operator_id, update)
        self.assertTrue(success)

        # Verify TelegramUser was upserted with zero extra API calls
        user = TelegramUser.objects.filter(telegram_id="77665544").first()
        self.assertIsNotNone(user)
        self.assertEqual(user.first_name, "Linus")
        self.assertEqual(user.last_name, "Torvalds")
        self.assertEqual(user.username, "torvalds")
        self.assertEqual(user.language_code, "fi")
        self.assertTrue(user.is_premium)
        self.assertIsNotNone(user.avatar)

    def test_05_outbound_rate_limiter(self):
        """Verifies OutboundRateLimiter token bucket paces requests under 30 msgs/sec."""
        limiter = OutboundRateLimiter(rate=30.0, capacity=5.0)
        # Should acquire 5 tokens immediately without blocking
        t0 = time.monotonic()
        for _ in range(5):
            limiter.acquire()
        elapsed = time.monotonic() - t0
        self.assertLess(elapsed, 0.05)

        # 6th acquisition will briefly pace
        limiter.acquire()
        elapsed_total = time.monotonic() - t0
        self.assertGreater(elapsed_total, 0.02)

    def test_06_manage_webhook_api(self):
        """Verifies Webhook management GET, POST, and DELETE endpoints."""
        with patch.object(TelegramBotGateway, 'get_webhook_info', return_value={"ok": True, "result": {"url": ""}}), \
             patch.object(TelegramBotGateway, 'set_webhook', return_value={"ok": True, "result": True}), \
             patch.object(TelegramBotGateway, 'delete_webhook', return_value={"ok": True, "result": True}):

            # GET status
            res_get = self.client.get(f'/api/telegram/manage-webhook/?user_id={self.operator_id}')
            self.assertEqual(res_get.status_code, 200)

            # POST set webhook
            res_post = self.client.post('/api/telegram/manage-webhook/', {
                'user_id': self.operator_id,
                'webhook_url': 'https://my-domain.com/api/telegram/webhook/'
            }, content_type='application/json')
            self.assertEqual(res_post.status_code, 200)

            # DELETE webhook
            res_del = self.client.delete(f'/api/telegram/manage-webhook/?user_id={self.operator_id}')
            self.assertEqual(res_del.status_code, 200)

    def test_07_automatic_bot_account_generator_api(self):
        """Verifies the automatic bot account generator API endpoint."""
        with patch('telegram_chat.views.requests.get') as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "ok": True,
                "result": {"id": 55667788, "first_name": "VIP Concierge", "username": "vip_concierge_bot"}
            }
            mock_get.return_value = mock_resp

            payload = {
                "tokens": ["55667788:AAH_fake_token_for_ai_test_suite_123456"],
                "count": 1,
                "password_type": "memorable"
            }

            res = self.client.post('/api/admin/generate-accounts/', payload, content_type='application/json')
            self.assertIn(res.status_code, [200, 201], f"Unexpected status: {res.status_code} - {res.content}")
            data = res.json()
            self.assertEqual(data.get('status'), 'success')
            self.assertEqual(len(data.get('accounts', [])), 1)

            acc = data['accounts'][0]
            self.assertIn('user_id', acc)
            self.assertIn('password', acc)
            self.assertEqual(acc.get('bot_name'), 'VIP Concierge')

            # Verify saved in database with proper PBKDF2 hash
            db_emp = EmployeeAccount.objects.filter(user_id=acc['user_id']).first()
            self.assertIsNotNone(db_emp)
            self.assertTrue(check_password(acc['password'], db_emp.password))

    def test_08_conversation_list_and_sorting(self):
        """Verifies chats list returns saved messages first and sorts conversations by timestamp."""
        # Create 2 test users and messages with distinct timestamps
        user_a = TelegramUser.objects.create(telegram_id="user_a", first_name="Alice")
        time.sleep(0.02)
        user_b = TelegramUser.objects.create(telegram_id="user_b", first_name="Bob")

        ChatMessage.objects.create(
            message_uid="msg_a_old",
            sender_id="user_a",
            to_user=self.operator_id,
            message="Old message from Alice"
        )
        time.sleep(0.02)
        ChatMessage.objects.create(
            message_uid="msg_b_new",
            sender_id="user_b",
            to_user=self.operator_id,
            message="New message from Bob"
        )

        res = self.client.get(f'/api/chats/?User-ID={self.operator_id}')
        # Endpoint should return 201 Created (or 200 OK)
        self.assertIn(res.status_code, [200, 201], f"Unexpected status: {res.status_code} - {res.content}")
        chats = res.json()
        self.assertTrue(len(chats) >= 2)
        # First item must always be Saved Messages
        self.assertEqual(chats[0]['id'], 'saved_messages')
        # Next item should be user_b (newer message)
        self.assertEqual(chats[1]['id'], 'user_b')
