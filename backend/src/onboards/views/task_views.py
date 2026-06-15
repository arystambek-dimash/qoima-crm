from django.contrib.auth import get_user_model
from core.permissions import is_scoped_collaborator
from core.views import BasePermissionMixin, BaseSerializerMixin
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from src.onboards.models import Task, TaskAttachment, TaskAuditLog, TaskPerformance
from src.onboards.services import record_task_event

from src.onboards.serializers import TaskAttachmentSerializer, TaskSerializer


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
            "created_by",
            "approval_requested_by",
            "reviewed_by",
            "cancelled_by",
        ).prefetch_related(
            "audit_logs",
            "attachments",
            "attachments__uploaded_by",
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
        pending_approval = approval_status == Task.ApprovalStatus.PENDING
        task = serializer.save(
            created_by=user,
            created_via=Task.CreatedVia.API,
            approval_status=approval_status,
            approval_action=(
                Task.ApprovalAction.CREATE if pending_approval else ""
            ),
            approval_requested_by=user if pending_approval else None,
            approval_requested_at=timezone.now() if pending_approval else None,
        )
        record_task_event(
            task,
            user,
            TaskAuditLog.Action.CREATED,
            description="Task created.",
            metadata={
                "approval_status": approval_status,
                "approval_action": task.approval_action,
                "status": task.status,
            },
        )

        if pending_approval:
            transaction.on_commit(lambda: self._send_approval_request(task.pk))

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        requested_status = request.data.get("status")

        if (
            is_scoped_collaborator(request.user)
            and requested_status == Task.Status.CANCELLED
        ):
            self._request_task_cancellation(instance)
            instance.refresh_from_db()
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

        return super().update(request, *args, **kwargs)

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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if is_scoped_collaborator(request.user):
            self._request_task_cancellation(instance)
            instance.refresh_from_db()
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance):
        now = timezone.now()
        instance.status = Task.Status.CANCELLED
        instance.approval_status = Task.ApprovalStatus.CANCELLED
        instance.approval_action = ""
        instance.approval_requested_by = None
        instance.approval_requested_at = None
        instance.is_active = False
        instance.cancelled_by = self.request.user
        instance.cancelled_at = now
        instance.save(
            update_fields=(
                "approval_status",
                "approval_action",
                "approval_requested_by",
                "approval_requested_at",
                "status",
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

    def _request_task_cancellation(self, task):
        if task.status == Task.Status.CANCELLED or task.is_cancelled:
            raise ValidationError({"detail": "Task is already cancelled."})

        if task.approval_status == Task.ApprovalStatus.PENDING:
            if task.approval_action == Task.ApprovalAction.CANCEL:
                return

            raise ValidationError(
                {"detail": "Task already has a pending approval request."}
            )

        now = timezone.now()
        task.approval_status = Task.ApprovalStatus.PENDING
        task.approval_action = Task.ApprovalAction.CANCEL
        task.approval_requested_by = self.request.user
        task.approval_requested_at = now
        task.save(
            update_fields=(
                "approval_status",
                "approval_action",
                "approval_requested_by",
                "approval_requested_at",
                "updated_at",
            )
        )
        record_task_event(
            task,
            self.request.user,
            TaskAuditLog.Action.CANCELLATION_REQUESTED,
            description="Task cancellation requested.",
            metadata={"status": task.status},
        )
        transaction.on_commit(lambda: self._send_approval_request(task.pk))

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

    @action(detail=True, methods=["post"], url_path="attachments")
    def upload_attachment(self, request, pk=None):
        task = self.get_object()
        files = request.FILES.getlist("file") or request.FILES.getlist("files")

        if not files:
            return Response(
                {"detail": "file is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attachments = []
        for uploaded_file in files:
            content_type = getattr(uploaded_file, "content_type", "") or ""
            requested_kind = request.data.get("kind")
            kind = (
                requested_kind
                if requested_kind in TaskAttachment.Kind.values
                else (
                    TaskAttachment.Kind.VOICE
                    if content_type.startswith("audio/")
                    else TaskAttachment.Kind.FILE
                )
            )
            attachments.append(
                TaskAttachment.objects.create(
                    task=task,
                    file=uploaded_file,
                    file_name=request.data.get("file_name") or uploaded_file.name,
                    content_type=content_type,
                    size=uploaded_file.size,
                    kind=kind,
                    uploaded_by=request.user,
                )
            )

        record_task_event(
            task,
            request.user,
            TaskAuditLog.Action.ATTACHMENT_ADDED,
            description="Task attachment added.",
            metadata={
                "attachments": [
                    {
                        "id": item.id,
                        "file_name": item.file_name,
                        "kind": item.kind,
                        "size": item.size,
                    }
                    for item in attachments
                ]
            },
        )
        has_many = len(attachments) > 1
        serializer = TaskAttachmentSerializer(
            attachments if has_many else attachments[0],
            many=has_many,
            context=self.get_serializer_context(),
        )

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"attachments/(?P<attachment_id>[^/.]+)",
    )
    def delete_attachment(self, request, attachment_id=None, pk=None):
        task = self.get_object()
        attachment = task.attachments.filter(pk=attachment_id).first()

        if not attachment:
            return Response(
                {"detail": "Not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        metadata = {
            "attachment_id": attachment.id,
            "file_name": attachment.file_name,
            "kind": attachment.kind,
            "size": attachment.size,
        }
        attachment.delete()
        record_task_event(
            task,
            request.user,
            TaskAuditLog.Action.ATTACHMENT_REMOVED,
            description="Task attachment removed.",
            metadata=metadata,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
