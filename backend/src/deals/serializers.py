from rest_framework import serializers

from src.deals.models import Deal, DealPayment, DealFile
from src.users.serializers import UserSerializer


class DealFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DealFile
        fields = (
            'id',
            'file_name',
            'file',
            'description',
        )


class DealPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DealPayment
        fields = (
            'id',
            'amount',
            'payment_date',
            'delayed'
        )


class DealSerializer(serializers.ModelSerializer):
    files = DealFileSerializer(many=True, read_only=True)
    payments = DealPaymentSerializer(many=True, read_only=True)
    user_detail = UserSerializer(source="user", read_only=True)
    paid_to_date = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
        read_only=True,
    )
    remaining = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Deal
        fields = (
            'id',
            'user',
            'stage',
            'date_start',
            'date_end',
            'deal_amount',
            'payment_type',
            'is_active',
            'payment_completed',
            'files',
            'payments',
            'user_detail',
            'paid_to_date',
            'remaining',
        )

        read_only_fields = ('id', 'paid_to_date', 'remaining')
