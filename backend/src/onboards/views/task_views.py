from django.contrib.auth import get_user_model
from core.permissions import is_scoped_collaborator
from core.views import BasePermissionMixin, BaseSerializerMixin
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from src.onboards.models import Task, TaskAuditLog, TaskPerformance
from src.onboards.services import record_task_event

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
        queryset = Task.objects.select_related(
            "category",
            "category__onboard",
            "category__onboard__deal",
            "category__onboard__deal__user",
        ).prefetch_related(
            "audit_logs",
            "taskperformance_set",
        ).order_by("id")

        user = self.request.user
        if is_scoped_collaborator(user):
            queryset = queryset.filter(
                Q(category__onboard__deal__user=user)
                | Q(category__onboard__deal__collaborators=user),
            ).distinct()

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        approval_status = (
            Task.ApprovalStatus.PENDING
            if is_scoped_collaborator(user)
            else Task.ApprovalStatus.APPROVED
        )
        task = serializer.save(
            created_by=user,
            created_via=Task.CreatedVia.API,
            approval_status=approval_status,
        )
        record_task_event(
            task,
            user,
            TaskAuditLog.Action.CREATED,
            description="Task created.",
            metadata={"approval_status": approval_status},
        )

        if approval_status == Task.ApprovalStatus.PENDING:
            transaction.on_commit(lambda: self._send_approval_request(task.pk))

    def perform_update(self, serializer):
        changed_fields = sorted(serializer.validated_data.keys())
        task = serializer.save()
        record_task_event(
            task,
            self.request.user,
            TaskAuditLog.Action.UPDATED,
            description="Task updated.",
            metadata={"fields": changed_fields},
        )

    def perform_destroy(self, instance):
        now = timezone.now()
        instance.approval_status = Task.ApprovalStatus.CANCELLED
        instance.is_active = False
        instance.cancelled_by = self.request.user
        instance.cancelled_at = now
        instance.save(
            update_fields=(
                "approval_status",
                "is_active",
                "cancelled_by",
                "cancelled_at",
                "updated_at",
            )
        )
        record_task_event(
            instance,
            self.request.user,
            TaskAuditLog.Action.CANCELLED,
            description="Task cancelled.",
        )

    def _send_approval_request(self, task_id):
        from src.telegram_bot.services.task_approval import TelegramTaskApprovalService

        TelegramTaskApprovalService().send_request(task_id)

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
        if created:
            record_task_event(
                task,
                request.user,
                TaskAuditLog.Action.ASSIGNED,
                description="Task assignee added.",
                metadata={"user_id": user_id},
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

        record_task_event(
            task,
            request.user,
            TaskAuditLog.Action.UNASSIGNED,
            description="Task assignee removed.",
            metadata={"user_id": user_id},
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
