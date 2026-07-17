from core.permissions import SalesPermissions
from rest_framework import filters, viewsets

from src.sales.models import Lead
from src.sales.serializers import LeadSerializer


class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all()
    serializer_class = LeadSerializer
    permission_classes = (SalesPermissions,)
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("lead_name", "company", "comments")
    ordering_fields = ("lead_name", "company", "amount", "created_at", "updated_at")
