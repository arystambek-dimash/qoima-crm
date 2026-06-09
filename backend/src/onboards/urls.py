from rest_framework.routers import DefaultRouter

from .views import onboard_views, task_views, task_category_views

router = DefaultRouter()
router.register("tasks", task_views.TaskViewSet, basename="tasks")
router.register("categories", task_category_views.TaskCategoryViewSet, basename="categories")
router.register("", onboard_views.OnboardViewSet, basename="onboards")

urlpatterns = router.urls
