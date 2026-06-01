from django.conf import settings
from django.db import models

from src.deals.models import Deal


# Create your models here.
class Onboard(models.Model):
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, null=True)
    is_completed = models.BooleanField(default=False)
    term_of_end = models.DateField()


class TaskCategory(models.Model):
    name = models.CharField(max_length=100)
    onboard = models.ForeignKey(Onboard, on_delete=models.CASCADE, null=True)


class Task(models.Model):
    category = models.ForeignKey(TaskCategory, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    description = models.TextField()
    date_start = models.DateField()
    date_end = models.DateField()


class TaskPerformance(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
