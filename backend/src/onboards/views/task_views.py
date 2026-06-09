from django.contrib.auth import get_user_model
from core.views import BasePermissionMixin, BaseSerializerMixin
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from src.onboards.models import Task, TaskPerformance

from src.onboards.serializers import TaskSerializer


# Create your views here.
class TaskViewSet(
    BasePermissionMixin,
    BaseSerializerMixin,
    viewsets.ModelViewSet,
):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ("category", "category__onboard")

    def get_queryset(self):
        return Task.objects.select_related("category").prefetch_related(
            "taskperformance_set",
        )

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        task = self.get_object()
        user_id = request.data.get("user")

        if not user_id:
            return Response(
                {"detail": "user is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not get_user_model().objects.filter(pk=user_id).exists():
            return Response(
                {"detail": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        _, created = TaskPerformance.objects.get_or_create(
            task=task,
            user_id=user_id,
        )
        task = self.get_queryset().get(pk=task.pk)
        serializer = self.get_serializer(task)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["delete"], url_path=r"unassign/(?P<user_id>[^/.]+)")
    def unassign(self, request, user_id=None, pk=None):
        task = self.get_object()
        deleted, _ = TaskPerformance.objects.filter(
            task=task,
            user_id=user_id,
        ).delete()

        if deleted == 0:
            return Response(
                {"detail": "Not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
