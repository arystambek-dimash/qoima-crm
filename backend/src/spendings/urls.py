from rest_framework.routers import DefaultRouter

from src.spendings.views import MonthlyObligationViewSet, SpendingViewSet

router = DefaultRouter()
router.register("monthly-obligations", MonthlyObligationViewSet, basename="monthly-obligations")
router.register('', SpendingViewSet, basename='spendings')

urlpatterns = router.urls
