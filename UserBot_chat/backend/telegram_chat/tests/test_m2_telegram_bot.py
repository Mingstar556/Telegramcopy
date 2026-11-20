"""
Automated Test Suite for Milestone 2: Telegram Bot Integration & Chat Auto-Fetching (R2).
Covers:
- TelegramBotGateway.sync_bot_conversations (getUpdates, offset tracking, update parsing, idempotency)
- TelegramUser upsertion & ChatMessage persistence for various update types (message, callback_query, media, sticker)
- Auto-fetching during employee login_view
- Auto-fetching during chats_list (?sync=true)
- Explicit sync endpoint POST /api/telegram/sync/
- Outgoing message dispatch via send_message and offline fallback
- Inbound webhook handlers (/api/telegram/webhook/ and /api/telegram/webhook/<user_id>/)
- Offline resilience (ConnectionError, Timeout, API error responses, missing tokens)
"""

from unittest.mock import patch, MagicMock
import requests
import concurrent.futures
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status

from telegram_chat.models import EmployeeAccount, BotAccount, TelegramUser, ChatMessage, DeviceSession
from telegram_chat.bot_service import TelegramBotGateway, TELEGRAM_API_BASE


class Milestone2TelegramBotTests(TestCase):
    """
    Test suite for Milestone 2 Telegram Bot Gateway, Auto-Fetching Engine,
    and associated REST & Webhook endpoints.
    """

    def setUp(self):
        self.client = APIClient()
        self.operator_id = "1234"
        self.customer_tg_id = "987654321"
        self.bot_token = "8290871821:AAF9tDx7ygLuVxb76d5XkNt6VfkyT2tqP3g"

        # Create test employee and bot account
        self.employee = EmployeeAccount.objects.create(
            user_id=self.operator_id,
            username="Operator John",
            password="password123",
            role="operator",
            avatar="https://example.com/avatar.png",
            is_active=True,
        )
        self.bot = BotAccount.objects.create(
            employee=self.employee,
            user_id=self.operator_id,
            password="password123",
            bot_token=self.bot_token,
            bot_name="Support Desk Bot",
            bot_username="support_desk_bot",
        )
        self.session = DeviceSession.create_session(
            employee=self.employee,
            device_name="Test Workstation",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.session.session_token}")

        # Reset gateway internal offset tracker before each test
        TelegramBotGateway.reset_offset()

    # =========================================================================
    # 1. CONVERSATION AUTO-FETCHING ENGINE (sync_bot_conversations)
    # =========================================================================

    @patch("requests.get")
    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_sync_bot_conversations_success(self, mock_ws, mock_get):
        """Verify sync_bot_conversations fetches updates, upserts users, persists messages, and updates offset."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "ok": True,
            "result": [
                {
                    "update_id": 101,
                    "message": {
                        "message_id": 1001,
                        "from": {
                            "id": 111222,
                            "first_name": "Alice",
                            "last_name": "Smith",
                            "username": "alice_s",
                        },
                        "chat": {"id": 111222, "type": "private"},
                        "date": 1700000001,
                        "text": "Hello, need pricing details",
                    },
                },
                {
                    "update_id": 102,
                    "message": {
                        "message_id": 1002,
                        "from": {
                            "id": 333444,
                            "first_name": "Bob",
                            "last_name": "Jones",
                            "username": "bobj",
                        },
                        "chat": {"id": 333444, "type": "private"},
                        "date": 1700000002,
                        "text": "Where is my invoice?",
                    },
                },
            ],
        }
        mock_get.return_value = mock_response

        result = TelegramBotGateway.sync_bot_conversations(self.operator_id)

        # 1. Verify returned statistics
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["synced_users"], 2)
        self.assertEqual(result["synced_messages"], 2)
        self.assertEqual(result["last_update_id"], 102)

        # 2. Verify TelegramUser upsertion
        user_alice = TelegramUser.objects.filter(telegram_id="111222").first()
        self.assertIsNotNone(user_alice)
        self.assertEqual(user_alice.first_name, "Alice")
        self.assertEqual(user_alice.username, "alice_s")

        user_bob = TelegramUser.objects.filter(telegram_id="333444").first()
        self.assertIsNotNone(user_bob)
        self.assertEqual(user_bob.first_name, "Bob")
        self.assertEqual(user_bob.username, "bobj")

        # 3. Verify ChatMessage creation
        msg_alice = ChatMessage.objects.filter(sender_id="111222", to_user=self.operator_id).first()
        self.assertIsNotNone(msg_alice)
        self.assertEqual(msg_alice.message, "Hello, need pricing details")
        self.assertFalse(msg_alice.is_outgoing)
        self.assertEqual(msg_alice.status, "delivered")

        msg_bob = ChatMessage.objects.filter(sender_id="333444", to_user=self.operator_id).first()
        self.assertIsNotNone(msg_bob)
        self.assertEqual(msg_bob.message, "Where is my invoice?")
        self.assertFalse(msg_bob.is_outgoing)

        # 4. Verify WebSocket broadcast notifications (2 broadcasts)
        self.assertEqual(mock_ws.call_count, 2)

    @patch("requests.get")
    def test_sync_bot_conversations_offset_tracking(self, mock_get):
        """Verify getUpdates uses offset tracking so updates are acknowledged and not re-fetched."""
        # First batch returns update 201 and 202
        mock_response_1 = MagicMock()
        mock_response_1.json.return_value = {
            "ok": True,
            "result": [
                {
                    "update_id": 201,
                    "message": {
                        "message_id": 2001,
                        "from": {"id": 111, "first_name": "User1"},
                        "text": "Message 1",
                    },
                },
                {
                    "update_id": 202,
                    "message": {
                        "message_id": 2002,
                        "from": {"id": 111, "first_name": "User1"},
                        "text": "Message 2",
                    },
                },
            ],
        }
        mock_get.return_value = mock_response_1

        res1 = TelegramBotGateway.sync_bot_conversations(self.operator_id)
        self.assertEqual(res1["last_update_id"], 202)

        # Second batch: offset should now be 203
        mock_response_2 = MagicMock()
        mock_response_2.json.return_value = {
            "ok": True,
            "result": [
                {
                    "update_id": 203,
                    "message": {
                        "message_id": 2003,
                        "from": {"id": 111, "first_name": "User1"},
                        "text": "Message 3",
                    },
                }
            ],
        }
        mock_get.return_value = mock_response_2

        res2 = TelegramBotGateway.sync_bot_conversations(self.operator_id)
        self.assertEqual(res2["last_update_id"], 203)

        # Verify the second call to requests.get was made with offset=203
        second_call_params = mock_get.call_args[1]["params"]
        self.assertEqual(second_call_params.get("offset"), 203)

    @patch("requests.get")
    def test_sync_bot_conversations_idempotency(self, mock_get):
        """Verify receiving identical update does not create duplicate ChatMessage records."""
        update_payload = {
            "update_id": 301,
            "message": {
                "message_id": 3001,
                "from": {"id": 555, "first_name": "RepeatedUser"},
                "text": "Duplicate test message",
            },
        }

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"ok": True, "result": [update_payload]}
        mock_get.return_value = mock_resp

        # First sync
        res1 = TelegramBotGateway.sync_bot_conversations(self.operator_id)
        self.assertEqual(res1["synced_messages"], 1)

        # Second sync with same message_id
        res2 = TelegramBotGateway.sync_bot_conversations(self.operator_id)
        self.assertEqual(res2["synced_messages"], 0)

        # Confirm only 1 message exists in DB
        self.assertEqual(ChatMessage.objects.filter(sender_id="555").count(), 1)

    @patch("requests.get")
    def test_sync_bot_conversations_handles_sticker_and_media(self, mock_get):
        """Verify sync parses photo, voice, video, audio, and sticker updates correctly."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "ok": True,
            "result": [
                {
                    "update_id": 401,
                    "message": {
                        "message_id": 4001,
                        "from": {"id": 777, "first_name": "MediaUser"},
                        "sticker": {
                            "file_id": "sticker_abc_123",
                            "emoji": "🎉",
                            "set_name": "celebrate_pack",
                        },
                    },
                },
                {
                    "update_id": 402,
                    "message": {
                        "message_id": 4002,
                        "from": {"id": 777, "first_name": "MediaUser"},
                        "video": {"file_id": "video_file_xyz", "duration": 15},
                        "caption": "Video demonstration",
                    },
                },
            ],
        }
        mock_get.return_value = mock_resp

        res = TelegramBotGateway.sync_bot_conversations(self.operator_id)
        self.assertEqual(res["synced_messages"], 2)

        # Check sticker message
        sticker_msg = ChatMessage.objects.filter(action="send_sticker").first()
        self.assertIsNotNone(sticker_msg)
        self.assertEqual(sticker_msg.sticker_id, "sticker_abc_123")
        self.assertEqual(sticker_msg.sticker_emoji, "🎉")
        self.assertEqual(sticker_msg.sticker_pack, "celebrate_pack")

        # Check video message
        video_msg = ChatMessage.objects.filter(media_type="video").first()
        self.assertIsNotNone(video_msg)
        self.assertEqual(video_msg.message, "Video demonstration")
        self.assertEqual(video_msg.media_duration, 15)

    @patch("requests.get")
    def test_sync_bot_conversations_handles_callback_query(self, mock_get):
        """Verify sync processes callback_query updates from inline keyboard buttons."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "ok": True,
            "result": [
                {
                    "update_id": 501,
                    "callback_query": {
                        "id": "cb_999",
                        "from": {"id": 888, "first_name": "ButtonUser"},
                        "message": {"message_id": 5001, "text": "Choose an option:"},
                        "data": "action_select_package_pro",
                    },
                }
            ],
        }
        mock_get.return_value = mock_resp

        res = TelegramBotGateway.sync_bot_conversations(self.operator_id)
        self.assertEqual(res["synced_messages"], 1)

        cb_msg = ChatMessage.objects.filter(sender_id="888").first()
        self.assertIsNotNone(cb_msg)
        self.assertEqual(cb_msg.message, "action_select_package_pro")

    # =========================================================================
    # 2. AUTO-FETCH HOOK IN LOGIN VIEW
    # =========================================================================

    @patch.object(TelegramBotGateway, "sync_bot_conversations")
    def test_login_view_triggers_sync_bot_conversations(self, mock_sync):
        """Verify login_view triggers sync_bot_conversations for the authenticated operator."""
        mock_sync.return_value = {"status": "success", "synced_users": 1, "synced_messages": 1}

        payload = {
            "User-ID": self.operator_id,
            "password": "password123",
            "device_name": "Test Laptop",
            "device_type": "desktop",
        }
        resp = self.client.post("/api/auth/login/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("token", resp.data)

        # Verify sync_bot_conversations was called with operator's user_id
        mock_sync.assert_called_once_with(operator_id=self.operator_id)

    @patch.object(TelegramBotGateway, "sync_bot_conversations")
    def test_login_view_survives_sync_failure_gracefully(self, mock_sync):
        """Verify login succeeds even if background sync encounters an error or network drop."""
        mock_sync.side_effect = requests.exceptions.ConnectionError("Connection timed out")

        payload = {
            "User-ID": self.operator_id,
            "password": "password123",
        }
        resp = self.client.post("/api/auth/login/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data["User-ID"], self.operator_id)

    # =========================================================================
    # 3. AUTO-FETCH HOOK IN CHATS LIST VIEW
    # =========================================================================

    @patch.object(TelegramBotGateway, "sync_bot_conversations")
    def test_chats_list_with_sync_param_triggers_sync(self, mock_sync):
        """Verify GET /api/chats/?User-ID=1234&sync=true triggers sync_bot_conversations."""
        mock_sync.return_value = {"status": "success", "synced_users": 0, "synced_messages": 0}

        resp = self.client.get(f"/api/chats/?User-ID={self.operator_id}&sync=true")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        mock_sync.assert_called_once_with(operator_id=self.operator_id)

    @patch.object(TelegramBotGateway, "sync_bot_conversations")
    def test_chats_list_without_sync_param_skips_sync(self, mock_sync):
        """Verify GET /api/chats/?User-ID=1234 without sync parameter does not invoke sync."""
        resp = self.client.get(f"/api/chats/?User-ID={self.operator_id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        mock_sync.assert_not_called()

    # =========================================================================
    # 4. EXPLICIT SYNC ENDPOINT (POST & GET /api/telegram/sync/)
    # =========================================================================

    @patch.object(TelegramBotGateway, "sync_bot_conversations")
    def test_sync_telegram_endpoint_post_body(self, mock_sync):
        """Verify POST /api/telegram/sync/ with User-ID in body returns sync stats."""
        mock_sync.return_value = {
            "status": "success",
            "synced_users": 3,
            "synced_messages": 5,
            "last_update_id": 99999,
        }

        resp = self.client.post("/api/telegram/sync/", {"User-ID": self.operator_id}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "success")
        self.assertEqual(resp.data["synced_users"], 3)
        self.assertEqual(resp.data["synced_messages"], 5)
        self.assertEqual(resp.data["last_update_id"], 99999)
        mock_sync.assert_called_once_with(operator_id=self.operator_id)

    @patch.object(TelegramBotGateway, "sync_bot_conversations")
    def test_sync_telegram_endpoint_header_and_get(self, mock_sync):
        """Verify /api/telegram/sync/ accepts User-ID via HTTP header and GET method."""
        mock_sync.return_value = {
            "status": "success",
            "synced_users": 1,
            "synced_messages": 2,
            "last_update_id": 12345,
        }

        # Via HTTP header
        resp = self.client.post("/api/telegram/sync/", HTTP_USER_ID=self.operator_id)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["synced_messages"], 2)

        # Via GET query param
        resp2 = self.client.get(f"/api/telegram/sync/?User-ID={self.operator_id}")
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)

    # =========================================================================
    # 5. OUTGOING MESSAGE DISPATCH & OFFLINE FALLBACK
    # =========================================================================

    @patch("requests.post")
    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_send_message_dispatches_telegram_api(self, mock_ws, mock_post):
        """Verify POST /api/messages/send/ routes to Telegram Bot API and persists ChatMessage."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "ok": True,
            "result": {"message_id": 8888, "text": "Dispatch test"},
        }
        mock_post.return_value = mock_resp

        payload = {
            "User-ID": self.operator_id,
            "to-user": self.customer_tg_id,
            "message": "Dispatch test",
            "action": "send_message",
        }
        resp = self.client.post("/api/messages/send/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "success")
        self.assertTrue(resp.data["success"])
        self.assertIn("message", resp.data)
        self.assertEqual(resp.data["message"]["to_user"], self.customer_tg_id)

        # Verify DB record
        chat_msg = ChatMessage.objects.filter(message_uid=resp.data["message_id"]).first()
        self.assertIsNotNone(chat_msg)
        self.assertTrue(chat_msg.is_outgoing)
        self.assertEqual(chat_msg.status, "sent")

        # Verify Telegram API call
        mock_post.assert_called_once()
        self.assertIn(f"/bot{self.bot_token}/sendMessage", mock_post.call_args[0][0])

    @patch("requests.post")
    def test_send_message_offline_fallback(self, mock_post):
        """Verify send_message handles offline network error without crashing, saving message in DB."""
        mock_post.side_effect = requests.exceptions.ConnectionError("Network is unreachable")

        payload = {
            "User-ID": self.operator_id,
            "to-user": self.customer_tg_id,
            "message": "Offline test message",
        }
        resp = self.client.post("/api/messages/send/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("message_id", resp.data)

        # Message is preserved in database even if Telegram dispatch failed
        saved = ChatMessage.objects.filter(message_uid=resp.data["message_id"]).first()
        self.assertIsNotNone(saved)
        self.assertEqual(saved.message, "Offline test message")

    # =========================================================================
    # 6. INBOUND WEBHOOK HANDLER
    # =========================================================================

    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_inbound_webhook_default_route(self, mock_ws):
        """Verify POST /api/telegram/webhook/ without user_id in URL ingests update cleanly."""
        payload = {
            "update_id": 601,
            "message": {
                "message_id": 6001,
                "from": {
                    "id": 999111,
                    "first_name": "WebhookUser",
                    "username": "wh_user",
                },
                "chat": {"id": 999111},
                "text": "Inbound webhook test",
            },
        }
        resp = self.client.post("/api/telegram/webhook/", payload, format="json", HTTP_USER_ID=self.operator_id)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data.get("ok"))

        # Verify user and message created
        user = TelegramUser.objects.filter(telegram_id="999111").first()
        self.assertIsNotNone(user)
        self.assertEqual(user.first_name, "WebhookUser")

        msg = ChatMessage.objects.filter(sender_id="999111").first()
        self.assertIsNotNone(msg)
        self.assertEqual(msg.message, "Inbound webhook test")
        self.assertFalse(msg.is_outgoing)

    # =========================================================================
    # 7. OFFLINE RESILIENCE & ERROR HANDLING
    # =========================================================================

    @patch("requests.get")
    def test_sync_bot_conversations_catches_timeout(self, mock_get):
        """Verify sync_bot_conversations gracefully catches Timeout without crashing."""
        mock_get.side_effect = requests.exceptions.Timeout("Read timeout after 10s")

        result = TelegramBotGateway.sync_bot_conversations(self.operator_id)
        self.assertEqual(result["status"], "offline_or_failed")
        self.assertEqual(result["new_messages"], 0)
        self.assertIn("timeout", result["error"].lower())

    @patch("requests.get")
    def test_sync_bot_conversations_catches_connection_error(self, mock_get):
        """Verify sync_bot_conversations catches ConnectionError (DNS/network failure)."""
        mock_get.side_effect = requests.exceptions.ConnectionError("Failed to establish a new connection")

        result = TelegramBotGateway.sync_bot_conversations(self.operator_id)
        self.assertEqual(result["status"], "offline_or_failed")
        self.assertEqual(result["synced_messages"], 0)
        self.assertIn("error", result)

    @patch("requests.get")
    def test_sync_bot_conversations_handles_api_error_response(self, mock_get):
        """Verify sync_bot_conversations handles Telegram API returning ok=False."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "ok": False,
            "error_code": 401,
            "description": "Unauthorized: invalid bot token",
        }
        mock_get.return_value = mock_resp

        result = TelegramBotGateway.sync_bot_conversations(self.operator_id)
        self.assertEqual(result["status"], "offline_or_failed")
        self.assertIn("Unauthorized", result["error"])

    def test_sync_bot_conversations_no_token_returns_offline(self):
        """Verify sync returns offline status when no bot token is configured."""
        self.bot.bot_token = ""
        self.bot.save(update_fields=["bot_token"])

        with patch.dict("os.environ", {"TELEGRAM_BOT_TOKEN": ""}):
            with override_settings(TELEGRAM_BOT_TOKEN=""):
                result = TelegramBotGateway.sync_bot_conversations(self.operator_id)
                self.assertEqual(result["status"], "offline_or_failed")
                self.assertIn("No bot token", result["error"])


# =============================================================================
# 8. CONCURRENCY STORM TESTS (THREAD SYNCHRONIZATION & SQLITE LOCK IMMUNITY)
# =============================================================================

class Milestone2ConcurrencyStormTests(TransactionTestCase):
    """
    Concurrency storm tests verifying thread synchronization and SQLite lock immunity.
    """

    def setUp(self):
        self.operator_id = "1234"
        self.employee = EmployeeAccount.objects.create(
            user_id=self.operator_id,
            username="Operator Concurrency",
            password="password123",
            role="operator",
            is_active=True,
        )
        self.bot = BotAccount.objects.create(
            employee=self.employee,
            user_id=self.operator_id,
            password="password123",
            bot_token="8290871821:AAF9tDx7ygLuVxb76d5XkNt6VfkyT2tqP3g",
        )
        TelegramBotGateway.reset_offset()

    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    @patch("requests.get")
    def test_sync_bot_conversations_concurrency_storm_20_threads(self, mock_get, mock_ws):
        """Verify 20 concurrent threads calling sync_bot_conversations suffer zero lock collisions."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "ok": True,
            "result": [
                {
                    "update_id": 9999,
                    "message": {
                        "message_id": 99991,
                        "from": {"id": 888777, "first_name": "StormUser"},
                        "chat": {"id": 888777},
                        "text": "Storm test message",
                    },
                }
            ],
        }
        mock_get.return_value = mock_response

        results = []
        errors = []

        def worker_task(idx):
            try:
                res = TelegramBotGateway.sync_bot_conversations(self.operator_id)
                return res
            except Exception as e:
                errors.append(e)
                raise

        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(worker_task, i) for i in range(20)]
            for fut in concurrent.futures.as_completed(futures):
                results.append(fut.result())

        self.assertEqual(len(errors), 0, f"Encountered concurrency errors: {errors}")
        self.assertEqual(len(results), 20)
        for r in results:
            self.assertIn(r["status"], ["success", "offline_or_failed"])

        # Exactly 1 message should be created due to idempotency & lock protection
        created_count = ChatMessage.objects.filter(message_uid="msg_tg_888777_99991").count()
        self.assertEqual(created_count, 1)


# =============================================================================
# 9. BOUNDARY ROBUSTNESS & MALFORMED UPDATE TESTS
# =============================================================================

class Milestone2BoundaryRobustnessTests(TestCase):
    """
    Targeted tests for boundary robustness and malformed update parsing.
    """

    def setUp(self):
        self.client = APIClient()
        self.operator_id = "1234"
        self.bot_token = "8290871821:AAF9tDx7ygLuVxb76d5XkNt6VfkyT2tqP3g"

        self.employee = EmployeeAccount.objects.create(
            user_id=self.operator_id,
            username="Operator Boundary",
            password="password123",
            role="operator",
            is_active=True,
        )
        self.bot = BotAccount.objects.create(
            employee=self.employee,
            user_id=self.operator_id,
            password="password123",
            bot_token=self.bot_token,
        )
        self.session = DeviceSession.create_session(
            employee=self.employee,
            device_name="Boundary Test Device",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.session.session_token}")
        TelegramBotGateway.reset_offset()

    def test_incoming_update_null_from_and_chat_returns_false_safely(self):
        """Verify update with null 'from' and 'chat' returns False without raising AttributeError."""
        update = {"message": {"from": None, "chat": None}}
        result = TelegramBotGateway.handle_incoming_telegram_update(self.operator_id, update)
        self.assertFalse(result)

    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_incoming_update_photo_with_empty_dict_safely_handled(self, mock_ws):
        """Verify photo with empty dictionary [{}] does not raise KeyError: 'file_id' or TypeError."""
        update = {
            "message": {
                "message_id": 7001,
                "from": {"id": 1001, "first_name": "PhotoTester"},
                "chat": {"id": 1001},
                "photo": [{}],
            }
        }
        result = TelegramBotGateway.handle_incoming_telegram_update(self.operator_id, update)
        self.assertTrue(result)
        msg = ChatMessage.objects.filter(message_uid="msg_tg_1001_7001").first()
        self.assertIsNotNone(msg)
        self.assertEqual(msg.media_type, "photo")

    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    def test_incoming_update_null_media_subfields_safely_handled(self, mock_ws):
        """Verify updates with explicit null media objects ('voice': None, etc.) do not crash."""
        for idx, media_key in enumerate(["voice", "video", "audio", "document", "sticker"]):
            msg_id = 7010 + idx
            update = {
                "message": {
                    "message_id": msg_id,
                    "from": {"id": 1002, "first_name": "NullMediaTester"},
                    "chat": {"id": 1002},
                    media_key: None,
                    "text": f"Testing null {media_key}",
                }
            }
            result = TelegramBotGateway.handle_incoming_telegram_update(self.operator_id, update)
            self.assertTrue(result, f"Failed on media_key: {media_key}")
            self.assertTrue(ChatMessage.objects.filter(message_uid=f"msg_tg_1002_{msg_id}").exists())

    def test_incoming_update_corrupt_types_safely_handled(self):
        """Verify corrupted data types (string for message, callback_query, etc.) return False safely."""
        self.assertFalse(TelegramBotGateway.handle_incoming_telegram_update(self.operator_id, {"message": "invalid_string"}))
        self.assertFalse(TelegramBotGateway.handle_incoming_telegram_update(self.operator_id, {"callback_query": "invalid_string"}))
        self.assertFalse(TelegramBotGateway.handle_incoming_telegram_update(self.operator_id, {"callback_query": {"from": None, "message": None}}))

    @patch.object(TelegramBotGateway, "notify_operator_via_websocket")
    @patch("requests.get")
    def test_sync_bot_conversations_batch_isolation_survives_malformed_update(self, mock_get, mock_ws):
        """Verify batch polling processes valid updates even when an interleaved update is malformed."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "ok": True,
            "result": [
                {
                    "update_id": 801,
                    "message": {
                        "message_id": 8001,
                        "from": {"id": 2001, "first_name": "Valid1"},
                        "chat": {"id": 2001},
                        "text": "First valid message",
                    },
                },
                {
                    "update_id": 802,
                    "message": {
                        "from": None,
                        "chat": None,
                    },
                },
                {
                    "update_id": 803,
                    "message": {
                        "message_id": 8003,
                        "from": {"id": 2002, "first_name": "Valid2"},
                        "chat": {"id": 2002},
                        "text": "Second valid message",
                    },
                },
            ],
        }
        mock_get.return_value = mock_response

        res = TelegramBotGateway.sync_bot_conversations(self.operator_id)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["last_update_id"], 803)

        # Both valid messages must be saved in the database
        self.assertTrue(ChatMessage.objects.filter(message_uid="msg_tg_2001_8001").exists())
        self.assertTrue(ChatMessage.objects.filter(message_uid="msg_tg_2002_8003").exists())

    @patch("requests.post")
    def test_send_message_view_non_dict_media_and_sticker_handled_safely(self, mock_post):
        """Verify /api/messages/send/ handles non-dict media and sticker values without 500 error."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"ok": True, "result": {"message_id": 12345}}
        mock_post.return_value = mock_resp

        payload = {
            "User-ID": self.operator_id,
            "to-user": "987654321",
            "message": "Testing corrupted media payload",
            "media": "this_is_a_string_not_dict",
            "sticker": 123456,
        }
        resp = self.client.post("/api/messages/send/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data.get("success"))

        saved_msg = ChatMessage.objects.filter(message="Testing corrupted media payload").first()
        self.assertIsNotNone(saved_msg)
        self.assertIsNone(saved_msg.media_type)
        self.assertIsNone(saved_msg.sticker_id)

    def test_send_telegram_message_non_dict_media_and_sticker_handled_safely(self):
        """Verify TelegramBotGateway.send_telegram_message safely handles non-dict media and sticker."""
        result = TelegramBotGateway.send_telegram_message(
            bot_token=self.bot_token,
            chat_id="987654321",
            text="Testing non-dict media handling",
            media="invalid_string",
            sticker="invalid_string",
        )
        self.assertIsInstance(result, dict)
