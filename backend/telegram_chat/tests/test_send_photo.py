import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from telegram_chat.models import EmployeeAccount, BotAccount, TelegramUser, ChatMessage


class SendPhotoEndpointTests(TestCase):
    def setUp(self):
        self.raw_message_without_caption = """[11/17/2026 11:29 PM] Kavv 502: api/send_photo

employee_id RY
to_userid = YEAK
file="jabkjdnaknwdawd/dajkhbwdbnaw.png"
Action = send_photo"""

        self.raw_message_with_caption = """[11/17/2026 11:29 PM] Kavv 502: api/send_photo

employee_id RY
to_userid = YEAK
caption="this is a caption"
file="jabkjdnaknwdawd/dajkhbwdbnaw.png"
Action = send_photo"""

        self.raw_both_messages = f"{self.raw_message_without_caption}\n{self.raw_message_with_caption}"

    @patch("telegram_chat.bot_service.TelegramBotGateway.send_telegram_message")
    @patch("telegram_chat.bot_service.TelegramBotGateway.notify_operator_via_websocket")
    def test_send_photo_exact_raw_text_with_caption(self, mock_ws, mock_tg):
        mock_tg.return_value = {"ok": True, "result": {"message_id": 101}}

        resp = self.client.post(
            "/api/send_photo/",
            data=self.raw_message_with_caption,
            content_type="text/plain"
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("employee_id"), "RY")
        self.assertEqual(data.get("to_userid"), "YEAK")
        self.assertEqual(data.get("caption"), "this is a caption")
        self.assertEqual(data.get("file"), "jabkjdnaknwdawd/dajkhbwdbnaw.png")
        self.assertEqual(data.get("action"), "send_photo")

        # Verify DB records
        msg = ChatMessage.objects.filter(sender_id="RY", to_user="YEAK").first()
        self.assertIsNotNone(msg)
        self.assertEqual(msg.message, "this is a caption")
        self.assertEqual(msg.action, "send_photo")
        self.assertEqual(msg.media_type, "photo")
        self.assertEqual(msg.media_url, "jabkjdnaknwdawd/dajkhbwdbnaw.png")

        # Verify Telegram user and EmployeeAccount exist
        self.assertTrue(TelegramUser.objects.filter(telegram_id="YEAK").exists())
        self.assertTrue(EmployeeAccount.objects.filter(user_id="RY").exists())

        # Verify Telegram dispatch and WebSocket notification
        mock_tg.assert_called_once()
        mock_ws.assert_called()

    @patch("telegram_chat.bot_service.TelegramBotGateway.send_telegram_message")
    def test_send_photo_exact_raw_text_without_caption(self, mock_tg):
        mock_tg.return_value = {"ok": True, "result": {"message_id": 102}}

        resp = self.client.post(
            "/api/send_photo/",
            data=self.raw_message_without_caption,
            content_type="text/plain"
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("employee_id"), "RY")
        self.assertEqual(data.get("to_userid"), "YEAK")
        self.assertEqual(data.get("caption"), "")
        self.assertEqual(data.get("file"), "jabkjdnaknwdawd/dajkhbwdbnaw.png")

        msg = ChatMessage.objects.filter(sender_id="RY", to_user="YEAK").first()
        self.assertIsNotNone(msg)
        self.assertEqual(msg.message, "")

    @patch("telegram_chat.bot_service.TelegramBotGateway.send_telegram_message")
    def test_send_photo_both_messages_batch(self, mock_tg):
        mock_tg.return_value = {"ok": True, "result": {"message_id": 103}}

        resp = self.client.post(
            "/api/send_photo/",
            data=self.raw_both_messages,
            content_type="text/plain"
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("count"), 2)
        self.assertEqual(ChatMessage.objects.filter(sender_id="RY", to_user="YEAK").count(), 2)

    @patch("telegram_chat.bot_service.TelegramBotGateway.send_telegram_message")
    def test_send_photo_json_payload(self, mock_tg):
        mock_tg.return_value = {"ok": True, "result": {"message_id": 104}}

        payload = {
            "employee_id": "RY",
            "to_userid": "YEAK",
            "caption": "this is a caption",
            "file": "jabkjdnaknwdawd/dajkhbwdbnaw.png",
            "Action": "send_photo"
        }
        resp = self.client.post(
            "/api/send_photo/",
            data=json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("employee_id"), "RY")
        self.assertEqual(data.get("to_userid"), "YEAK")
        self.assertEqual(data.get("caption"), "this is a caption")

    @patch("telegram_chat.bot_service.TelegramBotGateway.send_telegram_message")
    def test_send_photo_form_urlencoded(self, mock_tg):
        mock_tg.return_value = {"ok": True, "result": {"message_id": 105}}

        payload = {
            "employee_id": "RY",
            "to_userid": "YEAK",
            "caption": "form caption",
            "file": "jabkjdnaknwdawd/dajkhbwdbnaw.png",
            "Action": "send_photo"
        }
        resp = self.client.post("/api/send_photo/", data=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("caption"), "form caption")

    @patch("telegram_chat.bot_service.TelegramBotGateway.send_telegram_message")
    def test_send_photo_multipart_file_upload(self, mock_tg):
        mock_tg.return_value = {"ok": True, "result": {"message_id": 106}}

        test_file = SimpleUploadedFile("test_photo.png", b"fake_png_data", content_type="image/png")
        payload = {
            "employee_id": "RY",
            "to_userid": "YEAK",
            "caption": "photo upload test",
            "file": test_file,
            "Action": "send_photo"
        }
        resp = self.client.post("/api/send_photo/", data=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("success"))
        self.assertIn("uploads/", data.get("file"))

    @patch("telegram_chat.bot_service.TelegramBotGateway.send_telegram_message")
    def test_url_routing_without_trailing_slash(self, mock_tg):
        mock_tg.return_value = {"ok": True, "result": {"message_id": 107}}

        payload = {
            "employee_id": "RY",
            "to_userid": "YEAK",
            "file": "jabkjdnaknwdawd/dajkhbwdbnaw.png",
            "Action": "send_photo"
        }
        # /api/send_photo without trailing slash
        resp1 = self.client.post("/api/send_photo", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(resp1.status_code, 200)

        # /send_photo root without api prefix
        resp2 = self.client.post("/send_photo", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(resp2.status_code, 200)

    def test_send_photo_missing_fields_validation(self):
        # Missing file
        resp = self.client.post(
            "/api/send_photo/",
            data=json.dumps({"employee_id": "RY", "to_userid": "YEAK"}),
            content_type="application/json"
        )
        self.assertEqual(resp.status_code, 400)

        # Missing to_userid
        resp2 = self.client.post(
            "/api/send_photo/",
            data=json.dumps({"employee_id": "RY", "file": "photo.png"}),
            content_type="application/json"
        )
        self.assertEqual(resp2.status_code, 400)
