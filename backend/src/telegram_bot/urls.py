from django.urls import path

from src.telegram_bot.views import TelegramWebhookView


urlpatterns = [
    path("webhook/", TelegramWebhookView.as_view(), name="telegram-webhook"),
]
