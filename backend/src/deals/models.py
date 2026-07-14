from datetime import date

from core.enums import DealPaymentType, UserRole
from django.conf import settings
from django.db import models


# Create your models here.
class Deal(models.Model):
    name = models.CharField(max_length=180, blank=True, default="")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        limit_choices_to={"role": UserRole.COLLABORATOR},
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="primary_deals",
    )
    collaborators = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        limit_choices_to={"role": UserRole.COLLABORATOR},
        related_name="collaborator_deals",
    )
    responsibles = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        limit_choices_to={"role": UserRole.EMPLOYEE},
        related_name="responsible_deals",
    )
    stage = models.CharField(max_length=120)
    date_start = models.DateField(default=date.today)
    date_end = models.DateField()
    deal_amount = models.DecimalField(
        decimal_places=2,
        max_digits=14
    )
    payment_type = models.CharField(
        choices=DealPaymentType.choices,
        max_length=4
    )
    is_active = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)
    payment_completed = models.BooleanField(default=False)

    def has_collaborator(self, user):
        if not user or not user.is_authenticated:
            return False

        if self.user_id == user.id:
            return True

        if not self.pk:
            return False

        return self.collaborators.filter(pk=user.pk).exists()


class DealStage(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"

    deal = models.ForeignKey(to=Deal, on_delete=models.CASCADE, related_name="stages")
    parent_stage = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sub_stages",
    )
    name = models.CharField(max_length=120)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    order = models.PositiveIntegerField(default=0)
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        limit_choices_to={"role": UserRole.EMPLOYEE},
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deal_stages",
    )
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ("order", "id")


class DealLink(models.Model):
    deal = models.ForeignKey(to=Deal, on_delete=models.CASCADE, related_name="links")
    title = models.CharField(max_length=160)
    url = models.URLField(max_length=500)
    description = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("id",)


class DealFile(models.Model):
    deal = models.ForeignKey(to=Deal, on_delete=models.CASCADE, related_name="files")
    file_name = models.CharField(max_length=255)
    file = models.FileField(upload_to="deal_files/%Y/%m/%d/")
    description = models.TextField(null=True, blank=True)


class DealPayment(models.Model):
    deal = models.ForeignKey(to=Deal, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(
        decimal_places=2,
        max_digits=10
    )
    payment_date = models.DateField(default=date.today)
    delayed = models.BooleanField(default=False)
