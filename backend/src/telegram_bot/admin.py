from django.contrib import admin

from src.telegram_bot.models import (
    TelegramBotConfig,
    TelegramChat,
    TelegramCommandLog,
)


@admin.register(TelegramChat)
class TelegramChatAdmin(admin.ModelAdmin):
    list_display = ("chat_id", "title", "type", "is_active", "updated_at")
    list_filter = ("type", "is_active")
    search_fields = ("chat_id", "title")


@admin.register(TelegramBotConfig)
class TelegramBotConfigAdmin(admin.ModelAdmin):
    list_display = ("name", "task_approval_chat", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "task_approval_chat__title")


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
