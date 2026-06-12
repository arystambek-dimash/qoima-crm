from datetime import timedelta
import secrets

from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils import timezone

from src.users.models import PasswordResetCode


PASSWORD_RESET_CODE_TTL_MINUTES = 10
PASSWORD_RESET_MAX_ATTEMPTS = 5


def create_password_reset_code(user) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = timezone.now()

    with transaction.atomic():
        PasswordResetCode.objects.filter(
            user=user,
            used_at__isnull=True,
        ).update(used_at=now)
        PasswordResetCode.objects.create(
            user=user,
            code_hash=make_password(code),
            expires_at=now + timedelta(minutes=PASSWORD_RESET_CODE_TTL_MINUTES),
        )

    return code


def expire_active_password_reset_codes(user) -> None:
    PasswordResetCode.objects.filter(
        user=user,
        used_at__isnull=True,
    ).update(used_at=timezone.now())


def reset_password_with_code(user, code: str, password: str) -> bool:
    now = timezone.now()

    with transaction.atomic():
        reset_code = (
            PasswordResetCode.objects.select_for_update()
            .filter(user=user, used_at__isnull=True)
            .order_by("-created_at")
            .first()
        )

        if reset_code is None:
            return False

        if reset_code.expires_at <= now:
            reset_code.used_at = now
            reset_code.save(update_fields=("used_at",))
            return False

        if reset_code.attempts >= PASSWORD_RESET_MAX_ATTEMPTS:
            reset_code.used_at = now
            reset_code.save(update_fields=("used_at",))
            return False

        if not check_password(code, reset_code.code_hash):
            reset_code.attempts += 1
            update_fields = ["attempts"]

            if reset_code.attempts >= PASSWORD_RESET_MAX_ATTEMPTS:
                reset_code.used_at = now
                update_fields.append("used_at")

            reset_code.save(update_fields=update_fields)
            return False

        user.set_password(password)
        user.save(update_fields=("password",))
        reset_code.used_at = now
        reset_code.save(update_fields=("used_at",))

    return True
