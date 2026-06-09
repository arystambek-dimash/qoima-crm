from core.permissions import AccountingPermissions
from core.views import BasePermissionMixin, BaseSerializerMixin
from django.db.models import Count, Min, Max, Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from src.incomes.filters import IncomeFilter
from src.incomes.models import Income
from src.incomes.serializers import IncomeSerializer


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
