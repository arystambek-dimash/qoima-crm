from core.views import BaseSerializerMixin
from django.contrib.auth import get_user_model
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from src.users.serializers import LoginViaEmailSerializer


class UserViewSet(BaseSerializerMixin, viewsets.GenericViewSet):
    permission_classes = [permissions.AllowAny]
    serializers = {
        "login_via_email": LoginViaEmailSerializer
    }

    @action(detail=False, methods=["post"], url_path="login-via-email")
    def login_via_email(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_model = get_user_model()
        db_user = user_model.objects.filter(
            email=serializer.validated_data["email"]
        ).first()

        if db_user is None or not db_user.check_password(
                serializer.validated_data["password"]
        ):
            raise ValidationError({"detail": "Invalid email or password."})

        refresh_token = RefreshToken.for_user(db_user)

        return Response(
            {
                "access": str(refresh_token.access_token),
                "refresh": str(refresh_token),
            },
            status=status.HTTP_200_OK,
        )
