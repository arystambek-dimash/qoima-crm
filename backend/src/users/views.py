from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from core.enums import UserRole
from core.permissions import ClientsPermissions
from core.views import BasePermissionMixin, BaseSerializerMixin
from src.telegram_bot.services.telegram import TelegramClient
from src.users.password_reset import (
    create_password_reset_code,
    expire_active_password_reset_codes,
    reset_password_with_code,
)
from src.users.serializers import (
    ClientCreateSerializer,
    ClientSerializer,
    ClientSetPasswordSerializer,
    ClientUpdateSerializer,
    LoginViaEmailSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UserCreateSerializer,
    UserSerializer,
)


PASSWORD_RESET_REQUEST_DETAIL = (
    "Если email существует и Telegram ID привязан, код отправлен в Telegram."
)
PASSWORD_RESET_CONFIRM_DETAIL = "Пароль обновлен. Теперь можно войти."


class UserManagePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_staff or request.user.is_superuser:
            return True

        try:
            employee = request.user.employee
        except ObjectDoesNotExist:
            return False

        if view.action == "create":
            return bool(employee.employees_can_create or employee.deals_can_create)

        return bool(employee.employees_can_update)


class UserViewSet(
    BaseSerializerMixin,
    BasePermissionMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = get_user_model().objects.all()
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["role"]

    serializers = {
        "login_via_email": LoginViaEmailSerializer,
        "password_reset_request": PasswordResetRequestSerializer,
        "password_reset_confirm": PasswordResetConfirmSerializer,
        "profile": UserSerializer,
        "list": UserSerializer,
        "create": UserCreateSerializer,
        "retrieve": UserSerializer,
        "update": UserSerializer,
        "partial_update": UserSerializer,
    }
    permissions = {
        "login_via_email": [permissions.AllowAny],
        "password_reset_request": [permissions.AllowAny],
        "password_reset_confirm": [permissions.AllowAny],
        "profile": [permissions.IsAuthenticated],
        "create": [UserManagePermission],
        "update": [UserManagePermission],
        "partial_update": [UserManagePermission],
    }

    @action(detail=False, methods=["post"], url_path="login-via-email")
    def login_via_email(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_model = get_user_model()
        db_user = user_model.objects.filter(
            email=serializer.validated_data["email"]
        ).first()

        if (
            db_user is None
            or not db_user.is_active
            or not db_user.check_password(serializer.validated_data["password"])
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

    @action(detail=False, methods=["post"], url_path="password-reset/request")
    def password_reset_request(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = (
            get_user_model()
            .objects.filter(email__iexact=serializer.validated_data["email"])
            .first()
        )

        if user and user.telegram_id:
            code = create_password_reset_code(user)
            sent = TelegramClient().send_message(
                user.telegram_id,
                self._password_reset_message(code),
            )

            if not sent:
                expire_active_password_reset_codes(user)

        return Response(
            {"detail": PASSWORD_RESET_REQUEST_DETAIL},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="password-reset/confirm")
    def password_reset_confirm(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = (
            get_user_model()
            .objects.filter(email__iexact=serializer.validated_data["email"])
            .first()
        )

        if not user or not reset_password_with_code(
            user,
            serializer.validated_data["code"],
            serializer.validated_data["password"],
        ):
            raise ValidationError({"detail": "Неверный или просроченный код."})

        return Response(
            {"detail": PASSWORD_RESET_CONFIRM_DETAIL},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="profile")
    def profile(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    def _password_reset_message(self, code: str) -> str:
        return (
            "Qoima CRM\n"
            f"Код восстановления пароля: {code}\n"
            "Код действует 10 минут. Если это были не вы, просто проигнорируйте."
        )


class ClientViewSet(
    BaseSerializerMixin,
    BasePermissionMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ClientSerializer
    permission_classes = [ClientsPermissions]

    serializers = {
        "create": ClientCreateSerializer,
        "update": ClientUpdateSerializer,
        "partial_update": ClientUpdateSerializer,
        "set_password": ClientSetPasswordSerializer,
    }

    def get_queryset(self):
        return (
            get_user_model()
            .objects.filter(role=UserRole.COLLABORATOR)
            .prefetch_related("primary_deals", "collaborator_deals")
            .order_by("id")
        )

    @action(detail=True, methods=["post"], url_path="set-password")
    def set_password(self, request, pk=None):
        client = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client.set_password(serializer.validated_data["password"])
        client.save(update_fields=["password"])
        return Response({"detail": "Пароль обновлён."}, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """Soft delete: deactivated clients cannot log in, but their deals
        and tasks stay intact."""
        client = self.get_object()
        client.is_active = False
        client.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        client = self.get_object()
        client.is_active = True
        client.save(update_fields=["is_active"])
        return Response(self.get_serializer(client).data, status=status.HTTP_200_OK)
