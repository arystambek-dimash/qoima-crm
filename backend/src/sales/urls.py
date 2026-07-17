from rest_framework.routers import DefaultRouter

from src.sales.views import LeadViewSet

router = DefaultRouter()
router.register("", LeadViewSet, basename="sales-leads")

urlpatterns = router.urls
