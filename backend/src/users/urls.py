from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from src.users.views import UserViewSet

user_login_via_email = UserViewSet.as_view({"post": "login_via_email"})

urlpatterns = [
    path('login-via-email/', user_login_via_email, name='login_via_email'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
