from rest_framework import serializers

from src.onboards.models import (
    Onboard,
    Task,
    TaskCategory,
    TaskPerformance
)
from src.users.serializers import UserSerializer


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
        )


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
