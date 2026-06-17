from rest_framework import serializers
from django.contrib.auth import get_user_model

from core.enums import UserRole
from core.permissions import is_scoped_collaborator
from src.deals.models import Deal, DealFile, DealLink, DealPayment, DealStage
from src.users.serializers import UserSerializer


class DealFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = DealFile
        fields = (
            'id',
            'deal',
            'file_name',
            'file',
            'file_url',
            'description',
        )
        read_only_fields = ('id', 'deal', 'file_url')
        extra_kwargs = {
            'file_name': {'required': False, 'allow_blank': True},
        }

    def get_file_url(self, obj):
        if not obj.file:
            return ""

        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def validate(self, attrs):
        uploaded_file = attrs.get("file")
        if uploaded_file and not attrs.get("file_name"):
            attrs["file_name"] = getattr(uploaded_file, "name", "") or "file"

        return attrs


class DealPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DealPayment
        fields = (
            'id',
            'amount',
            'payment_date',
            'delayed'
        )


class DealStageSerializer(serializers.ModelSerializer):
    responsible_detail = UserSerializer(source="responsible", read_only=True)

    class Meta:
        model = DealStage
        fields = (
            'id',
            'deal',
            'name',
            'status',
            'order',
            'responsible',
            'responsible_detail',
            'due_date',
            'completed_at',
        )
        read_only_fields = ('id', 'deal', 'responsible_detail')


class DealLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DealLink
        fields = (
            'id',
            'deal',
            'title',
            'url',
            'description',
        )
        read_only_fields = ('id', 'deal')


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
    responsibles = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.filter(role=UserRole.EMPLOYEE),
        many=True,
        required=False,
    )
    files = DealFileSerializer(many=True, read_only=True)
    stages = DealStageSerializer(many=True, read_only=True)
    links = DealLinkSerializer(many=True, read_only=True)
    payments = DealPaymentSerializer(many=True, read_only=True)
    user_detail = UserSerializer(source="user", read_only=True)
    collaborator_details = UserSerializer(
        source="collaborators",
        many=True,
        read_only=True,
    )
    responsible_details = UserSerializer(
        source="responsibles",
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
    progress_percent = serializers.SerializerMethodField()
    current_stage_name = serializers.SerializerMethodField()

    class Meta:
        model = Deal
        fields = (
            'id',
            'name',
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
            'responsibles',
            'responsible_details',
            'stages',
            'links',
            'files',
            'payments',
            'user_detail',
            'paid_to_date',
            'remaining',
            'progress_percent',
            'current_stage_name',
        )

        read_only_fields = (
            'id',
            'paid_to_date',
            'remaining',
            'progress_percent',
            'current_stage_name',
        )

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if is_scoped_collaborator(user):
            attrs.pop("user", None)
            attrs.pop("collaborators", None)
            attrs.pop("responsibles", None)

        return attrs

    def get_progress_percent(self, obj):
        stages = list(getattr(obj, "stages").all())
        if not stages:
            if obj.stage == "completed" or obj.payment_completed:
                return 100
            if obj.stage == "cancelled":
                return 0
            return 0

        completed = sum(
            1 for stage in stages if stage.status == DealStage.Status.COMPLETED
        )
        return round((completed / len(stages)) * 100)

    def get_current_stage_name(self, obj):
        stages = list(getattr(obj, "stages").all())
        if not stages:
            return obj.stage

        in_progress = next(
            (
                stage
                for stage in stages
                if stage.status == DealStage.Status.IN_PROGRESS
            ),
            None,
        )
        if in_progress:
            return in_progress.name

        pending = next(
            (stage for stage in stages if stage.status == DealStage.Status.PENDING),
            None,
        )
        if pending:
            return pending.name

        return stages[-1].name
