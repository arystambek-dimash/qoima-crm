from core.permissions import is_scoped_collaborator
from core.views import BasePermissionMixin, BaseSerializerMixin
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from src.onboards.models import TaskCategory

from src.onboards.serializers import TaskCategorySerializer


# Create your views here.
class TaskCategoryViewSet(
    BasePermissionMixin,
    BaseSerializerMixin,
    viewsets.ModelViewSet,
):
    queryset = TaskCategory.objects.all()
    serializer_class = TaskCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend,)

    def get_queryset(self):
        queryset = TaskCategory.objects.select_related(
            "onboard",
            "onboard__deal",
            "onboard__deal__user",
        ).prefetch_related(
            "task_set__taskperformance_set",
        ).order_by("id")

        user = self.request.user
        if is_scoped_collaborator(user):
            queryset = queryset.filter(
                Q(onboard__deal__user=user) | Q(onboard__deal__collaborators=user),
            ).distinct()

        return queryset
