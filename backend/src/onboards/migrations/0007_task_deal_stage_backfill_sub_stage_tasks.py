import django.db.models.deletion
from django.db import migrations, models


SUB_STAGE_TASK_CATEGORY_NAME = "Project sub-stages"
SUB_STAGE_TASK_TYPE = "project_sub_stage"


def backfill_sub_stage_tasks(apps, schema_editor):
    DealStage = apps.get_model("deals", "DealStage")
    Onboard = apps.get_model("onboards", "Onboard")
    Task = apps.get_model("onboards", "Task")
    TaskCategory = apps.get_model("onboards", "TaskCategory")
    TaskPerformance = apps.get_model("onboards", "TaskPerformance")

    db_alias = schema_editor.connection.alias
    stages = (
        DealStage.objects.using(db_alias)
        .filter(parent_stage__isnull=False)
        .select_related("deal")
        .order_by("id")
    )

    for stage in stages:
        onboard = _get_or_create_onboard(Onboard, stage, db_alias)
        category = _get_or_create_category(TaskCategory, onboard, db_alias)
        task = _get_or_create_task(Task, stage, category, db_alias)

        if stage.responsible_id:
            TaskPerformance.objects.using(db_alias).get_or_create(
                task_id=task.id,
                user_id=stage.responsible_id,
            )


def _get_or_create_onboard(onboard_model, stage, db_alias):
    onboard = (
        onboard_model.objects.using(db_alias)
        .filter(deal_id=stage.deal_id)
        .order_by("id")
        .first()
    )

    if onboard:
        return onboard

    return onboard_model.objects.using(db_alias).create(
        deal_id=stage.deal_id,
        name=stage.deal.name or f"Project #{stage.deal_id}",
        term_of_end=stage.deal.date_end,
    )


def _get_or_create_category(category_model, onboard, db_alias):
    category = (
        category_model.objects.using(db_alias)
        .filter(onboard_id=onboard.id, name=SUB_STAGE_TASK_CATEGORY_NAME)
        .order_by("id")
        .first()
    )

    if category:
        return category

    return category_model.objects.using(db_alias).create(
        onboard_id=onboard.id,
        name=SUB_STAGE_TASK_CATEGORY_NAME,
    )


def _get_or_create_task(task_model, stage, category, db_alias):
    status_map = {
        "pending": "todo",
        "in_progress": "in_progress",
        "completed": "done",
    }
    task = (
        task_model.objects.using(db_alias)
        .filter(deal_stage_id=stage.id)
        .order_by("id")
        .first()
    )
    field_values = {
        "category_id": category.id,
        "name": stage.name[:100],
        "type": SUB_STAGE_TASK_TYPE,
        "status": status_map.get(stage.status, "todo"),
        "description": f"Created automatically from project sub-stage #{stage.id}.",
        "date_start": stage.deal.date_start,
        "date_end": stage.due_date or stage.deal.date_end,
        "created_via": "system",
        "approval_status": "approved",
    }

    if task:
        changed_fields = []
        for field, value in field_values.items():
            if getattr(task, field) != value:
                setattr(task, field, value)
                changed_fields.append(field)

        if changed_fields:
            task.save(update_fields=changed_fields)

        return task

    return task_model.objects.using(db_alias).create(
        deal_stage_id=stage.id,
        **field_values,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("deals", "0008_dealstage_parent_stage"),
        ("onboards", "0006_task_approval_action_task_approval_requested_at_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="deal_stage",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="task",
                to="deals.dealstage",
            ),
        ),
        migrations.RunPython(
            backfill_sub_stage_tasks,
            migrations.RunPython.noop,
        ),
    ]
