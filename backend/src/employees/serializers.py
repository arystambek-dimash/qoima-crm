from rest_framework import serializers

from src.employees.models import Employee


EMPLOYEE_PERMISSION_FIELDS = (
    'tasks_can_edit',
    'tasks_can_delete',
    'tasks_can_create',
    'accounting_can_retrieve',
    'deals_can_create',
    'deals_can_delete',
    'deals_can_update',
    'employees_can_delete',
    'employees_can_create',
    'employees_can_update',
)


class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = (
            'id',
            'user',
            'role',
            'salary',
        ) + EMPLOYEE_PERMISSION_FIELDS
        read_only_fields = ('id',)


class EmployeeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = (
            'role',
            'salary',
        ) + EMPLOYEE_PERMISSION_FIELDS
