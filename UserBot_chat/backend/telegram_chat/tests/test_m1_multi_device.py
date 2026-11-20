import json
from django.test import TestCase, TransactionTestCase
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework import status
from channels.testing import WebsocketCommunicator

from telegram_chat.models import EmployeeAccount, DeviceSession, BotAccount, TelegramUser, ChatMessage
from backend.asgi import application


class ModelSchemaTests(TestCase):
    def setUp(self):
        self.employee = EmployeeAccount.objects.create(
            user_id="emp_001",
            username="Alice Smith",
            password="securepassword",
            role="operator",
            avatar="https://example.com/avatar.jpg",
            is_active=True
        )

    def test_employee_account_creation(self):
        self.assertEqual(self.employee.user_id, "emp_001")
        self.assertEqual(self.employee.username, "Alice Smith")
        self.assertTrue(self.employee.is_active)
        self.assertEqual(str(self.employee), "Alice Smith (emp_001)")

    def test_device_session_creation_and_revocation(self):
        session = DeviceSession.create_session(
            employee=self.employee,
            device_name="Chrome on Windows",
            device_type="desktop",
            user_agent="Mozilla/5.0 Windows",
            ip_address="192.168.1.50"
        )
        self.assertTrue(session.session_token.startswith("tg_session_token_"))
        self.assertTrue(session.is_active)
        self.assertEqual(session.device_name, "Chrome on Windows")
        self.assertEqual(session.device_type, "desktop")
        self.assertEqual(session.ip_address, "192.168.1.50")

        # Test active_sessions property
        self.assertEqual(self.employee.active_sessions.count(), 1)

        # Test revocation
        session.revoke()
        session.refresh_from_db()
        self.assertFalse(session.is_active)
        self.assertEqual(self.employee.active_sessions.count(), 0)

    def test_cascade_delete_sessions_when_employee_deleted(self):
        session = DeviceSession.create_session(employee=self.employee, device_name="Device 1")
        self.assertEqual(DeviceSession.objects.filter(employee=self.employee).count(), 1)
        self.employee.delete()
        self.assertEqual(DeviceSession.objects.filter(id=session.id).count(), 0)

    def test_bot_account_linkage(self):
        bot = BotAccount.objects.create(
            employee=self.employee,
            user_id="emp_001",
            password="securepassword",
            bot_name="Test Bot",
            bot_username="test_bot",
            bot_token="fake_token_123"
        )
        self.assertEqual(bot.employee, self.employee)
        self.assertEqual(self.employee.bot_accounts.first(), bot)


class AuthEndpointsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.employee = EmployeeAccount.objects.create(
            user_id="1234",
            username="Operator",
            password="password123",
            role="operator",
            avatar="https://example.com/op.jpg",
            is_active=True
        )
        self.bot = BotAccount.objects.create(
            employee=self.employee,
            user_id="1234",
            password="password123",
            bot_name="kjel tv rean",
            bot_username="anhkjeltvrean_bot",
            bot_token="test_token",
            description="Operator bot account"
        )

    def test_login_missing_credentials(self):
        res = self.client.post('/api/auth/login/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_invalid_password(self):
        res = self.client.post('/api/auth/login/', {'User-ID': '1234', 'password': 'wrongpassword'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_user_not_found(self):
        res = self.client.post('/api/auth/login/', {'User-ID': '9999', 'password': 'password123'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_inactive_employee(self):
        self.employee.is_active = False
        self.employee.save()
        res = self.client.post('/api/auth/login/', {'User-ID': '1234', 'password': 'password123'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_login_success_and_response_keys(self):
        res = self.client.post(
            '/api/auth/login/',
            {
                'User-ID': '1234',
                'password': 'password123',
                'device_name': 'MacBook Pro',
                'device_type': 'desktop'
            },
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()

        # Check required interface contract keys
        self.assertEqual(data.get('status'), 'success')
        self.assertEqual(data.get('User-ID'), '1234')
        self.assertTrue(data.get('token', '').startswith('tg_session_token_'))
        self.assertIsInstance(data.get('session_id'), int)
        self.assertEqual(data.get('employee_name'), 'Operator')
        self.assertEqual(data.get('bot_name'), 'kjel tv rean')
        self.assertEqual(data.get('bot_username'), 'anhkjeltvrean_bot')
        self.assertEqual(data.get('avatar'), 'https://example.com/op.jpg')
        self.assertEqual(data.get('description'), 'Operator bot account')

        # Check that DeviceSession was created in DB
        session = DeviceSession.objects.get(id=data['session_id'])
        self.assertEqual(session.session_token, data['token'])
        self.assertEqual(session.device_name, 'MacBook Pro')
        self.assertEqual(session.device_type, 'desktop')
        self.assertTrue(session.is_active)

    def test_login_fallback_from_bot_account(self):
        # Create legacy BotAccount without EmployeeAccount
        BotAccount.objects.create(
            user_id="legacy_bot",
            password="botpass123",
            bot_name="Legacy Bot",
            bot_username="legacy_bot"
        )
        res = self.client.post(
            '/api/auth/login/',
            {'User-ID': 'legacy_bot', 'password': 'botpass123'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Verify employee was auto-created
        emp = EmployeeAccount.objects.filter(user_id='legacy_bot').first()
        self.assertIsNotNone(emp)
        self.assertEqual(emp.username, 'Legacy Bot')


class MultiDeviceConcurrentSessionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.employee = EmployeeAccount.objects.create(
            user_id="1234",
            username="Operator",
            password="1234",
            role="operator",
            is_active=True
        )
        self.bot = BotAccount.objects.create(
            employee=self.employee,
            user_id="1234",
            password="1234",
            bot_name="kjel tv rean",
            bot_username="anhkjeltvrean_bot"
        )

    def test_concurrent_multi_device_workflow(self):
        # 1. Login with 1234/1234 on Device A
        res_a = self.client.post(
            '/api/auth/login/',
            {
                'User-ID': '1234',
                'password': '1234',
                'device_name': 'Desktop Workstation',
                'device_type': 'desktop'
            },
            format='json',
            HTTP_USER_AGENT='Mozilla/5.0 Windows NT 10.0',
            REMOTE_ADDR='10.0.0.1'
        )
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)
        data_a = res_a.json()
        token_a = data_a['token']
        session_id_a = data_a['session_id']

        # 2. Login with 1234/1234 on Device B
        res_b = self.client.post(
            '/api/auth/login/',
            {
                'User-ID': '1234',
                'password': '1234',
                'device_name': 'iPhone Safari',
                'device_type': 'mobile'
            },
            format='json',
            HTTP_USER_AGENT='Mozilla/5.0 iPhone; CPU iPhone OS',
            REMOTE_ADDR='10.0.0.2'
        )
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        data_b = res_b.json()
        token_b = data_b['token']
        session_id_b = data_b['session_id']

        # Tokens and session IDs must be unique
        self.assertNotEqual(token_a, token_b)
        self.assertNotEqual(session_id_a, session_id_b)

        # 3. Verify both sessions are active concurrently in /api/auth/sessions/
        res_sessions = self.client.get(
            '/api/auth/sessions/?User-ID=1234',
            HTTP_AUTHORIZATION=f'Bearer {token_a}'
        )
        self.assertEqual(res_sessions.status_code, status.HTTP_200_OK)
        sessions_list = res_sessions.json()
        self.assertEqual(len(sessions_list), 2)
        session_ids = [s['session_id'] for s in sessions_list]
        self.assertIn(session_id_a, session_ids)
        self.assertIn(session_id_b, session_ids)

        # Check current flag when authenticated as Device A
        res_sess_a = self.client.get(
            f'/api/auth/sessions/?token={token_a}'
        )
        self.assertEqual(res_sess_a.status_code, status.HTTP_200_OK)
        sessions_a_view = res_sess_a.json()
        curr_session_a = next(s for s in sessions_a_view if s['session_id'] == session_id_a)
        other_session_b = next(s for s in sessions_a_view if s['session_id'] == session_id_b)
        self.assertTrue(curr_session_a['is_current'])
        self.assertFalse(other_session_b['is_current'])

        # 4. Logout with session token A -> only session A is deactivated, session B remains active
        res_logout = self.client.post(
            '/api/auth/logout/',
            {'session_token': token_a},
            format='json'
        )
        self.assertEqual(res_logout.status_code, status.HTTP_200_OK)
        self.assertEqual(res_logout.json(), {
            "status": "logged_out",
            "revoked_session": token_a
        })

        # Verify in DB: session A inactive, session B active
        sess_a_db = DeviceSession.objects.get(id=session_id_a)
        sess_b_db = DeviceSession.objects.get(id=session_id_b)
        self.assertFalse(sess_a_db.is_active)
        self.assertTrue(sess_b_db.is_active)

        # Verify in active sessions view: only 1 session left (session B)
        res_sessions_after = self.client.get(
            '/api/auth/sessions/?User-ID=1234',
            HTTP_AUTHORIZATION=f'Bearer {token_b}'
        )
        self.assertEqual(res_sessions_after.status_code, status.HTTP_200_OK)
        active_list_after = res_sessions_after.json()
        self.assertEqual(len(active_list_after), 1)
        self.assertEqual(active_list_after[0]['session_id'], session_id_b)

    def test_logout_bearer_header(self):
        session = DeviceSession.create_session(employee=self.employee, device_name="Device C")
        res = self.client.post(
            '/api/auth/logout/',
            {},
            HTTP_AUTHORIZATION=f'Bearer {session.session_token}'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertFalse(session.is_active)

    def test_logout_nonexistent_session(self):
        res = self.client.post(
            '/api/auth/logout/',
            {'session_token': 'tg_session_token_nonexistent'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


class WebSocketConsumerTests(TransactionTestCase):
    def setUp(self):
        self.employee = EmployeeAccount.objects.create(
            user_id="1234",
            username="Operator",
            password="1234",
            role="operator",
            is_active=True
        )
        self.session = DeviceSession.create_session(
            employee=self.employee,
            device_name="Web Browser"
        )

    async def test_websocket_connect_with_valid_session_token(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/?token={self.session.session_token}"
        )
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_websocket_connect_with_invalid_session_token(self):
        communicator = WebsocketCommunicator(
            application,
            "/ws/chat/?token=tg_session_token_invalid_12345"
        )
        connected, subprotocol = await communicator.connect()
        # Should be rejected
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_websocket_connect_without_token_rejected(self):
        communicator = WebsocketCommunicator(
            application,
            "/ws/chat/?user_id=1234"
        )
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()


class OperatorSeedingTests(TestCase):
    def test_init_test_operator_command(self):
        call_command('init_test_operator')

        # Check employee created
        employee = EmployeeAccount.objects.filter(user_id="1234").first()
        self.assertIsNotNone(employee)
        self.assertEqual(employee.password, "1234")

        # Check bot linked
        bot = BotAccount.objects.filter(user_id="1234").first()
        self.assertIsNotNone(bot)
        self.assertEqual(bot.employee, employee)

        # Check customers
        self.assertTrue(TelegramUser.objects.filter(telegram_id="tg_982341").exists())
        self.assertTrue(TelegramUser.objects.filter(telegram_id="tg_541920").exists())

        # Check messages
        self.assertTrue(ChatMessage.objects.filter(to_user="1234").exists())
