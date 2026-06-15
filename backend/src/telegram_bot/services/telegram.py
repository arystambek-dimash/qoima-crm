import json
from urllib import error, request

from django.conf import settings


class TelegramClient:
    def set_webhook(self, webhook_url: str, secret: str = "") -> dict:
        payload = {"url": webhook_url}

        if secret:
            payload["secret_token"] = secret

        return self._post("setWebhook", payload)

    def send_message(self, chat_id: int, text: str) -> bool:
        result = self._post(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": text,
                "disable_web_page_preview": True,
            },
        )
        return bool(result.get("ok"))

    def send_message_with_result(
        self,
        chat_id: int,
        text: str,
        reply_markup: dict | None = None,
    ) -> dict:
        payload = {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": True,
        }

        if reply_markup:
            payload["reply_markup"] = reply_markup

        return self._post("sendMessage", payload)

    def edit_message_text(
        self,
        chat_id: int,
        message_id: int,
        text: str,
        reply_markup: dict | None = None,
    ) -> bool:
        payload = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
            "disable_web_page_preview": True,
        }

        if reply_markup is not None:
            payload["reply_markup"] = reply_markup

        result = self._post("editMessageText", payload)
        return bool(result.get("ok"))

    def answer_callback_query(
        self,
        callback_query_id: str,
        text: str = "",
        show_alert: bool = False,
    ) -> bool:
        payload = {
            "callback_query_id": callback_query_id,
            "show_alert": show_alert,
        }

        if text:
            payload["text"] = text[:200]

        result = self._post("answerCallbackQuery", payload)
        return bool(result.get("ok"))

    def _post(self, method: str, payload: dict) -> dict:
        token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")

        if not token:
            return {"ok": False, "description": "TELEGRAM_BOT_TOKEN is not set."}

        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            f"https://api.telegram.org/bot{token}/{method}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=10) as response:
                body = response.read().decode("utf-8")
                return json.loads(body)
        except (error.URLError, TimeoutError) as exc:
            return {"ok": False, "description": str(exc)}
