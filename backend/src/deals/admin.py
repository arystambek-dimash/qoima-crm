from django.contrib import admin

from src.deals.models import Deal, DealFile, DealLink, DealPayment, DealStage


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "stage",
        "user",
        "date_start",
        "date_end",
        "deal_amount",
        "is_active",
    )
    list_filter = ("stage", "is_active", "payment_completed", "payment_type")
    search_fields = (
        "name",
        "user__username",
        "user__email",
        "collaborators__username",
        "collaborators__email",
        "responsibles__username",
        "responsibles__email",
    )
    filter_horizontal = ("collaborators", "responsibles")


@admin.register(DealStage)
class DealStageAdmin(admin.ModelAdmin):
    list_display = ("id", "deal", "name", "status", "order", "responsible", "due_date")
    list_filter = ("status",)
    search_fields = ("name", "deal__name")


@admin.register(DealLink)
class DealLinkAdmin(admin.ModelAdmin):
    list_display = ("id", "deal", "title", "url")
    search_fields = ("title", "url", "deal__name")


@admin.register(DealFile)
class DealFileAdmin(admin.ModelAdmin):
    list_display = ("id", "deal", "file_name")
    search_fields = ("file_name", "description")


@admin.register(DealPayment)
class DealPaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "deal", "amount", "payment_date", "delayed")
    list_filter = ("delayed",)
