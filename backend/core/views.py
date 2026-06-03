from typing import Sequence

from rest_framework import permissions as rest_permissions
from rest_framework import serializers as rest_serializers


class BaseSerializerMixin:
    serializer_class: type[rest_serializers.Serializer] | None = None
    serializers: dict[str: type[rest_serializers.Serializer]] = {}

    def get_serializer_class(self) -> rest_serializers.Serializer:
        action = getattr(self, 'action', None)

        if action and action in self.serializers:
            return self.serializers[action]

        if self.serializer_class is not None:
            return self.serializer_class

        raise AssertionError(
            f"{self.__class__.__name__} must define serializer_class "
            "or serializer_classes."
        )

    def get_serializer(self, *args, **kwargs) -> rest_serializers.Serializer:
        kwargs.setdefault(
            "context", {
                "request": getattr(self, "request", None),
                "view": self,
            }
        )
        return self.get_serializer_class()(*args, **kwargs)


class BasePermissionMixin:
    permission_classes: Sequence[type[rest_permissions.BasePermission]] | None = None
    permissions: dict[str: Sequence[type[rest_permissions.BasePermission]]] = {}

    def get_permission_classes(self) -> Sequence[type[rest_permissions.BasePermission]]:
        action = getattr(self, "action", None)

        if action and action in self.permissions:
            return self.permissions[action]

        return getattr(self, "permission_classes", [])

    def get_permissions(self) -> list[rest_permissions.BasePermission]:
        return [
            permission_class()
            for permission_class in self.get_permission_classes()
        ]
