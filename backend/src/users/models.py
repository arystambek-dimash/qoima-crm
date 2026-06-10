from django.contrib.auth.models import AbstractUser
from django.db import models

from core.enums import UserRole


# Create your models here.
class User(AbstractUser):
    email = models.EmailField(unique=True)
    telegram_id = models.BigIntegerField(
        unique=True,
        null=True,
        blank=True,
        db_index=True,
    )
    role = models.CharField(
        choices=UserRole.choices,
        default=UserRole.EMPLOYEE,
        max_length=12,
    )
