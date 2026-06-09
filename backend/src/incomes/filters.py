from django_filters import rest_framework as filters
from src.incomes.models import Income


class IncomeFilter(filters.FilterSet):
    from_date = filters.DateFilter(field_name="date_earned", lookup_expr="gte")
    to_date = filters.DateFilter(field_name="date_earned", lookup_expr="lte")

    class Meta:
        model = Income
        fields = ["from_date", "to_date", "type"]
