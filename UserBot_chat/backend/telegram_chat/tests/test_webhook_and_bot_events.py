"""
Automated Local Test Suite: Telegram Webhook Ingestion & Simulated Bot Events.
Covers Tiers 1-3 for Requirement R2.
100% offline, zero network requests, verifying database upserts and real-time broadcasts.
"""

from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from telegram_chat.models import TelegramUser, ChatMessage, EmployeeAccount, BotAccount
from telegram_chat.bot_service import TelegramBotGateway


class WebhookAndBotEventsTests(TestCase):
    """
    Test suite for incoming Telegram webhook updates, customer profile upsertion,
    ChatMessage persistence, and WebSocket fanout notifications.
    """

    def setUp(self):
        self.client = APIClient()
        self.operator_id = "1234"
        self.customer_tg_id = "982341"

        self.employee = EmployeeAccount.objects.create(
            user_id=self.operator_id,
            username="Operator John",
            password="password123",
        )
        self.bot = BotAccount.objects.create(
            employee=self.employee,
            user_id=self.operator_id,
            password="password123",
            bot_token="test_mock_token_777",
            bot_name="Alpha Support",
        )

    # =========================================================================
    # TIER 1: FUNCTIONAL TESTS (Inbound Updates & Upsertion)
    # =========================================================================

    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier1_inbound_text_message_webhook(self, mock_ws_notify):
        """Verify webhook ingests text message, creates TelegramUser, persists ChatMessage, and alerts WebSocket."""
        payload = {
            "update_id": 10001,
            "message": {
                "message_id": 501,
                "from": {
                    "id": int(self.customer_tg_id),
                    "first_name": "Sarah",
                    "last_name": "Connor",
                    "username": "sconnor",
                },
                "chat": {"id": int(self.customer_tg_id), "type": "private"},
                "date": 1700000000,
                "text": "Hello, I need help with my order #9921",
            },
        }

        resp = self.client.post(
            f"/api/telegram/webhook/{self.operator_id}/",
            payload,
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data.get("ok"))

        # 1. Verify TelegramUser upsert
        customer = TelegramUser.objects.filter(telegram_id=self.customer_tg_id).first()
        self.assertIsNotNone(customer)
        self.assertEqual(customer.first_name, "Sarah")
        self.assertEqual(customer.last_name, "Connor")
        self.assertEqual(customer.username, "sconnor")
        self.assertTrue(customer.is_online)

        # 2. Verify ChatMessage creation
        chat_msg = ChatMessage.objects.filter(
            sender_id=self.customer_tg_id,
            to_user=self.operator_id,
        ).first()
        self.assertIsNotNone(chat_msg)
        self.assertEqual(chat_msg.message, "Hello, I need help with my order #9921")
        self.assertFalse(chat_msg.is_outgoing, "Inbound client message must have is_outgoing=False")
        self.assertEqual(chat_msg.status, "delivered")
        self.assertEqual(chat_msg.sender_name, "Sarah Connor")

        # 3. Verify WebSocket broadcast notification
        mock_ws_notify.assert_called_once()
        call_operator_id, call_payload = mock_ws_notify.call_args[0]
        self.assertEqual(call_operator_id, self.operator_id)
        self.assertEqual(call_payload["sender_id"], self.customer_tg_id)
        self.assertEqual(call_payload["message"], "Hello, I need help with my order #9921")
        self.assertFalse(call_payload["is_outgoing"])

    @patch("requests.get")
    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier1_inbound_photo_webhook(self, mock_ws_notify, mock_get):
        """Verify webhook ingests photo message with file path extraction."""
        mock_get.return_value.json.return_value = {
            "ok": True,
            "result": {"file_path": "photos/file_0.jpg"}
        }

        payload = {
            "update_id": 10002,
            "message": {
                "message_id": 502,
                "from": {"id": int(self.customer_tg_id), "first_name": "Sarah"},
                "chat": {"id": int(self.customer_tg_id)},
                "photo": [
                    {"file_id": "thumb_1", "file_size": 100},
                    {"file_id": "highres_2", "file_size": 5000},
                ],
                "caption": "Here is the defective item",
            },
        }

        resp = self.client.post(f"/api/telegram/webhook/{self.operator_id}/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        chat_msg = ChatMessage.objects.filter(sender_id=self.customer_tg_id, action="send_media").first()
        self.assertIsNotNone(chat_msg)
        self.assertEqual(chat_msg.media_type, "photo")
        self.assertEqual(chat_msg.message, "Here is the defective item")
        self.assertIn("photos/file_0.jpg", chat_msg.media_url)

    @patch("requests.get")
    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier1_inbound_voice_webhook(self, mock_ws_notify, mock_get):
        """Verify webhook ingests voice audio message."""
        mock_get.return_value.json.return_value = {
            "ok": True,
            "result": {"file_path": "voice/audio_0.oga"}
        }

        payload = {
            "update_id": 10003,
            "message": {
                "message_id": 503,
                "from": {"id": int(self.customer_tg_id), "first_name": "Sarah"},
                "chat": {"id": int(self.customer_tg_id)},
                "voice": {"file_id": "voice_file_99", "duration": 5},
                "caption": "Audio note",
            },
        }

        resp = self.client.post(f"/api/telegram/webhook/{self.operator_id}/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        chat_msg = ChatMessage.objects.filter(sender_id=self.customer_tg_id, media_type="voice").first()
        self.assertIsNotNone(chat_msg)
        self.assertEqual(chat_msg.media_type, "voice")

    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier1_inbound_edited_message(self, mock_ws_notify):
        """Verify webhook processes edited_message key seamlessly."""
        payload = {
            "update_id": 10004,
            "edited_message": {
                "message_id": 504,
                "from": {"id": int(self.customer_tg_id), "first_name": "Sarah"},
                "chat": {"id": int(self.customer_tg_id)},
                "text": "Corrected address: 42 Elm Street",
            },
        }

        resp = self.client.post(f"/api/telegram/webhook/{self.operator_id}/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data.get("ok"))

        chat_msg = ChatMessage.objects.filter(message="Corrected address: 42 Elm Street").first()
        self.assertIsNotNone(chat_msg)

    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier1_existing_user_upsert(self, mock_ws_notify):
        """Verify repeated messages from the same user update profile rather than duplicate records."""
        # Initial message
        TelegramUser.objects.create(
            telegram_id=self.customer_tg_id,
            first_name="OldName",
            username="old_user",
        )

        payload = {
            "update_id": 10005,
            "message": {
                "message_id": 505,
                "from": {
                    "id": int(self.customer_tg_id),
                    "first_name": "NewName",
                    "last_name": "Updated",
                    "username": "new_user",
                },
                "chat": {"id": int(self.customer_tg_id)},
                "text": "Profile updated message",
            },
        }

        self.client.post(f"/api/telegram/webhook/{self.operator_id}/", payload, format="json")

        user_count = TelegramUser.objects.filter(telegram_id=self.customer_tg_id).count()
        self.assertEqual(user_count, 1, "Must update existing user, never duplicate")

        user = TelegramUser.objects.get(telegram_id=self.customer_tg_id)
        self.assertEqual(user.first_name, "NewName")
        self.assertEqual(user.last_name, "Updated")
        self.assertEqual(user.username, "new_user")

    # =========================================================================
    # TIER 2: BOUNDARY & CORNER CASES
    # =========================================================================

    def test_tier2_webhook_empty_payload(self):
        """Verify webhook returns ok: False when POST payload is empty dict."""
        resp = self.client.post(f"/api/telegram/webhook/{self.operator_id}/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data.get("ok"))

    def test_tier2_webhook_missing_from_user(self):
        """Verify message without 'from' sender dictionary is safely rejected."""
        payload = {
            "update_id": 10006,
            "message": {"message_id": 506, "text": "Anonymous"},
        }
        resp = self.client.post(f"/api/telegram/webhook/{self.operator_id}/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data.get("ok"))

    def test_tier2_webhook_missing_from_id(self):
        """Verify message where 'from' lacks an 'id' is rejected."""
        payload = {
            "update_id": 10007,
            "message": {
                "message_id": 507,
                "from": {"first_name": "Ghost"},
                "text": "Ghost message",
            },
        }
        resp = self.client.post(f"/api/telegram/webhook/{self.operator_id}/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data.get("ok"))

    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier2_webhook_special_unicode_in_customer_name_and_text(self, mock_ws_notify):
        """Verify customer name and message containing Khmer script, emoji, and Asian characters."""
        khmer_name = "សុខា ស្រី"
        khmer_message = "សូមជួយពិនិត្យកញ្ចប់ឥវ៉ាន់របស់ខ្ញុំផង 📦✨"

        payload = {
            "update_id": 10008,
            "message": {
                "message_id": 508,
                "from": {
                    "id": 888777,
                    "first_name": khmer_name,
                    "username": "sokha_kh",
                },
                "chat": {"id": 888777},
                "text": khmer_message,
            },
        }

        resp = self.client.post(f"/api/telegram/webhook/{self.operator_id}/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data.get("ok"))

        cust = TelegramUser.objects.get(telegram_id="888777")
        self.assertEqual(cust.first_name, khmer_name)

        msg = ChatMessage.objects.get(sender_id="888777")
        self.assertEqual(msg.message, khmer_message)

    def test_tier2_webhook_channel_post_ignored(self):
        """Verify updates containing channel_post (broadcasts, not 1-on-1 chats) are safely ignored."""
        payload = {
            "update_id": 10009,
            "channel_post": {
                "message_id": 99,
                "chat": {"id": -1001234567890, "title": "News Channel"},
                "text": "Channel announcement",
            },
        }
        resp = self.client.post(f"/api/telegram/webhook/{self.operator_id}/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data.get("ok"))

    # =========================================================================
    # TIER 3: CROSS-FEATURE PAIRWISE TESTS
    # =========================================================================

    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier3_inbound_webhook_increments_unread_count_in_chats_api(self, mock_ws_notify):
        """Verify inbound message with delivered status increments unread count on GET /api/chats/."""
        # Send inbound message from new customer
        payload = {
            "update_id": 10010,
            "message": {
                "message_id": 510,
                "from": {"id": 123999, "first_name": "Bob"},
                "chat": {"id": 123999},
                "text": "Unread message test",
            },
        }
        self.client.post(f"/api/telegram/webhook/{self.operator_id}/", payload, format="json")

        # Now query operator chats list
        chats_resp = self.client.get(f"/api/chats/?User-ID={self.operator_id}")
        self.assertEqual(chats_resp.status_code, status.HTTP_200_OK)
        conversations = chats_resp.data

        bob_conv = next((c for c in conversations if c["id"] == "123999"), None)
        self.assertIsNotNone(bob_conv, "Customer conversation must appear in chats list")
        self.assertEqual(bob_conv["unreadCount"], 1, "Unread count must be 1 for delivered inbound message")

    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier3_multiple_customers_isolated_conversations(self, mock_ws_notify):
        """Verify inbound messages from multiple customers create separate isolated records."""
        cust_ids = [3001, 3002, 3003]
        for cid in cust_ids:
            payload = {
                "update_id": cid,
                "message": {
                    "message_id": cid,
                    "from": {"id": cid, "first_name": f"Client_{cid}"},
                    "chat": {"id": cid},
                    "text": f"Inquiry from client {cid}",
                },
            }
            self.client.post(f"/api/telegram/webhook/{self.operator_id}/", payload, format="json")

        self.assertEqual(TelegramUser.objects.filter(telegram_id__in=[str(c) for c in cust_ids]).count(), 3)
        self.assertEqual(ChatMessage.objects.filter(to_user=self.operator_id).count(), 3)
