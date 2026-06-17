from datetime import date

from django.core.management.base import BaseCommand
from django.utils import timezone

from src.spendings.services import charge_due_monthly_obligations


class Command(BaseCommand):
    help = "Create due monthly obligation spendings and notify Telegram."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            dest="date",
            help="Process obligations up to this date in YYYY-MM-DD format.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be charged without creating spendings.",
        )
        parser.add_argument(
            "--no-notify",
            action="store_true",
            help="Do not send Telegram notification.",
        )

    def handle(self, *args, **options):
        process_date = timezone.localdate()

        if options["date"]:
            process_date = date.fromisoformat(options["date"])

        result = charge_due_monthly_obligations(
            today=process_date,
            notify=not options["no_notify"],
            dry_run=options["dry_run"],
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Processed {result['created_count']} monthly obligations "
                f"for {process_date.isoformat()}."
            )
        )

        if result["total_amount"]:
            self.stdout.write(f"Total: {result['total_amount']} KZT")

        telegram = result["telegram"]
        if telegram.get("sent"):
            self.stdout.write("Telegram notification sent.")
        elif telegram.get("reason"):
            self.stdout.write(f"Telegram notification skipped: {telegram['reason']}")
