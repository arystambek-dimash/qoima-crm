from rest_framework.routers import DefaultRouter

from src.employees.views import EmployeeViewSet

router = DefaultRouter()
router.register("", EmployeeViewSet, basename="employees")

urlpatterns = router.urls
