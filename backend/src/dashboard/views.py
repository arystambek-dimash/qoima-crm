from datetime import date, timedelta
from decimal import Decimal

from core.permissions import AccountingPermissions
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek, TruncYear
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from src.incomes.models import Income
from src.onboards.models import Task
from src.spendings.models import Spending
from src.wallets.models import Wallet


ZERO_AMOUNT = Decimal("0.00")


class DashboardViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, AccountingPermissions]

    PERIODS = {"week", "month", "year", "all", "custom"}
    GROUPS = {"day", "week", "month", "year"}
    TRUNC_BY_GROUP = {
        "day": TruncDate,
        "week": TruncWeek,
        "month": TruncMonth,
        "year": TruncYear,
    }

    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        params, error = self._date_params(request)

        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        incomes = Income.objects.filter(
            date_earned__gte=params["date_from"],
            date_earned__lte=params["date_to"],
        )
        spendings = Spending.objects.filter(
            date_spend__gte=params["date_from"],
            date_spend__lte=params["date_to"],
        )
        tasks = Task.objects.filter(
            date_end__gte=params["date_from"],
            date_end__lte=params["date_to"],
        )

        return Response(
            {
                "meta": params,
                "finance": self._finance(incomes, spendings, params),
                "tasks": self._tasks(tasks, params),
            }
        )

    def _date_params(self, request):
        today = timezone.localdate()
        query = request.query_params
        period = query.get("period", "month")
        group_by = query.get("group_by")

        if period not in self.PERIODS:
            period = "month"

        date_from = parse_date(query["from_date"]) if "from_date" in query else None
        date_to = parse_date(query["to_date"]) if "to_date" in query else today

        if "from_date" in query and date_from is None:
            return None, "Invalid from_date. Use YYYY-MM-DD."

        if "to_date" in query and date_to is None:
            return None, "Invalid to_date. Use YYYY-MM-DD."

        if "from_date" in query or "to_date" in query:
            period = "custom"

        if date_from is None:
            if period == "week":
                date_from = date_to - timedelta(days=date_to.weekday())
            elif period == "year":
                date_from = date(date_to.year, 1, 1)
            elif period == "all":
                first_dates = [
                    Income.objects.order_by("date_earned")
                    .values_list("date_earned", flat=True)
                    .first(),
                    Spending.objects.order_by("date_spend")
                    .values_list("date_spend", flat=True)
                    .first(),
                    Task.objects.order_by("date_end")
                    .values_list("date_end", flat=True)
                    .first(),
                ]
                date_from = (
                    min(value for value in first_dates if value)
                    if any(first_dates)
                    else date_to
                )
            else:
                date_from = date(date_to.year, date_to.month, 1)

        if date_from > date_to:
            return None, "from_date must be before or equal to to_date."

        if group_by not in self.GROUPS:
            group_by = "month" if period in {"year", "all"} else "day"

        return {
            "period": period,
            "group_by": group_by,
            "date_from": date_from,
            "date_to": date_to,
        }, None

    def _finance(self, incomes, spendings, params):
        selected = self._amount_summary(incomes, spendings)
        all_time = self._amount_summary(Income.objects.all(), Spending.objects.all())
        income_series = self._bucket_data(
            incomes,
            "date_earned",
            params,
            {"count": Count("id"), "total_amount": Sum("amount")},
            {"count": 0, "total_amount": ZERO_AMOUNT},
        )
        spending_series = self._bucket_data(
            spendings,
            "date_spend",
            params,
            {"count": Count("id"), "total_amount": Sum("amount")},
            {"count": 0, "total_amount": ZERO_AMOUNT},
        )

        return {
            "summary": selected,
            "all_time": all_time,
            "wallet": self._wallet(),
            "series": [
                {
                    "date": income["date"],
                    "income_count": income["count"],
                    "income_total": income["total_amount"],
                    "spending_count": spending["count"],
                    "spending_total": spending["total_amount"],
                    "net_total": income["total_amount"] - spending["total_amount"],
                }
                for income, spending in zip(income_series, spending_series, strict=True)
            ],
            "by_type": {
                "incomes": list(
                    incomes.values("type")
                    .annotate(count=Count("id"), total_amount=Sum("amount"))
                    .order_by("type")
                ),
                "spendings": list(
                    spendings.values("type")
                    .annotate(count=Count("id"), total_amount=Sum("amount"))
                    .order_by("type")
                ),
            },
        }

    def _wallet(self):
        wallet = Wallet.default()
        return {
            "id": wallet.id,
            "name": wallet.name,
            "balance": wallet.balance,
            "updated_at": wallet.updated_at,
        }

    def _tasks(self, tasks, params):
        today = timezone.localdate()
        counters = {
            "total": Count("id"),
            "active": Count("id", filter=Q(is_active=True)),
            "inactive": Count("id", filter=Q(is_active=False)),
            "overdue": Count("id", filter=Q(is_active=True, date_end__lt=today)),
        }

        return {
            "summary": tasks.aggregate(**counters),
            "by_type": list(tasks.values("type").annotate(**counters).order_by("type")),
            "by_date_term": self._bucket_data(
                tasks,
                "date_end",
                params,
                counters,
                {"total": 0, "active": 0, "inactive": 0, "overdue": 0},
            ),
        }

    def _amount_summary(self, incomes, spendings):
        income = incomes.aggregate(count=Count("id"), total_amount=Sum("amount"))
        spending = spendings.aggregate(count=Count("id"), total_amount=Sum("amount"))
        income_total = income["total_amount"] or ZERO_AMOUNT
        spending_total = spending["total_amount"] or ZERO_AMOUNT

        return {
            "income_count": income["count"],
            "income_total": income_total,
            "spending_count": spending["count"],
            "spending_total": spending_total,
            "net_total": income_total - spending_total,
        }

    def _bucket_data(self, queryset, date_field, params, annotations, defaults):
        group_by = params["group_by"]
        trunc = self.TRUNC_BY_GROUP[group_by]
        rows = (
            queryset.annotate(bucket=trunc(date_field))
            .values("bucket")
            .annotate(**annotations)
            .order_by("bucket")
        )
        rows_by_bucket = {
            self._bucket_start(row["bucket"], group_by): row
            for row in rows
        }

        result = []
        current = self._bucket_start(params["date_from"], group_by)
        end = self._bucket_start(params["date_to"], group_by)

        while current <= end:
            row = rows_by_bucket.get(current, {})
            result.append(
                {
                    "date": current,
                    **{
                        key: row.get(key) if row.get(key) is not None else default
                        for key, default in defaults.items()
                    },
                }
            )
            current = self._next_bucket(current, group_by)

        return result

    def _bucket_start(self, value, group_by):
        if hasattr(value, "date"):
            value = value.date()

        if group_by == "week":
            return value - timedelta(days=value.weekday())

        if group_by == "month":
            return date(value.year, value.month, 1)

        if group_by == "year":
            return date(value.year, 1, 1)

        return value

    def _next_bucket(self, value, group_by):
        if group_by == "week":
            return value + timedelta(days=7)

        if group_by == "month":
            if value.month == 12:
                return date(value.year + 1, 1, 1)

            return date(value.year, value.month + 1, 1)

        if group_by == "year":
            return date(value.year + 1, 1, 1)

        return value + timedelta(days=1)
