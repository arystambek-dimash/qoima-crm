from core.permissions import EmployeePermissions
from core.views import BasePermissionMixin, BaseSerializerMixin
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response
from src.employees.models import Employee
from src.employees.serializers import (
    EmployeeCreateSerializer,
    EmployeeSerializer,
    EmployeeUpdateSerializer,
)


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
    pagination_class = None
    serializers = {
        "create": EmployeeCreateSerializer,
        "update": EmployeeUpdateSerializer,
        "partial_update": EmployeeUpdateSerializer,
    }

    def get_queryset(self):
        return Employee.objects.select_related("user")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        response_serializer = EmployeeSerializer(
            employee,
            context=self.get_serializer_context(),
        )

        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
