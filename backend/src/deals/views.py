from core.permissions import IsCollaborator, DealPermissions
from core.views import BasePermissionMixin, BaseSerializerMixin
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from src.deals.serializers import DealSerializer


# Create your views here.
class DealViewSet(
    BasePermissionMixin,
    BaseSerializerMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = DealSerializer
    permission_classes = [IsAuthenticated, ]
    permissions = {
        "create": [IsCollaborator, DealPermissions],
        "update": [DealPermissions, ],
        "destroy": [DealPermissions, ],
        "partial_update": [DealPermissions, ],
    }
