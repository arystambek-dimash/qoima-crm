from django.conf import settings
from django.db import models
from django.utils import timezone

from src.deals.models import Deal


# Create your models here.
class Onboard(models.Model):
    name = models.CharField(max_length=120, blank=True, default="")
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, null=True)
    is_completed = models.BooleanField(default=False)
    term_of_end = models.DateField()


class TaskCategory(models.Model):
    name = models.CharField(max_length=100)
    onboard = models.ForeignKey(Onboard, on_delete=models.CASCADE, null=True)


class Task(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    class CreatedVia(models.TextChoices):
        API = "api", "API"
        TELEGRAM = "telegram", "Telegram"
        SYSTEM = "system", "System"

    category = models.ForeignKey(TaskCategory, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    description = models.TextField()
    date_start = models.DateField()
    date_end = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_tasks",
    )
    created_via = models.CharField(
        max_length=16,
        choices=CreatedVia.choices,
        default=CreatedVia.API,
    )
    approval_status = models.CharField(
        max_length=16,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.APPROVED,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_tasks",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_tasks",
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    review_comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_cancelled(self):
        return self.approval_status == self.ApprovalStatus.CANCELLED


class TaskPerformance(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='task_performance')


class TaskAuditLog(models.Model):
    class Action(models.TextChoices):
        CREATED = "created", "Created"
        UPDATED = "updated", "Updated"
        APPROVAL_REQUESTED = "approval_requested", "Approval requested"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"
        ASSIGNED = "assigned", "Assigned"
        UNASSIGNED = "unassigned", "Unassigned"

    task = models.ForeignKey(
        Task,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    task_id_snapshot = models.PositiveBigIntegerField(null=True, blank=True, db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="task_audit_logs",
    )
    action = models.CharField(max_length=32, choices=Action.choices)
    source = models.CharField(
        max_length=16,
        choices=Task.CreatedVia.choices,
        default=Task.CreatedVia.API,
    )
    description = models.TextField(blank=True, default="")
    metadata = models.JSONField(blank=True, default=dict)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ("-created_at", "-id")

    def save(self, *args, **kwargs):
        if self.task_id_snapshot is None and self.task_id:
            self.task_id_snapshot = self.task_id

        super().save(*args, **kwargs)
