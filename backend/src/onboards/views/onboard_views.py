from core.permissions import is_scoped_collaborator
from core.views import BasePermissionMixin, BaseSerializerMixin
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from src.onboards.models import Onboard
from src.onboards.serializers import OnboardListSerializer, OnboardSerializer


# Create your views here.
class OnboardViewSet(
    BasePermissionMixin,
    BaseSerializerMixin,
    viewsets.ModelViewSet,
):
    queryset = Onboard.objects.all()
    serializer_class = OnboardSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ("deal", "is_completed")
    serializers = {
        "list": OnboardListSerializer,
    }

    def get_queryset(self):
        queryset = Onboard.objects.select_related("deal", "deal__user").order_by("id")

        user = self.request.user
        if is_scoped_collaborator(user):
            queryset = queryset.filter(
                Q(deal__user=user) | Q(deal__collaborators=user),
            ).distinct()

        if self.action == "retrieve":
            queryset = queryset.prefetch_related(
                "taskcategory_set__task_set__taskperformance_set",
            )

        return queryset
