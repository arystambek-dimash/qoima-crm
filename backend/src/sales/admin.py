from django.contrib import admin

from src.sales.models import EventParticipant, Lead, SalesEvent


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("lead_name", "company", "amount", "created_at")
    search_fields = ("lead_name", "company", "comments")
    ordering = ("-created_at",)


class EventParticipantInline(admin.TabularInline):
    model = EventParticipant
    extra = 0


@admin.register(SalesEvent)
class SalesEventAdmin(admin.ModelAdmin):
    list_display = ("name", "event_date", "capacity", "created_at")
    search_fields = ("name", "comments")
    ordering = ("event_date",)
    inlines = (EventParticipantInline,)


@admin.register(EventParticipant)
class EventParticipantAdmin(admin.ModelAdmin):
    list_display = ("lead_name", "event", "company", "amount", "created_at")
    list_filter = ("event",)
    search_fields = ("lead_name", "company", "comments", "event__name")
    ordering = ("-created_at",)
