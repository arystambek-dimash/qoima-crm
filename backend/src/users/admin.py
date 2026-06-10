from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin


@admin.register(get_user_model())
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("CRM", {"fields": ("role", "telegram_id")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("CRM", {"fields": ("role", "telegram_id")}),
    )
    list_display = (
        "username",
        "email",
        "role",
        "telegram_id",
        "is_staff",
        "is_superuser",
    )
    search_fields = UserAdmin.search_fields + ("=telegram_id",)
