import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create or update the deployment superuser from environment variables."

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-if-missing",
            action="store_true",
            help="Exit successfully when email/password env vars are missing.",
        )

    def handle(self, *args, **options):
        email = os.getenv("DJANGO_SUPERUSER_EMAIL", "").strip()
        username = os.getenv("DJANGO_SUPERUSER_USERNAME", "admin").strip() or "admin"
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "")
        reset_password = os.getenv(
            "DJANGO_SUPERUSER_RESET_PASSWORD",
            "false",
        ).lower() in {"1", "true", "yes", "on"}

        if not email or not password:
            message = (
                "DJANGO_SUPERUSER_EMAIL and DJANGO_SUPERUSER_PASSWORD are required."
            )

            if options["skip_if_missing"]:
                self.stdout.write(self.style.WARNING(f"{message} Skipping."))
                return

            raise CommandError(message)

        User = get_user_model()
        user = User.objects.filter(email=email).first()

        if user is None:
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
            )
            self.stdout.write(self.style.SUCCESS(f"Created superuser {email}."))
            return

        changed_fields = []

        if not user.is_staff:
            user.is_staff = True
            changed_fields.append("is_staff")

        if not user.is_superuser:
            user.is_superuser = True
            changed_fields.append("is_superuser")

        if username and user.username != username:
            user.username = username
            changed_fields.append("username")

        if reset_password:
            user.set_password(password)
            changed_fields.append("password")

        if changed_fields:
            user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Updated superuser {email}: {', '.join(changed_fields)}."
                )
            )
        else:
            self.stdout.write(self.style.SUCCESS(f"Superuser {email} already exists."))
