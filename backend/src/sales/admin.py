from django.contrib import admin

from src.sales.models import Lead


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("lead_name", "company", "amount", "created_at")
    search_fields = ("lead_name", "company", "comments")
    ordering = ("-created_at",)
