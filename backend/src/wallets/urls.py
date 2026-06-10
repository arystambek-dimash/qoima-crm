from rest_framework.routers import DefaultRouter

from src.wallets.views import WalletLogViewSet, WalletViewSet

router = DefaultRouter()
router.register("logs", WalletLogViewSet, basename="wallet-logs")
router.register("", WalletViewSet, basename="wallets")

urlpatterns = router.urls
