from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from src.employees.models import Employee
from src.users.serializers import UserSerializer

EMPLOYEE_PERMISSION_FIELDS = (
    "tasks_can_edit",
    "tasks_can_delete",
    "tasks_can_create",
    "accounting_can_retrieve",
    "accounting_can_create",
    "accounting_can_update",
    "accounting_can_delete",
    "deals_can_create",
    "deals_can_delete",
    "deals_can_update",
    "employees_can_delete",
    "employees_can_create",
    "employees_can_update",
    "wallets_can_create",
    "wallets_can_update",
    "wallets_can_delete",
)


class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Employee
        fields = (
            "id",
            "user",
            "role",
            "salary",
        ) + EMPLOYEE_PERMISSION_FIELDS
        read_only_fields = ("id",)

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if not self._can_see_salary():
            data["salary"] = "***"

        return data

    def _can_see_salary(self):
        request = self.context.get("request")

        if request is None or not request.user.is_authenticated:
            return False

        if request.user.is_staff or request.user.is_superuser:
            return True

        try:
            employee = request.user.employee
        except ObjectDoesNotExist:
            return False

        return bool(employee.employees_can_create or employee.employees_can_update)


class EmployeeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = (
            "role",
            "salary",
        ) + EMPLOYEE_PERMISSION_FIELDS
        read_only_fields = ("id", "user")


class EmployeeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = (
            "id",
            "user",
            "role",
            "salary",
        ) + EMPLOYEE_PERMISSION_FIELDS
        read_only_fields = ("id",)
