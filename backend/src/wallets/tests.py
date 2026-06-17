from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.enums import UserRole
from src.employees.models import Employee
from src.wallets.models import Wallet, WalletLog


class WalletBalanceVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="cashier",
            email="cashier@example.com",
            password="password",
            role=UserRole.EMPLOYEE,
        )
        self.employee = Employee.objects.create(
            user=self.user,
            role="Cashier",
            salary="100000.00",
        )
        self.wallet = Wallet.default()
        self.wallet.name = "Company wallet"
        self.wallet.balance = "9850000.00"
        self.wallet.save(update_fields=("name", "balance"))
        WalletLog.objects.create(
            wallet=self.wallet,
            actor=self.user,
            action=WalletLog.Action.SPENDING_CREATED,
            amount_delta="-15000.00",
            balance_before="9865000.00",
            balance_after="9850000.00",
            description="Spending created: Builder.io",
        )

    def test_wallet_balance_and_logs_are_masked_without_permission(self):
        self.client.force_authenticate(self.user)

        wallet_response = self.client.get("/api/wallets/current/")
        logs_response = self.client.get("/api/wallets/logs/")

        self.assertEqual(wallet_response.status_code, 200)
        self.assertFalse(wallet_response.data["can_view_balance"])
        self.assertIsNone(wallet_response.data["balance"])

        self.assertEqual(logs_response.status_code, 200)
        log = self.results(logs_response)[0]
        self.assertFalse(log["can_view_balance"])
        self.assertIsNone(log["amount_delta"])
        self.assertIsNone(log["balance_before"])
        self.assertIsNone(log["balance_after"])

    def test_wallet_balance_and_logs_are_visible_with_permission(self):
        self.employee.wallets_can_view_balance = True
        self.employee.save(update_fields=("wallets_can_view_balance",))
        self.client.force_authenticate(self.user)

        wallet_response = self.client.get("/api/wallets/current/")
        logs_response = self.client.get("/api/wallets/logs/")

        self.assertEqual(wallet_response.status_code, 200)
        self.assertTrue(wallet_response.data["can_view_balance"])
        self.assertEqual(wallet_response.data["balance"], "9850000.00")

        self.assertEqual(logs_response.status_code, 200)
        log = self.results(logs_response)[0]
        self.assertTrue(log["can_view_balance"])
        self.assertEqual(log["amount_delta"], "-15000.00")
        self.assertEqual(log["balance_before"], "9865000.00")
        self.assertEqual(log["balance_after"], "9850000.00")

    def results(self, response):
        return response.data.get("results", response.data)
