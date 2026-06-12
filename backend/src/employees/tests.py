from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from src.employees.models import Employee
from src.employees.serializers import EmployeeSerializer


class EmployeeSalaryVisibilityTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.viewer = get_user_model().objects.create_user(
            username="viewer",
            email="viewer@example.com",
            password="password",
        )
        self.viewer_employee = Employee.objects.create(
            user=self.viewer,
            role="Manager",
            salary="200000.00",
        )
        target_user = get_user_model().objects.create_user(
            username="target",
            email="target@example.com",
            password="password",
        )
        self.target_employee = Employee.objects.create(
            user=target_user,
            role="Sales",
            salary="100000.00",
        )

    def test_employee_management_permissions_can_see_salary(self):
        for permission in ("employees_can_create", "employees_can_update"):
            with self.subTest(permission=permission):
                setattr(self.viewer_employee, permission, True)
                self.viewer_employee.save(update_fields=(permission,))

                data = self._serialize_for(self.viewer)

                self.assertEqual(data["salary"], "100000.00")

                setattr(self.viewer_employee, permission, False)
                self.viewer_employee.save(update_fields=(permission,))

    def test_regular_employee_cannot_see_salary(self):
        data = self._serialize_for(self.viewer)

        self.assertEqual(data["salary"], "***")

    def _serialize_for(self, user):
        request = self.factory.get("/api/employees/")
        request.user = user
        return EmployeeSerializer(
            self.target_employee,
            context={"request": request},
        ).data
