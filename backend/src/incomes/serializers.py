from rest_framework import serializers

from src.incomes.models import Income


class IncomeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Income
        fields = (
            "id",
            "name",
            "type",
            "amount",
            "date_earned",
            "note",
        )
