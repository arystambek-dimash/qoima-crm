from re import search
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from src.users.models import PasswordResetCode
from src.users.password_reset import create_password_reset_code


class PasswordResetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="manager",
            email="manager@example.com",
            password="old-password",
            telegram_id=123456789,
        )

    @patch("src.users.views.TelegramClient.send_message", return_value=True)
    def test_password_reset_request_sends_code_to_linked_telegram_id(self, send_message):
        response = self.client.post(
            "/api/users/password-reset/request/",
            {"email": "MANAGER@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        send_message.assert_called_once()
        chat_id, text = send_message.call_args.args
        self.assertEqual(chat_id, self.user.telegram_id)
        self.assertRegex(text, r"\d{6}")
        self.assertTrue(
            PasswordResetCode.objects.filter(
                user=self.user,
                used_at__isnull=True,
            ).exists()
        )

    def test_password_reset_confirm_updates_password_once(self):
        code = create_password_reset_code(self.user)

        response = self.client.post(
            "/api/users/password-reset/confirm/",
            {
                "email": self.user.email,
                "code": code,
                "password": "new-password",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("new-password"))

        second_response = self.client.post(
            "/api/users/password-reset/confirm/",
            {
                "email": self.user.email,
                "code": code,
                "password": "another-password",
            },
            format="json",
        )

        self.assertEqual(second_response.status_code, 400)
        self.user.refresh_from_db()
        self.assertFalse(self.user.check_password("another-password"))

    @patch("src.users.views.TelegramClient.send_message", return_value=True)
    def test_password_reset_request_does_not_send_without_linked_telegram_id(
        self,
        send_message,
    ):
        get_user_model().objects.create_user(
            username="without-telegram",
            email="without-telegram@example.com",
            password="old-password",
        )

        response = self.client.post(
            "/api/users/password-reset/request/",
            {"email": "without-telegram@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        send_message.assert_not_called()

    @patch("src.users.views.TelegramClient.send_message", return_value=True)
    def test_password_reset_request_message_contains_generated_code(self, send_message):
        response = self.client.post(
            "/api/users/password-reset/request/",
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        text = send_message.call_args.args[1]
        match = search(r"\b(\d{6})\b", text)
        self.assertIsNotNone(match)
