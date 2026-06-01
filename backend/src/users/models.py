from django.contrib.auth.models import AbstractUser
from django.db import models

from core.enums import UserRole


# Create your models here.
class User(AbstractUser):
    email = models.EmailField(unique=True)
    role = models.CharField(
        choices=UserRole.choices,
        default=UserRole.EMPLOYEE,
        max_length=12,
    )
