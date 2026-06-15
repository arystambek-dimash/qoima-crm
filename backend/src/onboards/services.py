from src.onboards.models import TaskAuditLog


def record_task_event(
    task,
    actor,
    action,
    *,
    source="api",
    description="",
    metadata=None,
):
    return TaskAuditLog.objects.create(
        task=task,
        task_id_snapshot=task.pk if task else None,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        source=source,
        description=description,
        metadata=metadata or {},
    )
