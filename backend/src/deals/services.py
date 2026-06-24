SUB_STAGE_TASK_CATEGORY_NAME = "Project sub-stages"
SUB_STAGE_TASK_TYPE = "project_sub_stage"


def ensure_task_for_sub_stage(stage, actor=None):
    if not stage.parent_stage_id:
        return None

    from src.onboards.models import (
        Onboard,
        Task,
        TaskAuditLog,
        TaskCategory,
        TaskPerformance,
    )
    from src.onboards.services import record_task_event

    onboard = _get_or_create_onboard(Onboard, stage.deal)
    category = _get_or_create_task_category(TaskCategory, onboard)
    status = _task_status_for_stage(stage.status, Task)
    date_end = stage.due_date or stage.deal.date_end

    task, created = Task.objects.get_or_create(
        deal_stage=stage,
        defaults={
            "category": category,
            "name": _task_name(stage.name),
            "type": SUB_STAGE_TASK_TYPE,
            "status": status,
            "description": _task_description(stage),
            "date_start": stage.deal.date_start,
            "date_end": date_end,
            "created_by": actor,
            "created_via": Task.CreatedVia.SYSTEM,
            "approval_status": Task.ApprovalStatus.APPROVED,
        },
    )

    if created:
        record_task_event(
            task,
            actor,
            TaskAuditLog.Action.CREATED,
            source=Task.CreatedVia.SYSTEM,
            description="Task created automatically from project sub-stage.",
            metadata={"deal_stage": stage.pk},
        )
    else:
        _sync_task_fields(task, category, stage, status, date_end)

    if stage.responsible_id:
        TaskPerformance.objects.get_or_create(
            task=task,
            user_id=stage.responsible_id,
        )

    return task


def _get_or_create_onboard(onboard_model, deal):
    onboard = onboard_model.objects.filter(deal=deal).order_by("id").first()

    if onboard:
        return onboard

    return onboard_model.objects.create(
        deal=deal,
        name=deal.name or f"Project #{deal.pk}",
        term_of_end=deal.date_end,
    )


def _get_or_create_task_category(category_model, onboard):
    category, _ = category_model.objects.get_or_create(
        onboard=onboard,
        name=SUB_STAGE_TASK_CATEGORY_NAME,
    )
    return category


def _task_status_for_stage(stage_status, task_model):
    status_map = {
        "pending": task_model.Status.TODO,
        "in_progress": task_model.Status.IN_PROGRESS,
        "completed": task_model.Status.DONE,
    }
    return status_map.get(stage_status, task_model.Status.TODO)


def _task_name(stage_name):
    return stage_name[:100]


def _task_description(stage):
    return f"Created automatically from project sub-stage #{stage.pk}."


def _sync_task_fields(task, category, stage, status, date_end):
    field_values = {
        "category": category,
        "name": _task_name(stage.name),
        "type": SUB_STAGE_TASK_TYPE,
        "status": status,
        "date_start": stage.deal.date_start,
        "date_end": date_end,
    }
    changed_fields = []

    for field, value in field_values.items():
        if getattr(task, field) != value:
            setattr(task, field, value)
            changed_fields.append(field)

    if changed_fields:
        task.save(update_fields=[*changed_fields, "updated_at"])
