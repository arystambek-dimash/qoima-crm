from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from src.telegram_bot.services.handler import TelegramBotService


class TelegramWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        secret = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")

        if secret and request.headers.get("X-Telegram-Bot-Api-Secret-Token") != secret:
            return Response({"detail": "Invalid Telegram secret."}, status=status.HTTP_403_FORBIDDEN)

        result = TelegramBotService().handle_update(request.data)
        return Response({"ok": True, "result": result})
