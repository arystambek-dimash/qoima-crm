from core.permissions import AccountingPermissions
from core.views import BasePermissionMixin, BaseSerializerMixin
from django.db.models.aggregates import Sum, Count, Min, Max
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics,viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from src.spendings.filters import SpendingFilter
from src.spendings.serializers import SpendingSerializer


# Create your views here.
class SpendingViewSet(
    BasePermissionMixin,
    BaseSerializerMixin,
    generics.RetrieveUpdateDestroyAPIView,
    viewsets.GenericViewSet
):
    serializer_class = SpendingSerializer
    permission_classes = (AccountingPermissions,)

    filter_backends = [DjangoFilterBackend]
    filterset_class = SpendingFilter

    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        spending = self.get_queryset()
        filter_spending = self.filter_queryset(spending)

        by_type = spending.values("type").annotate(
            count=Count("id"),
            total_amount=Sum("amount"),
        )

        by_date = filter_spending.values("date_spend").annotate(
            count=Count("id"),
            total_amount=Sum("amount"),
        )

        total = spending.aggregate(
            count=Count("id"),
            total_amount=Sum("amount"),
            date_from=Min("date_spend"),
            date_to=Max("date_spend"),
        )

        return Response({
            "total": total,
            "by_date": list(by_date),
            "by_type": list(by_type),
            "meta": {
                "date_from": total["date_from"],
                "date_to": total["date_to"],
            }
        })
