from rest_framework import serializers
from django.contrib.auth import get_user_model

from core.enums import UserRole
from core.permissions import is_scoped_collaborator
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
    user = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.filter(role=UserRole.COLLABORATOR),
        allow_null=True,
        required=False,
    )
    collaborators = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.filter(role=UserRole.COLLABORATOR),
        many=True,
        required=False,
    )
    files = DealFileSerializer(many=True, read_only=True)
    payments = DealPaymentSerializer(many=True, read_only=True)
    user_detail = UserSerializer(source="user", read_only=True)
    collaborator_details = UserSerializer(
        source="collaborators",
        many=True,
        read_only=True,
    )
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
            'collaborators',
            'collaborator_details',
            'files',
            'payments',
            'user_detail',
            'paid_to_date',
            'remaining',
        )

        read_only_fields = ('id', 'paid_to_date', 'remaining')

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if is_scoped_collaborator(user):
            attrs.pop("user", None)
            attrs.pop("collaborators", None)

        return attrs
