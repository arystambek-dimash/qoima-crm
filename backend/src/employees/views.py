from core.permissions import EmployeePermissions
from core.views import BasePermissionMixin, BaseSerializerMixin
from rest_framework import mixins, viewsets
from src.employees.models import Employee
from src.employees.serializers import EmployeeSerializer, EmployeeUpdateSerializer


class EmployeeViewSet(
    BaseSerializerMixin,
    BasePermissionMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [EmployeePermissions]
    serializers = {
        "update": EmployeeUpdateSerializer,
        "partial_update": EmployeeUpdateSerializer,
    }
