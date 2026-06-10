from django.core.exceptions import ObjectDoesNotExist
from rest_framework import permissions

from core.enums import UserRole


class IsEmployee(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.EMPLOYEE
        )


class IsCollaborator(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.COLLABORATOR
        )


class EmployeeFlagPermission(permissions.BasePermission):
    permission_map = {}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_staff or request.user.is_superuser:
            return True

        action = getattr(view, "action", None)
        permission_field = self.permission_map.get(action)

        if permission_field is None:
            return True

        employee = self.get_employee(request.user)
        return bool(employee and getattr(employee, permission_field, False))

    def get_employee(self, user):
        try:
            return user.employee
        except ObjectDoesNotExist:
            return None


class TaskPermissions(EmployeeFlagPermission):
    permission_map = {
        "create": "tasks_can_create",
        "update": "tasks_can_edit",
        "partial_update": "tasks_can_edit",
        "destroy": "tasks_can_delete",
    }


class DealPermissions(EmployeeFlagPermission):
    permission_map = {
        "create": "deals_can_create",
        "update": "deals_can_update",
        "partial_update": "deals_can_update",
        "destroy": "deals_can_delete",
        "create_file": "deals_can_update",
        "create_payment": "deals_can_update",
        "delete_file": "deals_can_update",
        "delete_payment": "deals_can_update",
    }


class EmployeePermissions(EmployeeFlagPermission):
    permission_map = {
        "create": "employees_can_create",
        "update": "employees_can_update",
        "partial_update": "employees_can_update",
        "destroy": "employees_can_delete",
    }


class AccountingPermissions(EmployeeFlagPermission):
    permission_map = {
        "list": "accounting_can_retrieve",
        "retrieve": "accounting_can_retrieve",
        "analytics": "accounting_can_retrieve",
        "create": "accounting_can_create",
        "update": "accounting_can_update",
        "partial_update": "accounting_can_update",
        "destroy": "accounting_can_delete",
    }


class WalletPermissions(EmployeeFlagPermission):
    permission_map = {
        "create": "wallets_can_create",
        "update": "wallets_can_update",
        "partial_update": "wallets_can_update",
        "destroy": "wallets_can_delete",
    }
