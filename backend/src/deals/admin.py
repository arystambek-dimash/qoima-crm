from django.contrib import admin

from src.deals.models import Deal, DealFile, DealPayment


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "stage",
        "user",
        "date_start",
        "date_end",
        "deal_amount",
        "is_active",
    )
    list_filter = ("stage", "is_active", "payment_completed", "payment_type")
    search_fields = (
        "user__username",
        "user__email",
        "collaborators__username",
        "collaborators__email",
    )
    filter_horizontal = ("collaborators",)


@admin.register(DealFile)
class DealFileAdmin(admin.ModelAdmin):
    list_display = ("id", "deal", "file_name")
    search_fields = ("file_name", "description")


@admin.register(DealPayment)
class DealPaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "deal", "amount", "payment_date", "delayed")
    list_filter = ("delayed",)
