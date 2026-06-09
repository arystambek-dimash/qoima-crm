from core.views import BasePermissionMixin, BaseSerializerMixin
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
        queryset = Onboard.objects.select_related("deal")

        if self.action == "retrieve":
            queryset = queryset.prefetch_related(
                "taskcategory_set__task_set__taskperformance_set",
            )

        return queryset
