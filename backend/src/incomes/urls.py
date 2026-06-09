from rest_framework.routers import DefaultRouter
from src.incomes.views import IncomeViewSet

router = DefaultRouter()
router.register("", IncomeViewSet, basename="incomes")

urlpatterns = router.urls
