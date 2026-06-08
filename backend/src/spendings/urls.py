from rest_framework.routers import DefaultRouter

from src.spendings.views import SpendingViewSet

router = DefaultRouter()
router.register('', SpendingViewSet, basename='spendings')

urlpatterns = router.urls
