from rest_framework import serializers

from src.deals.models import Deal


class DealSerializer(serializers.ModelSerializer):
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
        )

        read_only_fields = ('id',)

    def __init__(self, **kwargs):
        kwargs['partial'] = True
        super(DealSerializer, self).__init__(**kwargs)
