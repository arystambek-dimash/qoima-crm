from rest_framework import serializers

from src.spendings.models import Spending


class SpendingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Spending
        fields = (
            "id",
            "name",
            "type",
            "amount",
            "date_spend",
            "note",
        )
