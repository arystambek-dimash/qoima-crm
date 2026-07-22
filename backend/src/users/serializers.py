from django.contrib.auth import get_user_model
from rest_framework import serializers

from core.enums import UserRole


class LoginViaEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(
        regex=r"^\d{6}$",
        error_messages={"invalid": "Введите 6-значный код."},
    )
    password = serializers.CharField(write_only=True, min_length=6)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "telegram_id",
            "is_staff",
            "is_superuser",
        )
        read_only_fields = ("id", "is_staff", "is_superuser")


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = get_user_model()
        fields = (
            "id",
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "role",
            "telegram_id",
        )
        read_only_fields = ("id",)

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = get_user_model()(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ClientSerializer(serializers.ModelSerializer):
    projects = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "projects",
        )
        read_only_fields = fields

    def get_projects(self, user):
        deals = {deal.pk: deal for deal in user.primary_deals.all()}
        for deal in user.collaborator_deals.all():
            deals.setdefault(deal.pk, deal)
        return [
            {"id": deal.pk, "name": deal.name or f"Проект #{deal.pk}"}
            for deal in deals.values()
        ]


class ClientCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = get_user_model()
        fields = ("id", "email", "password", "first_name", "last_name")
        read_only_fields = ("id",)

    def validate_email(self, value):
        if get_user_model().objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "Пользователь с таким email уже существует."
            )
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = get_user_model()(
            username=self._unique_username(validated_data["email"]),
            role=UserRole.COLLABORATOR,
            **validated_data,
        )
        user.set_password(password)
        user.save()
        return user

    def _unique_username(self, email):
        username = email
        suffix = 1
        while get_user_model().objects.filter(username=username).exists():
            suffix += 1
            username = f"{email}-{suffix}"
        return username


class ClientUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ("id", "email", "first_name", "last_name")
        read_only_fields = ("id",)

    def validate_email(self, value):
        conflict = (
            get_user_model()
            .objects.filter(email__iexact=value)
            .exclude(pk=self.instance.pk if self.instance else None)
        )
        if conflict.exists():
            raise serializers.ValidationError(
                "Пользователь с таким email уже существует."
            )
        return value


class ClientSetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8)
