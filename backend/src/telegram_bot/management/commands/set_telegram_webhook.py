from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from src.telegram_bot.services.telegram import TelegramClient


class Command(BaseCommand):
    help = "Set Telegram bot webhook URL."

    def add_arguments(self, parser):
        parser.add_argument(
            "url",
            nargs="?",
            help="Public webhook URL, for example https://example.com/api/telegram/webhook/",
        )
        parser.add_argument(
            "--secret",
            default=None,
            help="Optional Telegram webhook secret. Defaults to TELEGRAM_WEBHOOK_SECRET.",
        )

    def handle(self, *args, **options):
        if not settings.TELEGRAM_BOT_TOKEN:
            raise CommandError("TELEGRAM_BOT_TOKEN is not set.")

        webhook_url = options["url"] or settings.TELEGRAM_WEBHOOK_URL

        if not webhook_url:
            raise CommandError("Webhook URL is required or TELEGRAM_WEBHOOK_URL must be set.")

        secret = (
            options["secret"]
            if options["secret"] is not None
            else settings.TELEGRAM_WEBHOOK_SECRET
        )
        result = TelegramClient().set_webhook(webhook_url, secret=secret)

        if not result.get("ok"):
            raise CommandError(result.get("description", "Telegram rejected webhook."))

        self.stdout.write(self.style.SUCCESS("Telegram webhook has been set."))
        self.stdout.write(f"URL: {webhook_url}")

        if secret:
            self.stdout.write("Secret token is enabled.")
        else:
            self.stdout.write("Secret token is not set.")
