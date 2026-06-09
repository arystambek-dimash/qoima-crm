import json
from urllib import error, request

from django.conf import settings


class TelegramClient:
    def send_message(self, chat_id: int, text: str) -> bool:
        token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")

        if not token:
            return False

        payload = {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": True,
        }
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=10) as response:
                return 200 <= response.status < 300
        except (error.URLError, TimeoutError):
            return False
