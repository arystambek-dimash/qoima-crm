from core.views import BasePermissionMixin, BaseSerializerMixin
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
        return TaskCategory.objects.select_related("onboard").prefetch_related(
            "task_set__taskperformance_set",
        )
