from django.conf import settings
from django.db import models


# Create your models here.
class Employee(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.CharField(max_length=120)
    salary = models.DecimalField(decimal_places=2, max_digits=20)
    tasks_can_edit = models.BooleanField(default=False)
    tasks_can_delete = models.BooleanField(default=False)
    tasks_can_create = models.BooleanField(default=False)
    accounting_can_retrieve = models.BooleanField(default=False)
    accounting_can_create = models.BooleanField(default=False)
    accounting_can_update = models.BooleanField(default=False)
    accounting_can_delete = models.BooleanField(default=False)
    deals_can_create = models.BooleanField(default=False)
    deals_can_delete = models.BooleanField(default=False)
    deals_can_update = models.BooleanField(default=False)
    employees_can_delete = models.BooleanField(default=False)
    employees_can_create = models.BooleanField(default=False)
    employees_can_update = models.BooleanField(default=False)
    wallets_can_create = models.BooleanField(default=False)
    wallets_can_update = models.BooleanField(default=False)
    wallets_can_delete = models.BooleanField(default=False)
