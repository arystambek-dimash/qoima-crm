from re import search
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.enums import UserRole
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


class ClientApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superuser = get_user_model().objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="admin-password",
        )
        self.employee = get_user_model().objects.create_user(
            username="employee",
            email="employee@example.com",
            password="password",
        )
        self.collaborator = get_user_model().objects.create_user(
            username="client-x",
            email="client-x@example.com",
            password="client-password",
            role=UserRole.COLLABORATOR,
        )

    def test_only_superuser_can_access_clients(self):
        self.assertEqual(self.client.get("/api/clients/").status_code, 401)

        self.client.force_authenticate(self.employee)
        self.assertEqual(self.client.get("/api/clients/").status_code, 403)

        self.client.force_authenticate(self.collaborator)
        self.assertEqual(self.client.get("/api/clients/").status_code, 403)

    def test_superuser_lists_only_collaborators(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.get("/api/clients/")

        self.assertEqual(response.status_code, 200)
        ids = {item["id"] for item in self.results(response)}
        self.assertEqual(ids, {self.collaborator.id})

    def test_superuser_creates_client_who_can_login(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.post(
            "/api/clients/",
            {
                "email": "new-client@example.com",
                "password": "secret-123",
                "first_name": "Новый",
                "last_name": "Клиент",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(email="new-client@example.com")
        self.assertEqual(user.role, UserRole.COLLABORATOR)

        login = APIClient().post(
            "/api/users/login-via-email/",
            {"email": "new-client@example.com", "password": "secret-123"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertIn("access", login.data)

    def test_create_client_rejects_duplicate_email(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.post(
            "/api/clients/",
            {"email": "CLIENT-X@example.com", "password": "secret-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_create_client_rejects_short_password(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.post(
            "/api/clients/",
            {"email": "short-pass@example.com", "password": "1234567"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_superuser_updates_client_data(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.patch(
            f"/api/clients/{self.collaborator.id}/",
            {"first_name": "Обновлённый", "email": "renamed@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.collaborator.refresh_from_db()
        self.assertEqual(self.collaborator.first_name, "Обновлённый")
        self.assertEqual(self.collaborator.email, "renamed@example.com")

    def test_clients_endpoint_cannot_touch_employees(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.patch(
            f"/api/clients/{self.employee.id}/",
            {"first_name": "Hacked"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)

    def test_set_password_changes_login(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.post(
            f"/api/clients/{self.collaborator.id}/set-password/",
            {"password": "new-secret-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.collaborator.refresh_from_db()
        self.assertFalse(self.collaborator.check_password("client-password"))
        self.assertTrue(self.collaborator.check_password("new-secret-123"))

    def results(self, response):
        return response.data.get("results", response.data)
