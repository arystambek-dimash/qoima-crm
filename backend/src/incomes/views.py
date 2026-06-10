from core.permissions import AccountingPermissions
from core.views import BasePermissionMixin, BaseSerializerMixin
from django.db import transaction
from django.db.models import Count, Min, Max, Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from src.incomes.filters import IncomeFilter
from src.incomes.models import Income
from src.incomes.serializers import IncomeSerializer
from src.wallets.services import (
    record_income_created,
    record_income_deleted,
    record_income_updated,
)


class IncomeViewSet(
    BasePermissionMixin,
    BaseSerializerMixin,
    viewsets.ModelViewSet,
):
    queryset = Income.objects.all().order_by("-date_earned")
    serializer_class = IncomeSerializer
    permission_classes = (AccountingPermissions,)

    filter_backends = [DjangoFilterBackend]
    filterset_class = IncomeFilter

    def perform_create(self, serializer):
        with transaction.atomic():
            income = serializer.save()
            record_income_created(income, actor=self.request.user)

    def perform_update(self, serializer):
        with transaction.atomic():
            old_amount = serializer.instance.amount
            income = serializer.save()
            record_income_updated(income, old_amount=old_amount, actor=self.request.user)

    def perform_destroy(self, instance):
        with transaction.atomic():
            record_income_deleted(instance, actor=self.request.user)
            instance.delete()

    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        qs = self.get_queryset()
        filtered = self.filter_queryset(qs)

        by_type = qs.values("type").annotate(
            count=Count("id"),
            total_amount=Sum("amount"),
        )

        by_date = filtered.values("date_earned").annotate(
            count=Count("id"),
            total_amount=Sum("amount"),
        )

        total = qs.aggregate(
            count=Count("id"),
            total_amount=Sum("amount"),
            date_from=Min("date_earned"),
            date_to=Max("date_earned"),
        )

        return Response({
            "total": total,
            "by_date": list(by_date),
            "by_type": list(by_type),
            "meta": {
                "date_from": total["date_from"],
                "date_to": total["date_to"],
            },
        })
