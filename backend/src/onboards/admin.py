from django.contrib import admin

from src.onboards.models import (
    Onboard,
    Task,
    TaskAttachment,
    TaskAuditLog,
    TaskCategory,
    TaskPerformance,
)


@admin.register(Onboard)
class OnboardAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "deal", "is_completed", "term_of_end")
    list_filter = ("is_completed",)
    search_fields = ("name",)


@admin.register(TaskCategory)
class TaskCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "onboard")
    search_fields = ("name",)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "category",
        "status",
        "approval_status",
        "approval_action",
        "created_by",
        "created_at",
        "is_active",
    )
    list_filter = ("status", "approval_status", "approval_action", "created_via", "is_active")
    search_fields = ("name", "description", "created_by__username")
    readonly_fields = ("created_at", "updated_at")


@admin.register(TaskPerformance)
class TaskPerformanceAdmin(admin.ModelAdmin):
    list_display = ("id", "task", "user")
    search_fields = ("task__name", "user__username")


@admin.register(TaskAuditLog)
class TaskAuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "task_id_snapshot", "action", "source", "actor")
    list_filter = ("action", "source")
    search_fields = ("description", "actor__username", "task__name")
    readonly_fields = ("created_at",)


@admin.register(TaskAttachment)
class TaskAttachmentAdmin(admin.ModelAdmin):
    list_display = ("id", "task", "file_name", "kind", "size", "uploaded_by", "created_at")
    list_filter = ("kind", "content_type")
    search_fields = ("file_name", "task__name", "uploaded_by__username")
    readonly_fields = ("created_at",)
