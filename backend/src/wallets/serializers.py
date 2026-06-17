from rest_framework import serializers

from core.permissions import can_view_wallet_balance
from src.users.serializers import UserSerializer
from src.wallets.models import Wallet, WalletLog


class WalletSerializer(serializers.ModelSerializer):
    can_view_balance = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = (
            "id",
            "name",
            "balance",
            "can_view_balance",
            "is_default",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "can_view_balance", "created_at", "updated_at")

    def get_can_view_balance(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and can_view_wallet_balance(request.user))

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if not data["can_view_balance"]:
            data["balance"] = None

        return data


class WalletLogSerializer(serializers.ModelSerializer):
    actor_detail = UserSerializer(source="actor", read_only=True)
    wallet_name = serializers.CharField(source="wallet.name", read_only=True)
    can_view_balance = serializers.SerializerMethodField()

    class Meta:
        model = WalletLog
        fields = (
            "id",
            "wallet",
            "wallet_name",
            "actor",
            "actor_detail",
            "action",
            "amount_delta",
            "balance_before",
            "balance_after",
            "can_view_balance",
            "description",
            "related_object_type",
            "related_object_id",
            "created_at",
        )
        read_only_fields = fields

    def get_can_view_balance(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and can_view_wallet_balance(request.user))

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if not data["can_view_balance"]:
            data["amount_delta"] = None
            data["balance_before"] = None
            data["balance_after"] = None

        return data
