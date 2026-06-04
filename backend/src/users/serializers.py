from django.contrib.auth import get_user_model
from rest_framework import serializers


class LoginViaEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


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
            "is_superuser",
        )
        read_only_fields = ("id", "is_superuser")
