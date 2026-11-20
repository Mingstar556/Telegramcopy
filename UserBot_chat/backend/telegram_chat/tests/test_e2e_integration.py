"""
Automated Local Test Suite: End-to-End Integration & Real-World Scenarios (Tier 4).
Covers Requirements R1, R2, R4, R5 per TEST_INFRA.md.
Simulates multi-device concurrent operator sessions, inbound Telegram client ingestion,
chat listing, outbound dispatch as bot, and independent session revocation.
100% offline, zero network requests.
"""

from unittest.mock import patch, MagicMock
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from telegram_chat.models import EmployeeAccount, DeviceSession, BotAccount, TelegramUser, ChatMessage
from telegram_chat.bot_service import TelegramBotGateway


class E2EIntegrationTests(TestCase):
    """
    Tier 4: Comprehensive Real-World Application Scenarios.
    Exercises complete cross-module integration across multi-device authentication,
    Telegram webhook processing, chat API queries, and message dispatch.
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
            bot_token="test_mock_token_live_123",
            bot_name="kjel tv rean",
            bot_username="anhkjeltvrean_bot",
            description="Telegram bot operator session",
        )

    # =========================================================================
    # SCENARIO 1: Comprehensive Multi-Device Full Workflow & Shift Handover
    # =========================================================================

    @patch.object(TelegramBotGateway, "send_telegram_message")
    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier4_scenario1_concurrent_multidevice_full_workflow(self, mock_ws_notify, mock_tg_send):
        """
        Scenario 1: Concurrent Multi-Device Shift Handover (F1, F2, F3)
        1. Employee logs in from Device 1 (Desktop) and Device 2 (Mobile).
        2. Both devices receive distinct active session tokens.
        3. Inbound simulated client chat from Telegram client is ingested via webhook.
        4. Employee on Device 1 lists chats (verifies client conversation appears with unreadCount=1).
        5. Employee on Device 1 replies to client (verifies mocked Telegram sendMessage is dispatched).
        6. Message is persisted and visible to Device 2.
        7. Employee logs out on Device 1; Device 2 remains authenticated and can continue chatting.
        """
        mock_tg_send.return_value = {"ok": True, "result": {"message_id": 10001}}

        # --- Step 1 & 2: Login from Device 1 (Desktop) and Device 2 (Mobile) ---
        login_dev1 = self.client.post("/api/auth/login/", {
            "User-ID": self.user_id,
            "password": self.password,
            "device_name": "Office Desktop Workstation",
            "device_type": "desktop",
        }, format="json")
        self.assertEqual(login_dev1.status_code, status.HTTP_200_OK)
        token_dev1 = login_dev1.data.get("token")
        self.assertTrue(token_dev1.startswith("tg_session_token_"))

        login_dev2 = self.client.post("/api/auth/login/", {
            "User-ID": self.user_id,
            "password": self.password,
            "device_name": "iPhone 15 Mobile",
            "device_type": "mobile",
        }, format="json")
        self.assertEqual(login_dev2.status_code, status.HTTP_200_OK)
        token_dev2 = login_dev2.data.get("token")
        self.assertTrue(token_dev2.startswith("tg_session_token_"))

        # Verify tokens are distinct
        self.assertNotEqual(token_dev1, token_dev2, "Device 1 and Device 2 must have distinct session tokens")

        # Verify active sessions endpoint shows both active
        sessions_resp = self.client.get(
            f"/api/auth/sessions/?User-ID={self.user_id}",
            HTTP_AUTHORIZATION=f"Bearer {token_dev1}",
        )
        self.assertEqual(sessions_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(sessions_resp.data), 2)

        # --- Step 3: Inbound Telegram client chat arrives via Webhook ---
        customer_tg_id = "1175665271"
        webhook_payload = {
            "update_id": 99001,
            "message": {
                "message_id": 8801,
                "from": {
                    "id": int(customer_tg_id),
                    "first_name": "Chiv",
                    "last_name": "Mengly",
                    "username": "Ly_Noh",
                },
                "chat": {"id": int(customer_tg_id), "type": "private"},
                "date": 1700000100,
                "text": "Hello support, I have an inquiry about delivery.",
            },
        }

        webhook_resp = self.client.post(
            f"/api/telegram/webhook/{self.user_id}/",
            webhook_payload,
            format="json",
        )
        self.assertEqual(webhook_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(webhook_resp.data.get("ok"))

        # Verify customer record created
        client_user = TelegramUser.objects.filter(telegram_id=customer_tg_id).first()
        self.assertIsNotNone(client_user)
        self.assertEqual(client_user.first_name, "Chiv")
        self.assertEqual(client_user.last_name, "Mengly")

        # --- Step 4: Employee on Device 1 lists chats ---
        chats_dev1 = self.client.get(
            f"/api/chats/?User-ID={self.user_id}",
            HTTP_AUTHORIZATION=f"Bearer {token_dev1}",
        )
        self.assertEqual(chats_dev1.status_code, status.HTTP_200_OK)
        conversations = chats_dev1.data
        client_conv = next((c for c in conversations if c["id"] == customer_tg_id), None)
        self.assertIsNotNone(client_conv, "Client conversation must appear on Device 1")
        self.assertEqual(client_conv["unreadCount"], 1)
        self.assertEqual(client_conv["lastMessage"]["message"], "Hello support, I have an inquiry about delivery.")

        # --- Step 5: Employee on Device 1 replies to client as the bot ---
        reply_payload = {
            "User-ID": self.user_id,
            "to-user": customer_tg_id,
            "message": "Hello Chiv! Standard delivery takes 1-2 business days.",
            "action": "send_message",
        }
        send_resp_dev1 = self.client.post(
            "/api/messages/send/",
            reply_payload,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token_dev1}",
        )
        self.assertEqual(send_resp_dev1.status_code, status.HTTP_200_OK)
        self.assertTrue(send_resp_dev1.data.get("success"))

        # Verify mock Telegram API dispatch was called
        mock_tg_send.assert_called_once()
        self.assertEqual(mock_tg_send.call_args[1]["chat_id"], customer_tg_id)
        self.assertEqual(mock_tg_send.call_args[1]["text"], reply_payload["message"])

        # --- Step 6: Message is persisted and visible to Device 2 ---
        history_dev2 = self.client.get(
            f"/api/messages/?User-ID={self.user_id}&to-user={customer_tg_id}",
            HTTP_AUTHORIZATION=f"Bearer {token_dev2}",
        )
        self.assertEqual(history_dev2.status_code, status.HTTP_200_OK)
        messages_dev2 = history_dev2.data

        self.assertEqual(len(messages_dev2), 2)
        # Message 1: client inbound
        self.assertEqual(messages_dev2[0]["message"], "Hello support, I have an inquiry about delivery.")
        self.assertFalse(messages_dev2[0]["isOutgoing"])
        # Message 2: operator reply from Device 1
        self.assertEqual(messages_dev2[1]["message"], "Hello Chiv! Standard delivery takes 1-2 business days.")
        self.assertTrue(messages_dev2[1]["isOutgoing"])

        # --- Step 7: Employee logs out on Device 1; Device 2 remains authenticated ---
        logout_dev1 = self.client.post(
            "/api/auth/logout/",
            {"session_token": token_dev1},
            format="json",
        )
        self.assertEqual(logout_dev1.status_code, status.HTTP_200_OK)
        self.assertEqual(logout_dev1.data.get("status"), "logged_out")

        # Verify in database: Device 1 is inactive, Device 2 is active
        sess1 = DeviceSession.objects.get(session_token=token_dev1)
        sess2 = DeviceSession.objects.get(session_token=token_dev2)
        self.assertFalse(sess1.is_active, "Device 1 session must be revoked")
        self.assertTrue(sess2.is_active, "Device 2 session must remain active")

        # Device 2 continues to operate and can send further messages
        reply2_payload = {
            "User-ID": self.user_id,
            "to-user": customer_tg_id,
            "message": "Follow-up message sent from mobile Device 2.",
            "action": "send_message",
        }
        send_resp_dev2 = self.client.post(
            "/api/messages/send/",
            reply2_payload,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token_dev2}",
        )
        self.assertEqual(send_resp_dev2.status_code, status.HTTP_200_OK)
        self.assertTrue(send_resp_dev2.data.get("success"))

    # =========================================================================
    # SCENARIO 2: Client First Contact & Auto-Fetch
    # =========================================================================

    @patch("requests.get")
    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier4_scenario2_client_first_contact_and_autofetch(self, mock_ws_notify, mock_requests_get):
        """
        Scenario 2: Client First Contact & Auto-Fetch (F2, F3)
        A new Telegram client messages the company bot.
        Employee logs in and queries `/api/chats/?User-ID=1234&sync=true`.
        `getUpdates` is automatically invoked by TelegramBotGateway.sync_bot_conversations,
        and the client conversation is created and displayed in the conversation list.
        """
        new_client_id = "55443322"
        first_contact_payload = {
            "update_id": 88001,
            "message": {
                "message_id": 1,
                "from": {
                    "id": int(new_client_id),
                    "first_name": "Alice",
                    "last_name": "Wonderland",
                    "username": "alice_w",
                },
                "chat": {"id": int(new_client_id)},
                "text": "Hello, is this the official support channel?",
            },
        }

        # Mock requests.get returning Telegram getUpdates response
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "ok": True,
            "result": [first_contact_payload]
        }
        mock_requests_get.return_value = mock_resp

        # Employee logs in
        login_resp = self.client.post("/api/auth/login/", {"User-ID": self.user_id, "password": self.password})
        token = login_resp.data.get("token")

        # Employee fetches chat list with sync=true directly without pre-seeding webhook
        chats_resp = self.client.get(
            f"/api/chats/?User-ID={self.user_id}&sync=true",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(chats_resp.status_code, status.HTTP_200_OK)
        chats = chats_resp.data

        alice_conv = next((c for c in chats if c["id"] == new_client_id), None)
        self.assertIsNotNone(alice_conv, "First-contact client must appear in chats list via sync auto-fetch")
        self.assertEqual(alice_conv["user"]["firstName"], "Alice")
        self.assertEqual(alice_conv["user"]["lastName"], "Wonderland")
        self.assertEqual(alice_conv["unreadCount"], 1)
        self.assertEqual(alice_conv["lastMessage"]["message"], "Hello, is this the official support channel?")

    # =========================================================================
    # SCENARIO 3: High-Volume Rapid Messaging Integrity
    # =========================================================================

    @patch.object(TelegramBotGateway, "send_telegram_message")
    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_tier4_scenario3_high_volume_rapid_messaging(self, mock_ws_notify, mock_tg_send):
        """
        Scenario 3: High-Volume Rapid Messaging (F1, F3)
        Simulate 15 rapid messages from 3 different clients and operator replies.
        Verifies database transaction integrity and message sequence.
        """
        mock_tg_send.return_value = {"ok": True, "result": {"message_id": 777}}

        clients = ["cust_alpha", "cust_beta", "cust_gamma"]

        # Ingest 5 messages per client rapidly
        msg_count = 0
        for c_idx, cid in enumerate(clients):
            for i in range(5):
                msg_count += 1
                payload = {
                    "update_id": 70000 + msg_count,
                    "message": {
                        "message_id": msg_count,
                        "from": {"id": 1000 + c_idx, "first_name": f"Client_{cid}"},
                        "chat": {"id": 1000 + c_idx},
                        "text": f"Rapid message #{i+1} from {cid}",
                    },
                }
                resp = self.client.post(f"/api/telegram/webhook/{self.user_id}/", payload, format="json")
                self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Verify all 15 inbound messages are recorded
        inbound_count = ChatMessage.objects.filter(to_user=self.user_id, is_outgoing=False).count()
        self.assertEqual(inbound_count, 15)

        # Operator logs in and replies once to each client
        rapid_session = DeviceSession.create_session(employee=self.employee, device_name="Rapid Desk")
        for c_idx, cid in enumerate(clients):
            resp = self.client.post("/api/messages/send/", {
                "User-ID": self.user_id,
                "to-user": str(1000 + c_idx),
                "message": f"Acknowledged request from {cid}",
            }, format="json", HTTP_AUTHORIZATION=f"Bearer {rapid_session.session_token}")
            self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Verify total messages = 15 inbound + 3 outgoing = 18
        self.assertEqual(ChatMessage.objects.count(), 18)
        self.assertEqual(mock_tg_send.call_count, 3)

    # =========================================================================
    # SCENARIO 4: Clean 1-on-1 Boundary Check (Negative Group Verification)
    # =========================================================================

    def test_tier4_scenario4_clean_1on1_boundary_check(self):
        """
        Scenario 4: Negative Group Removal & Clean 1-on-1 Verification (F4)
        Verifies all conversations returned by the backend are strictly 1-on-1 with isGroup=False.
        """
        # Create client
        TelegramUser.objects.create(telegram_id="test_client_99", first_name="Single Client")
        ChatMessage.objects.create(
            message_uid="msg_single_1",
            sender_id="test_client_99",
            to_user=self.user_id,
            message="1-on-1 chat only",
        )

        resp = self.client.get(f"/api/chats/?User-ID={self.user_id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        for conv in resp.data:
            self.assertFalse(conv.get("isGroup", False), "System must operate strictly in 1-on-1 mode without groups")

    # =========================================================================
    # SCENARIO 5: Full Offline Self-Hosted Test
    # =========================================================================

    @patch("requests.post")
    @patch("requests.get")
    def test_tier4_scenario5_full_offline_self_hosted_execution(self, mock_get, mock_post):
        """
        Scenario 5: Full Offline Self-Hosted Test (F1, F2, F3, F4, F5)
        Complete execution of operator login, customer update ingestion, chat query,
        outbound reply, and logout with zero external network socket connections.
        """
        mock_post.return_value.json.return_value = {"ok": True, "result": {"message_id": 9999}}
        mock_get.return_value.json.return_value = {"ok": True, "result": {}}

        # 1. Login
        login_resp = self.client.post("/api/auth/login/", {
            "User-ID": self.user_id,
            "password": self.password,
            "device_name": "Offline Workstation",
        })
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        token = login_resp.data["token"]

        # 2. Inbound simulated client
        self.client.post(f"/api/telegram/webhook/{self.user_id}/", {
            "update_id": 1,
            "message": {
                "message_id": 1,
                "from": {"id": 777777, "first_name": "Offline Tester"},
                "chat": {"id": 777777},
                "text": "Self-hosted offline test message",
            },
        }, format="json")

        # 3. List chats
        chats = self.client.get(f"/api/chats/?User-ID={self.user_id}")
        self.assertEqual(chats.status_code, status.HTTP_200_OK)

        # 4. Outgoing reply
        send_resp = self.client.post("/api/messages/send/", {
            "User-ID": self.user_id,
            "to-user": "777777",
            "message": "Self-hosted reply works perfectly offline",
        }, format="json", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(send_resp.status_code, status.HTTP_200_OK)

        # 5. Logout
        logout_resp = self.client.post("/api/auth/logout/", {"session_token": token}, format="json")
        self.assertEqual(logout_resp.status_code, status.HTTP_200_OK)
