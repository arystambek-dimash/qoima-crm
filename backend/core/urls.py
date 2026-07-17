from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from drf_spectacular.views import SpectacularSwaggerView, SpectacularAPIView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("src.users.urls")),
    path("api/employees/", include("src.employees.urls")),
    path("api/deals/", include("src.deals.urls")),
    path("api/projects/", include("src.deals.urls")),
    path('api/spendings/', include('src.spendings.urls')),
    path("api/onboards/", include("src.onboards.urls")),
    path("api/incomes/", include("src.incomes.urls")),
    path("api/wallets/", include("src.wallets.urls")),
    path("api/sales/", include("src.sales.urls")),
    path("api/dashboard/", include("src.dashboard.urls")),
    path("api/telegram/", include("src.telegram_bot.urls")),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
