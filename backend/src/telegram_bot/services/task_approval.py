from dataclasses import dataclass

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone

from src.onboards.models import Task, TaskAuditLog
from src.onboards.services import record_task_event
from src.telegram_bot.models import TelegramBotConfig, TelegramChat
from src.telegram_bot.services.telegram import TelegramClient


@dataclass(frozen=True)
class TaskApprovalCallbackResult:
    status: str
    response: str
    task_id: int | None = None


class TelegramTaskApprovalService:
    CALLBACK_PREFIX = "task_approval"

    def __init__(self, client=None):
        self.client = client or TelegramClient()

    def send_request(self, task_id: int) -> bool:
        task = self._task_queryset().filter(pk=task_id).first()

        if not task:
            return False

        chat_id = self._approval_chat_id()

        if not chat_id:
            record_task_event(
                task,
                task.created_by,
                TaskAuditLog.Action.APPROVAL_REQUESTED,
                source=Task.CreatedVia.TELEGRAM,
                description="Telegram approval request was not sent.",
                metadata={"error": "approval chat is not configured"},
            )
            return False

        result = self.client.send_message_with_result(
            chat_id,
            self._request_text(task),
            reply_markup=self._request_markup(task),
        )
        message = result.get("result") or {}
        ok = bool(result.get("ok"))

        record_task_event(
            task,
            task.created_by,
            TaskAuditLog.Action.APPROVAL_REQUESTED,
            source=Task.CreatedVia.TELEGRAM,
            description=(
                "Telegram approval request sent."
                if ok
                else "Telegram approval request failed."
            ),
            metadata={
                "ok": ok,
                "chat_id": chat_id,
                "message_id": message.get("message_id"),
                "telegram_response": result,
            },
        )
        return ok

    def handle_callback(self, callback_query: dict, user) -> TaskApprovalCallbackResult:
        data = callback_query.get("data", "")
        action, task_id = self._parse_callback_data(data)

        if not user:
            raise PermissionError("Telegram аккаунт не привязан к CRM-пользователю.")

        self._require_task_approval(user)

        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=task_id)

            if task.approval_status != Task.ApprovalStatus.PENDING:
                return TaskApprovalCallbackResult(
                    status="ignored",
                    response=f"Заявка уже обработана: {task.get_approval_status_display()}.",
                    task_id=task.id,
                )

            now = timezone.now()
            if action == "approve":
                task.approval_status = Task.ApprovalStatus.APPROVED
                task.review_comment = ""
                log_action = TaskAuditLog.Action.APPROVED
                response = "Задача одобрена."
            else:
                task.approval_status = Task.ApprovalStatus.REJECTED
                task.is_active = False
                task.review_comment = "Rejected from Telegram."
                log_action = TaskAuditLog.Action.REJECTED
                response = "Задача отклонена."

            task.reviewed_by = user
            task.reviewed_at = now
            task.save(
                update_fields=(
                    "approval_status",
                    "is_active",
                    "reviewed_by",
                    "reviewed_at",
                    "review_comment",
                    "updated_at",
                )
            )
            record_task_event(
                task,
                user,
                log_action,
                source=Task.CreatedVia.TELEGRAM,
                description=response,
                metadata={
                    "callback_query_id": callback_query.get("id"),
                    "telegram_user_id": (callback_query.get("from") or {}).get("id"),
                },
            )

        message = callback_query.get("message") or {}
        chat = message.get("chat") or {}
        if chat.get("id") and message.get("message_id"):
            self.client.edit_message_text(
                chat["id"],
                message["message_id"],
                self._reviewed_text(task, user, response),
                reply_markup={"inline_keyboard": []},
            )

        return TaskApprovalCallbackResult(
            status="success",
            response=response,
            task_id=task.id,
        )

    def _approval_chat_id(self):
        config = TelegramBotConfig.active()

        if config and config.task_approval_chat_id:
            return config.task_approval_chat.chat_id

        chat = (
            TelegramChat.objects.filter(
                is_active=True,
                type__in=("group", "supergroup"),
            )
            .order_by("-updated_at")
            .first()
        )
        return chat.chat_id if chat else None

    def _parse_callback_data(self, data: str) -> tuple[str, int]:
        parts = data.split(":")

        if len(parts) != 3 or parts[0] != self.CALLBACK_PREFIX:
            raise ValueError("Unknown callback data.")

        action = parts[1]
        if action not in {"approve", "reject"}:
            raise ValueError("Unknown task approval action.")

        try:
            task_id = int(parts[2])
        except ValueError as exc:
            raise ValueError("Task ID is invalid.") from exc

        return action, task_id

    def _require_task_approval(self, user) -> None:
        if user.is_staff or user.is_superuser:
            return

        try:
            employee = user.employee
        except ObjectDoesNotExist as exc:
            raise PermissionError("У CRM-пользователя нет профиля сотрудника.") from exc

        if not employee.tasks_can_edit:
            raise PermissionError("У вас нет прав одобрять задачи.")

    def _request_markup(self, task: Task) -> dict:
        return {
            "inline_keyboard": [
                [
                    {
                        "text": "Одобрить",
                        "callback_data": f"{self.CALLBACK_PREFIX}:approve:{task.id}",
                    },
                    {
                        "text": "Отклонить",
                        "callback_data": f"{self.CALLBACK_PREFIX}:reject:{task.id}",
                    },
                ]
            ]
        }

    def _request_text(self, task: Task) -> str:
        creator = self._user_label(task.created_by)
        deal = task.category.onboard.deal if task.category and task.category.onboard else None
        deal_label = f"#{deal.id}" if deal else "-"

        return "\n".join(
            [
                "Новая задача ожидает одобрения",
                f"Task: #{task.id} {task.name}",
                f"Deal: {deal_label}",
                f"Category: {task.category.name}",
                f"Type: {task.type}",
                f"Creator: {creator}",
                f"Start: {task.date_start.isoformat()}",
                f"End: {task.date_end.isoformat()}",
                "",
                task.description,
            ]
        )

    def _reviewed_text(self, task: Task, reviewer, response: str) -> str:
        reviewer_label = self._user_label(reviewer)
        reviewed_at = timezone.localtime(task.reviewed_at).strftime("%Y-%m-%d %H:%M")
        return "\n".join(
            [
                response,
                f"Task: #{task.id} {task.name}",
                f"Status: {task.get_approval_status_display()}",
                f"Reviewer: {reviewer_label}",
                f"Reviewed at: {reviewed_at}",
            ]
        )

    def _user_label(self, user) -> str:
        if not user:
            return "system"

        return user.get_full_name() or user.email or user.username or str(user)

    def _task_queryset(self):
        return Task.objects.select_related(
            "category",
            "category__onboard",
            "category__onboard__deal",
            "created_by",
            "reviewed_by",
        )
