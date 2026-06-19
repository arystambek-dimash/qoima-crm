from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.enums import DealPaymentType, UserRole
from src.deals.models import Deal
from src.employees.models import Employee
from src.onboards.models import Onboard, Task, TaskCategory, TaskPerformance


class DashboardMyTasksTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()
        user_model = get_user_model()
        self.employee_user = user_model.objects.create_user(
            username="employee",
            email="employee@example.com",
            password="password",
            role=UserRole.EMPLOYEE,
        )
        Employee.objects.create(
            user=self.employee_user,
            role="manager",
            salary="100000.00",
        )
        self.other_employee_user = user_model.objects.create_user(
            username="other-employee",
            email="other-employee@example.com",
            password="password",
            role=UserRole.EMPLOYEE,
        )
        Employee.objects.create(
            user=self.other_employee_user,
            role="manager",
            salary="100000.00",
        )
        collaborator = user_model.objects.create_user(
            username="client",
            email="client@example.com",
            password="password",
            role=UserRole.COLLABORATOR,
        )
        deal = Deal.objects.create(
            name="Client portal",
            user=collaborator,
            stage="active",
            date_start=self.today,
            date_end=self.today,
            deal_amount="250000.00",
            payment_type=DealPaymentType.CASH,
        )
        onboard = Onboard.objects.create(
            name="Launch",
            deal=deal,
            term_of_end=self.today,
        )
        self.category = TaskCategory.objects.create(
            name="Delivery",
            onboard=onboard,
        )

    def test_my_tasks_is_available_without_accounting_permission(self):
        overdue = self.create_task("Overdue", days=-1)
        today = self.create_task("Today", days=0)
        soon = self.create_task("Soon", days=2)
        later = self.create_task("Later", days=10)
        completed = self.create_task(
            "Completed",
            days=1,
            status=Task.Status.DONE,
            is_active=False,
        )
        other = self.create_task("Other employee task", days=-3)

        for task in [overdue, today, soon, later, completed]:
            TaskPerformance.objects.create(task=task, user=self.employee_user)
        TaskPerformance.objects.create(task=other, user=self.other_employee_user)

        self.client.force_authenticate(self.employee_user)
        response = self.client.get("/api/dashboard/my-tasks/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["assigned_total"], 5)
        self.assertEqual(response.data["summary"]["open"], 4)
        self.assertEqual(response.data["summary"]["completed"], 1)
        self.assertEqual(response.data["summary"]["overdue"], 1)
        self.assertEqual(response.data["summary"]["due_today"], 1)
        self.assertGreater(response.data["summary"]["workload"]["percent"], 0)
        self.assertEqual(
            [item["name"] for item in response.data["tasks"]],
            ["Overdue", "Today", "Soon", "Later"],
        )
        self.assertEqual(response.data["tasks"][0]["urgency"], "overdue")
        self.assertEqual(response.data["tasks"][1]["urgency"], "today")

    def test_finance_analytics_still_requires_accounting_permission(self):
        self.client.force_authenticate(self.employee_user)

        response = self.client.get("/api/dashboard/analytics/")

        self.assertEqual(response.status_code, 403)

    def create_task(
        self,
        name,
        days,
        status=Task.Status.TODO,
        is_active=True,
    ):
        due_date = self.today + timedelta(days=days)
        return Task.objects.create(
            category=self.category,
            name=name,
            type="deliverable",
            status=status,
            is_active=is_active,
            description="Description",
            date_start=self.today,
            date_end=due_date,
        )
