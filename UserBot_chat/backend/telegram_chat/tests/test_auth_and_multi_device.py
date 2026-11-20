"""
Automated Local Test Suite: Authentication & Multi-Device Sessions.
Covers Tiers 1-3 for Requirement R1.
100% offline, isolated execution with zero external network dependencies.
"""

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from telegram_chat.models import EmployeeAccount, DeviceSession, BotAccount


class AuthAndMultiDeviceTests(TestCase):
    """
    Test suite for multi-device employee authentication, session issuance,
    independent session lifecycle, and session listing.
    """

    def setUp(self):
        self.client = APIClient()
        self.user_id = "1234"
        self.password = "1234"

        # Seed employee account
        self.employee = EmployeeAccount.objects.create(
            user_id=self.user_id,
            username="Operator John",
            password=self.password,
            role="operator",
            avatar="https://example.com/avatar.png",
            is_active=True,
        )

        # Seed linked bot account
        self.bot = BotAccount.objects.create(
            employee=self.employee,
            user_id=self.user_id,
            password=self.password,
            bot_name="Support Bot Alpha",
            bot_username="support_alpha_bot",
            bot_token="test_mock_token_12345",
            avatar="https://example.com/bot_avatar.png",
            description="Alpha support line",
        )

    # =========================================================================
    # TIER 1: FUNCTIONAL TESTS (Primary Happy Paths)
    # =========================================================================

    def test_tier1_employee_login_success(self):
        """Verify successful employee login returns status, token, session_id, and metadata."""
        payload = {
            "User-ID": self.user_id,
            "password": self.password,
            "device_name": "Office PC",
            "device_type": "desktop",
        }
        response = self.client.post("/api/auth/login/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("User-ID"), self.user_id)
        self.assertTrue(data.get("token", "").startswith("tg_session_token_"))
        self.assertIsNotNone(data.get("session_id"))
        self.assertEqual(data.get("employee_name"), "Operator John")
        self.assertEqual(data.get("bot_name"), "Support Bot Alpha")
        self.assertEqual(data.get("bot_username"), "support_alpha_bot")

    def test_tier1_concurrent_multi_device_login(self):
        """Verify employee can log in concurrently from desktop, tablet, and mobile with distinct tokens."""
        devices = [
            {"device_name": "Workstation", "device_type": "desktop"},
            {"device_name": "iPad Pro", "device_type": "tablet"},
            {"device_name": "iPhone 15", "device_type": "mobile"},
        ]

        tokens = []
        session_ids = []

        for dev in devices:
            payload = {
                "User-ID": self.user_id,
                "password": self.password,
                "device_name": dev["device_name"],
                "device_type": dev["device_type"],
            }
            resp = self.client.post("/api/auth/login/", payload, format="json")
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            self.assertEqual(resp.data.get("status"), "success")
            tokens.append(resp.data.get("token"))
            session_ids.append(resp.data.get("session_id"))

        # Tokens must all be non-empty and unique
        self.assertEqual(len(tokens), 3)
        self.assertEqual(len(set(tokens)), 3, "Concurrent devices must receive unique session tokens")
        self.assertEqual(len(set(session_ids)), 3, "Each login must create a unique session record")

        # Verify all sessions are active in database
        active_count = DeviceSession.objects.filter(employee=self.employee, is_active=True).count()
        self.assertEqual(active_count, 3)

    def test_tier1_device_metadata_tracking(self):
        """Verify session records accurately capture device name, type, user agent, and IP address."""
        payload = {
            "User-ID": self.user_id,
            "password": self.password,
            "device_name": "MacBook Air",
            "device_type": "desktop",
        }
        resp = self.client.post(
            "/api/auth/login/",
            payload,
            format="json",
            HTTP_USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            REMOTE_ADDR="192.168.1.100",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        session_id = resp.data.get("session_id")

        session = DeviceSession.objects.get(id=session_id)
        self.assertEqual(session.device_name, "MacBook Air")
        self.assertEqual(session.device_type, "desktop")
        self.assertIn("Macintosh", session.user_agent)
        self.assertEqual(session.ip_address, "192.168.1.100")
        self.assertTrue(session.is_active)

    def test_tier1_active_sessions_list(self):
        """Verify GET /api/auth/sessions/ returns all active sessions for the operator."""
        # Create 2 sessions
        self.client.post("/api/auth/login/", {"User-ID": self.user_id, "password": self.password, "device_name": "Dev 1"})
        login_resp2 = self.client.post(
            "/api/auth/login/",
            {"User-ID": self.user_id, "password": self.password, "device_name": "Dev 2"}
        )
        current_token = login_resp2.data.get("token")

        # Request session list with token in Authorization header
        resp = self.client.get(
            f"/api/auth/sessions/?User-ID={self.user_id}",
            HTTP_AUTHORIZATION=f"Bearer {current_token}",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        sessions = resp.data
        self.assertEqual(len(sessions), 2)

        # Check fields and is_current flag
        device_names = [s["device_name"] for s in sessions]
        self.assertIn("Dev 1", device_names)
        self.assertIn("Dev 2", device_names)

        current_flags = [s["is_current"] for s in sessions if s["device_name"] == "Dev 2"]
        self.assertTrue(current_flags[0], "Current device must be marked is_current=True")

    def test_tier1_independent_session_revocation(self):
        """Verify logging out on Device A revokes Device A while Device B remains authenticated."""
        resp_a = self.client.post("/api/auth/login/", {"User-ID": self.user_id, "password": self.password, "device_name": "Device A"})
        resp_b = self.client.post("/api/auth/login/", {"User-ID": self.user_id, "password": self.password, "device_name": "Device B"})

        token_a = resp_a.data.get("token")
        token_b = resp_b.data.get("token")

        # Logout on Device A
        logout_resp = self.client.post("/api/auth/logout/", {"session_token": token_a}, format="json")
        self.assertEqual(logout_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(logout_resp.data.get("status"), "logged_out")
        self.assertEqual(logout_resp.data.get("revoked_session"), token_a)

        # Verify in database: Device A is revoked, Device B is still active
        session_a = DeviceSession.objects.get(session_token=token_a)
        session_b = DeviceSession.objects.get(session_token=token_b)

        self.assertFalse(session_a.is_active, "Device A must be revoked")
        self.assertTrue(session_b.is_active, "Device B must remain active")

    def test_tier1_user_profile_endpoint(self):
        """Verify GET /api/user/profile/ returns operator profile."""
        resp = self.client.get(f"/api/user/profile/?User-ID={self.user_id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.data
        self.assertEqual(data.get("User-ID"), self.user_id)
        self.assertEqual(data.get("employee_name"), "Operator John")
        self.assertEqual(data.get("bot_name"), "Support Bot Alpha")
        self.assertIn("connected_at", data)

    # =========================================================================
    # TIER 2: BOUNDARY & CORNER CASES
    # =========================================================================

    def test_tier2_login_invalid_password(self):
        """Verify 401 Unauthorized when password does not match."""
        payload = {"User-ID": self.user_id, "password": "wrong_password"}
        resp = self.client.post("/api/auth/login/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("detail", resp.data)

    def test_tier2_login_nonexistent_user(self):
        """Verify 401 Unauthorized when employee User-ID does not exist."""
        payload = {"User-ID": "nonexistent_9999", "password": "any"}
        resp = self.client.post("/api/auth/login/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tier2_login_missing_user_id(self):
        """Verify 400 Bad Request when User-ID is omitted."""
        payload = {"password": "1234"}
        resp = self.client.post("/api/auth/login/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tier2_login_missing_password(self):
        """Verify 400 Bad Request when password is omitted."""
        payload = {"User-ID": "1234"}
        resp = self.client.post("/api/auth/login/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tier2_login_empty_payload(self):
        """Verify 400 Bad Request on empty JSON payload."""
        resp = self.client.post("/api/auth/login/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tier2_login_inactive_employee(self):
        """Verify 403 Forbidden when employee account is marked inactive."""
        self.employee.is_active = False
        self.employee.save(update_fields=["is_active"])

        payload = {"User-ID": self.user_id, "password": self.password}
        resp = self.client.post("/api/auth/login/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_tier2_login_default_device_fallback(self):
        """Verify default fallback device values when device_name/type are not specified."""
        payload = {"User-ID": self.user_id, "password": self.password}
        resp = self.client.post("/api/auth/login/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        session_id = resp.data.get("session_id")
        session = DeviceSession.objects.get(id=session_id)
        self.assertEqual(session.device_name, "Web Browser")
        self.assertEqual(session.device_type, "desktop")

    def test_tier2_login_mobile_user_agent_detection(self):
        """Verify user agent detection auto-categorizes mobile device when device_name omitted."""
        payload = {"User-ID": self.user_id, "password": self.password}
        resp = self.client.post(
            "/api/auth/login/",
            payload,
            format="json",
            HTTP_USER_AGENT="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        session = DeviceSession.objects.get(id=resp.data.get("session_id"))
        self.assertEqual(session.device_type, "mobile")

    def test_tier2_logout_missing_token(self):
        """Verify 400 Bad Request when logout is called without a session token."""
        resp = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tier2_logout_invalid_token(self):
        """Verify 404 Not Found when attempting to logout with a non-existent token."""
        resp = self.client.post("/api/auth/logout/", {"session_token": "tg_invalid_nonexistent"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_tier2_logout_via_bearer_header(self):
        """Verify logout succeeds when session token is provided via Authorization Bearer header."""
        login_resp = self.client.post("/api/auth/login/", {"User-ID": self.user_id, "password": self.password})
        token = login_resp.data.get("token")

        logout_resp = self.client.post(
            "/api/auth/logout/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(logout_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(logout_resp.data.get("status"), "logged_out")

        # Session should be revoked
        session = DeviceSession.objects.get(session_token=token)
        self.assertFalse(session.is_active)

    def test_tier2_sessions_list_unauthorized(self):
        """Verify 401 Unauthorized when requesting sessions without credentials."""
        resp = self.client.get("/api/auth/sessions/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tier2_sessions_list_nonexistent_user(self):
        """Verify 401 Unauthorized when requesting sessions with an unknown User-ID."""
        resp = self.client.get("/api/auth/sessions/?User-ID=nonexistent_9999")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tier2_sessions_list_mismatched_user_id(self):
        """Verify 401 Unauthorized when requesting sessions of user B with token belonging to user A."""
        login_resp = self.client.post("/api/auth/login/", {"User-ID": self.user_id, "password": self.password})
        token = login_resp.data.get("token")
        resp = self.client.get(
            "/api/auth/sessions/?User-ID=other_victim_user",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # =========================================================================
    # TIER 3: CROSS-FEATURE PAIRWISE TESTS
    # =========================================================================

    def test_tier3_session_revocation_excludes_from_active_list(self):
        """Verify revoked sessions are automatically excluded from GET /api/auth/sessions/."""
        resp1 = self.client.post("/api/auth/login/", {"User-ID": self.user_id, "password": self.password, "device_name": "Device 1"})
        resp2 = self.client.post("/api/auth/login/", {"User-ID": self.user_id, "password": self.password, "device_name": "Device 2"})

        token1 = resp1.data.get("token")
        token2 = resp2.data.get("token")

        # Revoke Device 1
        self.client.post("/api/auth/logout/", {"session_token": token1})

        # List active sessions
        list_resp = self.client.get(
            f"/api/auth/sessions/?User-ID={self.user_id}",
            HTTP_AUTHORIZATION=f"Bearer {token2}",
        )
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        active_sessions = list_resp.data

        self.assertEqual(len(active_sessions), 1)
        self.assertEqual(active_sessions[0]["device_name"], "Device 2")

    def test_tier3_multi_user_session_isolation(self):
        """Verify sessions of Operator A and Operator B are strictly isolated."""
        # Create second employee
        emp2 = EmployeeAccount.objects.create(
            user_id="5678",
            username="Operator Sarah",
            password="secret_password",
            role="operator",
            is_active=True,
        )

        # Login both operators
        resp_a = self.client.post("/api/auth/login/", {"User-ID": self.user_id, "password": self.password, "device_name": "Op A Phone"})
        resp_b = self.client.post("/api/auth/login/", {"User-ID": "5678", "password": "secret_password", "device_name": "Op B Laptop"})

        token_a = resp_a.data.get("token")
        token_b = resp_b.data.get("token")

        # Op A checks sessions -> only sees Op A's session
        list_a = self.client.get(
            f"/api/auth/sessions/?User-ID={self.user_id}",
            HTTP_AUTHORIZATION=f"Bearer {token_a}",
        )
        self.assertEqual(len(list_a.data), 1)
        self.assertEqual(list_a.data[0]["device_name"], "Op A Phone")

        # Op B checks sessions -> only sees Op B's session
        list_b = self.client.get(
            "/api/auth/sessions/?User-ID=5678",
            HTTP_AUTHORIZATION=f"Bearer {token_b}",
        )
        self.assertEqual(len(list_b.data), 1)
        self.assertEqual(list_b.data[0]["device_name"], "Op B Laptop")

        # Revoking Op A does not touch Op B
        self.client.post("/api/auth/logout/", {"session_token": token_a})
        self.assertTrue(DeviceSession.objects.get(session_token=token_b).is_active)
        self.assertFalse(DeviceSession.objects.get(session_token=token_a).is_active)
