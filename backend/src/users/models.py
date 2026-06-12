from django.conf import settings
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


class PasswordResetCode(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_codes",
    )
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("user", "created_at")),
        ]

    def __str__(self):
        return f"Password reset for {self.user_id}"
