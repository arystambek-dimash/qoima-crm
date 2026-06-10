from django.contrib import admin

from src.telegram_bot.models import (
    TelegramChat,
    TelegramCommandLog,
)


@admin.register(TelegramChat)
class TelegramChatAdmin(admin.ModelAdmin):
    list_display = ("chat_id", "title", "type", "is_active", "updated_at")
    list_filter = ("type", "is_active")
    search_fields = ("chat_id", "title")


@admin.register(TelegramCommandLog)
class TelegramCommandLogAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "command",
        "status",
        "user",
        "telegram_user_id",
        "telegram_chat_id",
        "created_object_type",
        "created_object_id",
    )
    list_filter = ("status", "command", "created_object_type")
    search_fields = (
        "text",
        "response",
        "error",
        "user__username",
        "telegram_user_id",
        "telegram_chat_id",
    )
    readonly_fields = ("created_at",)
