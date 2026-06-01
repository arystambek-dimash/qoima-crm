from rest_framework import serializers


class LoginViaEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()