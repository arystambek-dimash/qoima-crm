from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from core.permissions import is_scoped_collaborator
from src.onboards.models import (
    Onboard,
    Task,
    TaskAuditLog,
    TaskCategory,
    TaskPerformance
)
from src.users.serializers import UserSerializer


def assert_collaborator_deal_access(request, deal):
    user = getattr(request, "user", None)

    if not is_scoped_collaborator(user):
        return

    if deal is None or not deal.has_collaborator(user):
        raise PermissionDenied("You do not have access to this deal.")


class TaskAuditLogSerializer(serializers.ModelSerializer):
    actor_detail = UserSerializer(source="actor", read_only=True)

    class Meta:
        model = TaskAuditLog
        fields = (
            'id',
            'task',
            'task_id_snapshot',
            'actor',
            'actor_detail',
            'action',
            'source',
            'description',
            'metadata',
            'created_at',
        )
        read_only_fields = fields


class TaskPerformanceSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)

    class Meta:
        model = TaskPerformance
        fields = (
            'id',
            'user',
            'task',
            'user_detail',
        )


class TaskSerializer(serializers.ModelSerializer):
    performance = TaskPerformanceSerializer(
        source="taskperformance_set",
        many=True,
        read_only=True,
    )
    audit_logs = TaskAuditLogSerializer(many=True, read_only=True)
    created_by_detail = UserSerializer(source="created_by", read_only=True)
    reviewed_by_detail = UserSerializer(source="reviewed_by", read_only=True)
    cancelled_by_detail = UserSerializer(source="cancelled_by", read_only=True)
    is_cancelled = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = (
            'id',
            'name',
            'type',
            'is_active',
            'description',
            'date_start',
            'date_end',
            'category',
            'performance',
            'created_by',
            'created_by_detail',
            'created_via',
            'approval_status',
            'reviewed_by',
            'reviewed_by_detail',
            'reviewed_at',
            'cancelled_by',
            'cancelled_by_detail',
            'cancelled_at',
            'review_comment',
            'is_cancelled',
            'created_at',
            'updated_at',
            'audit_logs',
        )
        read_only_fields = (
            'created_by',
            'created_by_detail',
            'created_via',
            'approval_status',
            'reviewed_by',
            'reviewed_by_detail',
            'reviewed_at',
            'cancelled_by',
            'cancelled_by_detail',
            'cancelled_at',
            'review_comment',
            'is_cancelled',
            'created_at',
            'updated_at',
            'audit_logs',
        )

    def validate(self, attrs):
        category = attrs.get("category", getattr(self.instance, "category", None))
        onboard = category.onboard if category else None
        deal = onboard.deal if onboard else None

        assert_collaborator_deal_access(
            self.context.get("request"),
            deal,
        )

        return attrs


class TaskCategorySerializer(serializers.ModelSerializer):
    tasks = TaskSerializer(
        source="task_set",
        many=True,
        read_only=True,
    )

    class Meta:
        model = TaskCategory
        fields = (
            'id',
            'name',
            'onboard',
            'tasks',
        )

    def validate(self, attrs):
        onboard = attrs.get("onboard", getattr(self.instance, "onboard", None))
        deal = onboard.deal if onboard else None

        assert_collaborator_deal_access(
            self.context.get("request"),
            deal,
        )

        return attrs


class OnboardListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Onboard
        fields = (
            'id',
            'name',
            'deal',
            'is_completed',
            'term_of_end',
        )


class OnboardSerializer(serializers.ModelSerializer):
    categories = TaskCategorySerializer(
        source="taskcategory_set",
        many=True,
        read_only=True,
    )

    class Meta:
        model = Onboard
        fields = (
            'id',
            'name',
            'deal',
            'is_completed',
            'term_of_end',
            'categories',
        )

    def validate(self, attrs):
        deal = attrs.get("deal", getattr(self.instance, "deal", None))

        assert_collaborator_deal_access(
            self.context.get("request"),
            deal,
        )

        return attrs
