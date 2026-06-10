from rest_framework import serializers

from src.users.serializers import UserSerializer
from src.wallets.models import Wallet, WalletLog


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = (
            "id",
            "name",
            "balance",
            "is_default",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class WalletLogSerializer(serializers.ModelSerializer):
    actor_detail = UserSerializer(source="actor", read_only=True)
    wallet_name = serializers.CharField(source="wallet.name", read_only=True)

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
            "description",
            "related_object_type",
            "related_object_id",
            "created_at",
        )
        read_only_fields = fields
