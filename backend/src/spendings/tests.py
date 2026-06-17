from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.enums import UserRole
from src.spendings.models import MonthlyObligation, Spending
from src.spendings.services import (
    charge_due_monthly_obligations,
    exclude_monthly_obligation_current_month,
)
from src.wallets.models import Wallet


class MonthlyObligationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = get_user_model().objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="password",
            role=UserRole.EMPLOYEE,
        )
        self.client.force_authenticate(self.admin)

    def test_create_monthly_obligation(self):
        response = self.client.post(
            "/api/spendings/monthly-obligations/",
            {
                "name": "Зарплаты",
                "type": "Зарплаты",
                "amount": "2500000.00",
                "due_date": "2026-06-25",
                "note": "Минимальный фонд оплаты труда",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "Зарплаты")
        self.assertEqual(response.data["type"], "Зарплаты")
        self.assertEqual(response.data["charge_day"], 25)
        self.assertTrue(response.data["is_active"])
        self.assertEqual(MonthlyObligation.objects.count(), 1)

    def test_analytics_sums_only_active_obligations(self):
        MonthlyObligation.objects.create(
            name="Зарплаты",
            type="Зарплаты",
            amount="2500000.00",
            due_date="2026-06-25",
            charge_day=25,
        )
        MonthlyObligation.objects.create(
            name="ИИ сервисы",
            type="ИИ сервисы",
            amount="300000.00",
            due_date="2026-06-05",
            charge_day=5,
        )
        MonthlyObligation.objects.create(
            name="Старый офис",
            type="Аренда офиса",
            amount="700000.00",
            due_date="2026-06-10",
            charge_day=10,
            is_active=False,
        )

        response = self.client.get("/api/spendings/monthly-obligations/analytics/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"]["count"], 2)
        self.assertEqual(response.data["total"]["total_amount"], Decimal("2800000.00"))

    def test_due_obligation_creates_spending_and_decreases_wallet_once(self):
        wallet = Wallet.default()
        balance_before = wallet.balance
        MonthlyObligation.objects.create(
            name="OpenAI",
            type="ИИ сервисы",
            amount="100000.00",
            due_date=date(2026, 6, 17),
            charge_day=17,
        )

        result = charge_due_monthly_obligations(
            today=date(2026, 6, 17),
            notify=False,
        )

        self.assertEqual(result["created_count"], 1)
        self.assertEqual(Spending.objects.count(), 1)
        spending = Spending.objects.get()
        self.assertEqual(spending.type, "ИИ сервисы")
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, balance_before - Decimal("100000.00"))

        repeat = charge_due_monthly_obligations(
            today=date(2026, 6, 17),
            notify=False,
        )

        self.assertEqual(repeat["created_count"], 0)
        self.assertEqual(Spending.objects.count(), 1)

    def test_excluding_current_month_removes_existing_auto_spending(self):
        wallet = Wallet.default()
        balance_before = wallet.balance
        obligation = MonthlyObligation.objects.create(
            name="Офис",
            type="Аренда офиса",
            amount="500000.00",
            due_date=date(2026, 6, 10),
            charge_day=10,
        )
        charge_due_monthly_obligations(today=date(2026, 6, 17), notify=False)

        self.assertEqual(Spending.objects.count(), 1)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, balance_before - Decimal("500000.00"))

        result = exclude_monthly_obligation_current_month(
            obligation.id,
            actor=self.admin,
            today=date(2026, 6, 17),
        )

        self.assertIsNotNone(result["removed_spending_id"])
        self.assertEqual(Spending.objects.count(), 0)
        obligation.refresh_from_db()
        self.assertEqual(obligation.excluded_for, date(2026, 6, 1))
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, balance_before)

    def test_excluding_current_month_prevents_due_auto_spending(self):
        obligation = MonthlyObligation.objects.create(
            name="Google Workspace",
            type="ИИ сервисы",
            amount="45000.00",
            due_date=date(2026, 6, 20),
            charge_day=20,
        )
        exclude_monthly_obligation_current_month(
            obligation.id,
            actor=self.admin,
            today=date(2026, 6, 17),
        )

        result = charge_due_monthly_obligations(
            today=date(2026, 6, 30),
            notify=False,
        )

        self.assertEqual(result["created_count"], 0)
        self.assertEqual(Spending.objects.count(), 0)
        obligation.refresh_from_db()
        self.assertEqual(obligation.due_date, date(2026, 7, 20))
