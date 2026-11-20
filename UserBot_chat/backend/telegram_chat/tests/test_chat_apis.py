"""
Automated Local Test Suite: Chat REST APIs.
Covers Tiers 1-3 for Requirements R1, R2, R4.
100% offline, verifying endpoints /api/chats/, /api/messages/, /api/messages/send/, /api/media/upload/.
"""

import tempfile
from pathlib import Path
from datetime import timedelta
from unittest.mock import patch, MagicMock
from django.utils import timezone
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from telegram_chat.models import EmployeeAccount, DeviceSession, BotAccount, TelegramUser, ChatMessage
from telegram_chat.bot_service import TelegramBotGateway


class ChatAPITests(TestCase):
    """
    Test suite for chat conversation listing, message history retrieval,
    outgoing message dispatch, media file upload, and parameter boundaries.
    """

    def setUp(self):
        self.client = APIClient()
        self.operator_id = "1234"
        self.customer_tg_id = "tg_982341"

        self.employee = EmployeeAccount.objects.create(
            user_id=self.operator_id,
            username="Operator John",
            password="password123",
            role="operator",
            avatar="https://example.com/avatar.png",
        )
        self.bot = BotAccount.objects.create(
            employee=self.employee,
            user_id=self.operator_id,
            password="password123",
            bot_token="test_mock_token_abc",
            bot_name="Alpha Bot",
            bot_username="alpha_bot",
        )
        self.session = DeviceSession.create_session(
            employee=self.employee,
            device_name="Test Workstation",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.session.session_token}")
        self.customer = TelegramUser.objects.create(
            telegram_id=self.customer_tg_id,
            first_name="Sarah",
            last_name="Connor",
            username="sconnor",
            is_online=True,
            last_seen="online now",
        )

    # =========================================================================
    # TIER 1: FUNCTIONAL TESTS (Primary Happy Paths)
    # =========================================================================

    def test_tier1_health_check(self):
        """Verify GET /api/health/ returns 200 OK with service identifier."""
        resp = self.client.get("/api/health/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("status"), "ok")
        self.assertEqual(resp.data.get("service"), "django_telegram_bridge")
        self.assertIn("timestamp", resp.data)

    def test_tier1_chats_list_conversations(self):
        """Verify GET /api/chats/?User-ID=1234 returns conversation array with user info & unread count."""
        # Create an inbound delivered message
        ChatMessage.objects.create(
            message_uid="msg_inbound_1",
            sender_id=self.customer_tg_id,
            sender_name="Sarah Connor",
            to_user=self.operator_id,
            message="Hello operator",
            is_outgoing=False,
            status="delivered",
        )

        resp = self.client.get(f"/api/chats/?User-ID={self.operator_id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        conversations = resp.data

        self.assertIsInstance(conversations, list)
        self.assertGreaterEqual(len(conversations), 1)

        conv = next((c for c in conversations if c["id"] == self.customer_tg_id), None)
        self.assertIsNotNone(conv)
        self.assertEqual(conv["user"]["firstName"], "Sarah")
        self.assertEqual(conv["user"]["lastName"], "Connor")
        self.assertEqual(conv["user"]["username"], "sconnor")
        self.assertEqual(conv["unreadCount"], 1)
        self.assertIsNotNone(conv["lastMessage"])
        self.assertEqual(conv["lastMessage"]["message"], "Hello operator")

    def test_tier1_messages_history_chronological(self):
        """Verify GET /api/messages/?User-ID=...&to-user=... returns chronological messages."""
        now = timezone.now()
        # Create sequence with distinct timestamps
        m1 = ChatMessage.objects.create(
            message_uid="msg_seq_1",
            sender_id=self.customer_tg_id,
            to_user=self.operator_id,
            message="First message from client",
            is_outgoing=False,
        )
        ChatMessage.objects.filter(pk=m1.pk).update(created_at=now - timedelta(minutes=5))

        m2 = ChatMessage.objects.create(
            message_uid="msg_seq_2",
            sender_id=self.operator_id,
            to_user=self.customer_tg_id,
            message="Second message from operator",
            is_outgoing=True,
        )
        ChatMessage.objects.filter(pk=m2.pk).update(created_at=now)

        resp = self.client.get(f"/api/messages/?User-ID={self.operator_id}&to-user={self.customer_tg_id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        messages = resp.data

        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0]["id"], "msg_seq_1")
        self.assertEqual(messages[0]["message"], "First message from client")
        self.assertFalse(messages[0]["isOutgoing"])

        self.assertEqual(messages[1]["id"], "msg_seq_2")
        self.assertEqual(messages[1]["message"], "Second message from operator")
        self.assertTrue(messages[1]["isOutgoing"])

    @patch.object(TelegramBotGateway, "send_telegram_message")
    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier1_send_message_success(self, mock_ws_notify, mock_tg_send):
        """Verify POST /api/messages/send/ saves ChatMessage, calls bot gateway, and broadcasts to WebSocket."""
        mock_tg_send.return_value = {"ok": True, "result": {"message_id": 999}}

        payload = {
            "User-ID": self.operator_id,
            "to-user": self.customer_tg_id,
            "message": "Thanks for reaching out, how can I assist?",
            "action": "send_message",
        }

        resp = self.client.post("/api/messages/send/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data.get("success"))
        self.assertIn("message_id", resp.data)

        # 1. Verify DB persistence
        msg_uid = resp.data["message_id"]
        saved_msg = ChatMessage.objects.filter(message_uid=msg_uid).first()
        self.assertIsNotNone(saved_msg)
        self.assertEqual(saved_msg.sender_id, self.operator_id)
        self.assertEqual(saved_msg.to_user, self.customer_tg_id)
        self.assertEqual(saved_msg.message, payload["message"])
        self.assertTrue(saved_msg.is_outgoing)
        self.assertEqual(saved_msg.status, "sent")

        # 2. Verify gateway call
        mock_tg_send.assert_called_once()
        self.assertEqual(mock_tg_send.call_args[1]["chat_id"], self.customer_tg_id)
        self.assertEqual(mock_tg_send.call_args[1]["text"], payload["message"])

        # 3. Verify WebSocket broadcast
        mock_ws_notify.assert_called_once()
        self.assertEqual(mock_ws_notify.call_args[0][0], self.operator_id)

    @patch.object(TelegramBotGateway, "send_telegram_message")
    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier1_send_message_with_sticker(self, mock_ws_notify, mock_tg_send):
        """Verify outgoing message with sticker payload persists sticker metadata and dispatches."""
        mock_tg_send.return_value = {"ok": True, "result": {"message_id": 1000}}

        payload = {
            "User-ID": self.operator_id,
            "to-user": self.customer_tg_id,
            "message": "",
            "action": "send_sticker",
            "sticker": {
                "id": "duck_love",
                "packId": "telegram_ducks",
                "emoji": "🦆",
            },
        }

        resp = self.client.post("/api/messages/send/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        saved_msg = ChatMessage.objects.filter(message_uid=resp.data["message_id"]).first()
        self.assertEqual(saved_msg.sticker_id, "duck_love")
        self.assertEqual(saved_msg.sticker_pack, "telegram_ducks")
        self.assertEqual(saved_msg.sticker_emoji, "🦆")

    def test_tier1_media_upload_file(self):
        """Verify POST /api/media/upload/ receives multipart file and returns public URL without leaking test files."""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            with override_settings(MEDIA_ROOT=temp_path):
                test_file = SimpleUploadedFile(
                    "operator_voice.webm",
                    b"fake_audio_stream_bytes_here",
                    content_type="audio/webm",
                )

                resp = self.client.post("/api/media/upload/", {"file": test_file}, format="multipart")
                self.assertEqual(resp.status_code, status.HTTP_200_OK)
                self.assertTrue(resp.data.get("success"))
                self.assertIn("url", resp.data)
                self.assertIn("filename", resp.data)
                self.assertIn("operator_voice.webm", resp.data["filename"])

    # =========================================================================
    # TIER 2: BOUNDARY & CORNER CASES (Validation, Missing Params)
    # =========================================================================

    def test_tier2_chats_list_missing_user_id(self):
        """Verify 400 Bad Request when User-ID is omitted on /api/chats/."""
        resp = self.client.get("/api/chats/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", resp.data)

    def test_tier2_messages_history_missing_user_id(self):
        """Verify 400 Bad Request when User-ID is missing on /api/messages/."""
        resp = self.client.get(f"/api/messages/?to-user={self.customer_tg_id}")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tier2_messages_history_missing_to_user(self):
        """Verify 400 Bad Request when to-user is missing on /api/messages/."""
        resp = self.client.get(f"/api/messages/?User-ID={self.operator_id}")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tier2_messages_history_empty_conversation(self):
        """Verify 200 OK with empty array [] when there are no messages for a conversation."""
        resp = self.client.get(f"/api/messages/?User-ID={self.operator_id}&to-user=nonexistent_client_99")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, [])

    def test_tier2_send_message_missing_user_id(self):
        """Verify 400 Bad Request when User-ID is omitted on /api/messages/send/."""
        payload = {"to-user": self.customer_tg_id, "message": "Hi"}
        resp = self.client.post("/api/messages/send/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tier2_send_message_missing_to_user(self):
        """Verify 400 Bad Request when to-user is omitted on /api/messages/send/."""
        payload = {"User-ID": self.operator_id, "message": "Hi"}
        resp = self.client.post("/api/messages/send/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tier2_send_message_empty_payload(self):
        """Verify 400 Bad Request when POST payload is empty dict."""
        resp = self.client.post("/api/messages/send/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tier2_media_upload_no_file(self):
        """Verify 400 Bad Request when /api/media/upload/ receives no file."""
        resp = self.client.post("/api/media/upload/", {}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("requests.get")
    def test_tier2_chats_list_with_sync_param(self, mock_get):
        """Verify ?sync=true on /api/chats/ invokes sync_bot_conversations gracefully."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"ok": True, "result": []}
        mock_get.return_value = mock_resp

        resp = self.client.get(f"/api/chats/?User-ID={self.operator_id}&sync=true")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsInstance(resp.data, list)

    def test_tier2_send_message_missing_token_rejected(self):
        """Verify 401 Unauthorized when sending message without a session token."""
        client_no_auth = APIClient()
        payload = {
            "User-ID": self.operator_id,
            "to-user": self.customer_tg_id,
            "message": "Attempt without token",
        }
        resp = client_no_auth.post("/api/messages/send/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tier2_send_message_revoked_session_rejected(self):
        """Verify 401 Unauthorized when sending message with a revoked session token."""
        revoked_session = DeviceSession.create_session(employee=self.employee, device_name="Revoked Device")
        revoked_session.revoke()

        client_revoked = APIClient()
        payload = {
            "User-ID": self.operator_id,
            "to-user": self.customer_tg_id,
            "message": "Attempt with revoked token",
        }
        resp = client_revoked.post(
            "/api/messages/send/",
            payload,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {revoked_session.session_token}"
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch.object(TelegramBotGateway, "send_telegram_message")
    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier2_send_message_unicode_content(self, mock_ws_notify, mock_tg_send):
        """Verify sending Unicode / Khmer text preserves character encoding in database."""
        mock_tg_send.return_value = {"ok": True, "result": {"message_id": 1001}}
        unicode_message = "សួស្តី! យើងខ្ញុំរីករាយក្នុងការជួយអ្នក 🇰🇭✨"

        payload = {
            "User-ID": self.operator_id,
            "to-user": self.customer_tg_id,
            "message": unicode_message,
        }

        resp = self.client.post("/api/messages/send/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        saved_msg = ChatMessage.objects.filter(message_uid=resp.data["message_id"]).first()
        self.assertEqual(saved_msg.message, unicode_message)

    # =========================================================================
    # TIER 3: CROSS-FEATURE PAIRWISE TESTS
    # =========================================================================

    @patch.object(TelegramBotGateway, "send_telegram_message")
    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier3_send_message_updates_last_message_in_chats_list(self, mock_ws_notify, mock_tg_send):
        """Verify sending a message updates lastMessage on subsequent /api/chats/ calls."""
        mock_tg_send.return_value = {"ok": True, "result": {"message_id": 1002}}

        reply_text = "Latest reply from CS agent"
        self.client.post("/api/messages/send/", {
            "User-ID": self.operator_id,
            "to-user": self.customer_tg_id,
            "message": reply_text,
        }, format="json")

        chats_resp = self.client.get(f"/api/chats/?User-ID={self.operator_id}")
        self.assertEqual(chats_resp.status_code, status.HTTP_200_OK)

        conv = next((c for c in chats_resp.data if c["id"] == self.customer_tg_id), None)
        self.assertIsNotNone(conv)
        self.assertIsNotNone(conv["lastMessage"])
        self.assertEqual(conv["lastMessage"]["message"], reply_text)

    def test_tier3_conversation_isolation_between_customers(self):
        """Verify message histories of Customer A and Customer B never leak into each other."""
        cust_b = TelegramUser.objects.create(
            telegram_id="tg_client_b",
            first_name="Client B",
        )

        ChatMessage.objects.create(
            message_uid="msg_a_1",
            sender_id=self.customer_tg_id,
            to_user=self.operator_id,
            message="Secret message for customer A",
        )
        ChatMessage.objects.create(
            message_uid="msg_b_1",
            sender_id="tg_client_b",
            to_user=self.operator_id,
            message="Secret message for customer B",
        )

        # Query A's history
        resp_a = self.client.get(f"/api/messages/?User-ID={self.operator_id}&to-user={self.customer_tg_id}")
        texts_a = [m["message"] for m in resp_a.data]
        self.assertIn("Secret message for customer A", texts_a)
        self.assertNotIn("Secret message for customer B", texts_a)

        # Query B's history
        resp_b = self.client.get(f"/api/messages/?User-ID={self.operator_id}&to-user=tg_client_b")
        texts_b = [m["message"] for m in resp_b.data]
        self.assertIn("Secret message for customer B", texts_b)
        self.assertNotIn("Secret message for customer A", texts_b)
