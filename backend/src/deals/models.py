from datetime import date

from core.enums import DealPaymentType, UserRole
from django.conf import settings
from django.db import models


# Create your models here.
class Deal(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        limit_choices_to={"role": UserRole.COLLABORATOR},
        on_delete=models.CASCADE,
        null=True
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
    payment_completed = models.BooleanField(default=False)


class DealFile(models.Model):
    deal = models.ForeignKey(to=Deal, on_delete=models.CASCADE, related_name="files")
    file_name = models.CharField(max_length=255)
    file = models.FileField()
    description = models.TextField(null=True, blank=True)


class DealPayment(models.Model):
    deal = models.ForeignKey(to=Deal, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(
        decimal_places=2,
        max_digits=10
    )
    payment_date = models.DateField(default=date.today)
    delayed = models.BooleanField(default=False)
