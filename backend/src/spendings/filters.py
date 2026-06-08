from django_filters import rest_framework as filters

from src.spendings.models import Spending


class SpendingFilter(filters.FilterSet):
    from_date = filters.DateFilter(field_name='date_spend', lookup_expr='gte')
    to_date = filters.DateFilter(field_name='date_spend', lookup_expr='lte')

    class Meta:
        model = Spending
        fields = ['from_date', 'to_date', 'type']
