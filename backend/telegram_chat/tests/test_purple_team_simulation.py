"""
Purple Team Adversary Emulation & Blue Team Defense Test Suite.
Simulates real-world attack scenarios across 5 distinct threat vectors:
1. Stealing API Keys / Credentials (T1552, T1528)
2. Breaking the Link / DoS / Service Disruption (T1498, T1499)
3. Stealing the Database / Unauthorized Exfiltration (T1005, T1083)
4. Changing ABA Pay Code / Payment Hijacking (T1565.001, T1565.002)
5. Sending Malicious Links / Phishing & XSS in Chat (T1204.001, T1059.007)
"""

import json
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status

from telegram_chat.models import EmployeeAccount, DeviceSession, BotAccount, TelegramUser, ChatMessage
from telegram_chat.security import SecurityGuard, mask_sensitive_token, sanitize_log_output, get_approved_aba_accounts


class PurpleTeamSimulationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.operator_id = "op_sec_01"
        self.victim_client_id = "client_yeak_99"

        self.employee = EmployeeAccount.objects.create(
            user_id=self.operator_id,
            username="Security Analyst",
            password="pbkdf2_sha256$hashed_secure_pass",
            role="operator",
        )
        self.bot = BotAccount.objects.create(
            employee=self.employee,
            user_id=self.operator_id,
            password="pbkdf2_sha256$hashed_secure_pass",
            bot_token="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_SECRET",
            bot_name="Official Company Bot",
            bot_username="company_support_bot",
        )
        self.session = DeviceSession.create_session(
            employee=self.employee,
            device_name="Operator Workstation",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.session.session_token}")

        self.victim_user = TelegramUser.objects.create(
            telegram_id=self.victim_client_id,
            first_name="Yeak",
            username="yeak_customer",
        )

    # =========================================================================
    # VECTOR 1: HACKER ATTEMPTS TO STEAL API KEYS & TOKENS (T1552 / T1528)
    # =========================================================================

    def test_simulation_1_api_key_not_leaked_in_user_profile(self):
        """Hacker inspects /api/user/profile/ to extract Telegram bot_token or auth_token."""
        resp = self.client.get(f"/api/user/profile/?User-ID={self.operator_id}")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertNotIn("bot_token", data)
        self.assertNotIn("auth_token", data)
        self.assertNotIn("password", data)
        self.assertNotIn("SECRET", json.dumps(data))

    def test_simulation_1_api_key_not_leaked_in_chats_or_messages(self):
        """Hacker calls chat APIs and messages APIs checking for serialized credentials."""
        resp_chats = self.client.get(f"/api/chats/?User-ID={self.operator_id}")
        self.assertEqual(resp_chats.status_code, 200)
        self.assertNotIn("bot_token", json.dumps(resp_chats.json()))

        resp_msgs = self.client.get(f"/api/messages/?User-ID={self.operator_id}&to-user={self.victim_client_id}")
        self.assertEqual(resp_msgs.status_code, 200)
        self.assertNotIn("bot_token", json.dumps(resp_msgs.json()))

    def test_simulation_1_log_sanitizer_redacts_api_keys_and_tokens(self):
        """Verify Blue Team log sanitizer strips API keys and bearer tokens from logs."""
        raw_log = f"Failed to send request with bot token 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_SECRET and Bearer tg_session_token_1234567890abcdef1234567890abcdef"
        sanitized = sanitize_log_output(raw_log)
        self.assertNotIn("123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_SECRET", sanitized)
        self.assertIn("[REDACTED_API_KEY]", sanitized)

    # =========================================================================
    # VECTOR 2: HACKER ATTEMPTS TO BREAK THE LINK / DOS / SPOOFING (T1498 / T1499)
    # =========================================================================

    @override_settings(TELEGRAM_WEBHOOK_SECRET="company_ultra_secret_webhook_token_99")
    def test_simulation_2_unauthorized_webhook_link_hijack_blocked(self):
        """Hacker attempts to POST fake webhook updates without valid secret token header."""
        unauth_client = APIClient()
        fake_update = {
            "update_id": 99999,
            "message": {
                "message_id": 1,
                "from": {"id": 888888, "first_name": "Attacker"},
                "chat": {"id": 888888},
                "text": "Link breakage simulation"
            }
        }
        # Attempt without header
        resp = unauth_client.post("/api/telegram/webhook/", data=fake_update, format="json")
        self.assertEqual(resp.status_code, 403)

        # Attempt with wrong secret header
        unauth_client.credentials(HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="wrong_attacker_token")
        resp2 = unauth_client.post("/api/telegram/webhook/", data=fake_update, format="json")
        self.assertEqual(resp2.status_code, 403)

    def test_simulation_2_oversized_payload_dos_blocked(self):
        """Hacker attempts memory exhaustion DoS by sending 50,000 character string."""
        giant_message = "A" * 50000
        payload = {
            "User-ID": self.operator_id,
            "to-user": self.victim_client_id,
            "message": giant_message,
            "session_token": self.session.session_token
        }
        resp = self.client.post("/api/messages/send/", data=payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("exceeds maximum permitted safety length", resp.json().get("detail", ""))

    # =========================================================================
    # VECTOR 3: HACKER ATTEMPTS TO STEAL THE DATABASE (T1005 / T1083)
    # =========================================================================

    def test_simulation_3_cross_account_chat_dump_with_stolen_token_forbidden(self):
        """Hacker with account B session tries to dump account A's chat database."""
        # Create second attacker employee
        attacker_emp = EmployeeAccount.objects.create(
            user_id="attacker_hacker",
            username="Malicious Insider",
            password="password",
        )
        attacker_session = DeviceSession.create_session(employee=attacker_emp)

        attacker_client = APIClient()
        attacker_client.credentials(HTTP_AUTHORIZATION=f"Bearer {attacker_session.session_token}")

        # Attempt to access victim operator's messages
        resp = attacker_client.get(f"/api/messages/?User-ID={self.operator_id}&to-user={self.victim_client_id}")
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Forbidden", resp.json().get("detail", ""))

        # Attempt to access victim operator's chat list
        resp_chats = attacker_client.get(f"/api/chats/?User-ID={self.operator_id}")
        self.assertEqual(resp_chats.status_code, 403)

    def test_simulation_3_revoked_session_token_blocked(self):
        """Hacker tries to reuse a revoked session token to query database."""
        self.session.revoke()
        resp = self.client.get(f"/api/messages/?User-ID={self.operator_id}&to-user={self.victim_client_id}")
        self.assertEqual(resp.status_code, 401)

    def test_simulation_3_sql_injection_probe_neutralized(self):
        """Hacker attempts SQL injection payloads in parameters; ORM handles parameterized queries safely."""
        sqli_payload = "' OR '1'='1"
        resp = self.client.get(f"/api/messages/?User-ID={sqli_payload}&to-user={self.victim_client_id}")
        # Should not crash database and return 403 Forbidden or safe code
        self.assertIn(resp.status_code, [200, 400, 403, 404])
        self.assertEqual(ChatMessage.objects.count(), 0)

    # =========================================================================
    # VECTOR 4: HACKER ATTEMPTS TO CHANGE ABA PAY CODE (T1565.001 / T1565.002)
    # =========================================================================

    def test_simulation_4_tampered_unauthorized_aba_pay_code_blocked(self):
        """
        Hacker attempts to send an unapproved rogue ABA account number
        to trick customers into paying the attacker's account.
        """
        rogue_payment_msg = "Please transfer the invoice to our new ABA account: 999 888 777"
        payload = {
            "User-ID": self.operator_id,
            "to-user": self.victim_client_id,
            "message": rogue_payment_msg,
            "session_token": self.session.session_token
        }
        resp = self.client.post("/api/messages/send/", data=payload, format="json")
        self.assertEqual(resp.status_code, 400)
        detail = resp.json().get("detail", "")
        self.assertIn("Unauthorized ABA account number detected", detail)

    def test_simulation_4_tampered_aba_pay_code_in_send_photo_blocked(self):
        """Hacker attempts to send photo with caption changing the ABA pay code."""
        rogue_caption = "Scan QR or send payment to ABA Pay: 555-444-333"
        payload = {
            "employee_id": self.operator_id,
            "to_userid": self.victim_client_id,
            "caption": rogue_caption,
            "file": "uploads/fake_qr.png",
            "Action": "send_photo"
        }
        resp = self.client.post("/api/send_photo/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Unauthorized ABA account number", resp.json().get("detail", ""))

    def test_simulation_4_spoofed_payway_payment_link_blocked(self):
        """Hacker attempts to send a spoofed PayWay phishing link."""
        fake_pay_link = "Please pay here: https://payway-kh-secure-login.xyz/checkout"
        payload = {
            "User-ID": self.operator_id,
            "to-user": self.victim_client_id,
            "message": fake_pay_link,
            "session_token": self.session.session_token
        }
        resp = self.client.post("/api/messages/send/", data=payload, format="json")
        self.assertEqual(resp.status_code, 400)

    @patch("telegram_chat.bot_service.TelegramBotGateway.send_telegram_message")
    def test_simulation_4_legitimate_approved_aba_account_allowed(self, mock_tg):
        """Legitimate operator sends approved company ABA account number; passes successfully."""
        mock_tg.return_value = {"ok": True, "result": {"message_id": 201}}
        approved_msg = "Official payment: ABA Account 000 123 456 (Company Merchant)"
        payload = {
            "User-ID": self.operator_id,
            "to-user": self.victim_client_id,
            "message": approved_msg,
            "session_token": self.session.session_token
        }
        resp = self.client.post("/api/messages/send/", data=payload, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json().get("success"))

    # =========================================================================
    # VECTOR 5: HACKER ATTEMPTS TO SEND MALICIOUS LINKS IN APP (T1204 / T1059)
    # =========================================================================

    def test_simulation_5_javascript_uri_xss_link_blocked(self):
        """Hacker attempts to send javascript: XSS link in chat message."""
        xss_payload = "Check this out: javascript:alert(document.cookie)"
        payload = {
            "User-ID": self.operator_id,
            "to-user": self.victim_client_id,
            "message": xss_payload,
            "session_token": self.session.session_token
        }
        resp = self.client.post("/api/messages/send/", data=payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Dangerous URI scheme", resp.json().get("detail", ""))

    def test_simulation_5_data_uri_xss_link_blocked(self):
        """Hacker attempts to send data: URI exploit."""
        data_payload = "Download receipt: data:text/html,<script>alert(1)</script>"
        payload = {
            "User-ID": self.operator_id,
            "to-user": self.victim_client_id,
            "message": data_payload,
            "session_token": self.session.session_token
        }
        resp = self.client.post("/api/messages/send/", data=payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Dangerous URI scheme", resp.json().get("detail", ""))

    def test_simulation_5_suspicious_phishing_tld_blocked(self):
        """Hacker attempts to send phishing URL with high-risk TLD (.xyz)."""
        phish_msg = "Claim your reward now: https://telegram-bonus-claim.xyz/login"
        payload = {
            "User-ID": self.operator_id,
            "to-user": self.victim_client_id,
            "message": phish_msg,
            "session_token": self.session.session_token
        }
        resp = self.client.post("/api/messages/send/", data=payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("high-risk domain extension", resp.json().get("detail", ""))

    def test_simulation_5_credential_phish_signature_blocked(self):
        """Hacker attempts to send credential harvesting link matching keyword signatures."""
        phish_url = "https://support-update.net/telegram-login?id=8831"
        payload = {
            "User-ID": self.operator_id,
            "to-user": self.victim_client_id,
            "message": phish_url,
            "session_token": self.session.session_token
        }
        resp = self.client.post("/api/messages/send/", data=payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("credential harvesting", resp.json().get("detail", "").lower())
