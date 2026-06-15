from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone
from src.incomes.models import Income
from src.spendings.models import Spending
from src.telegram_bot.models import (
    TelegramChat,
    TelegramCommandLog,
)
from src.telegram_bot.services.parser import CommandParseError, CommandParser
from src.telegram_bot.services.reports import ReportBuilder
from src.telegram_bot.services.task_approval import TelegramTaskApprovalService
from src.telegram_bot.services.telegram import TelegramClient
from src.wallets.models import Wallet, WalletLog
from src.wallets.services import record_income_created, record_spending_created


class TelegramBotService:
    def __init__(self):
        self.parser = CommandParser()
        self.reports = ReportBuilder()
        self.client = TelegramClient()

    def handle_update(self, update: dict) -> dict:
        update_id = update.get("update_id")
        existing = self._existing_log(update_id)

        if existing:
            return {"duplicate": True, "response": existing.response}

        if update.get("callback_query"):
            return self._handle_callback_query(update_id, update["callback_query"])

        message = update.get("message") or update.get("edited_message") or {}
        text = message.get("text", "")
        chat_data = message.get("chat") or {}
        from_data = message.get("from") or {}

        if not text:
            return self._log_ignored(update_id, chat_data, from_data)

        chat = self._upsert_chat(chat_data)
        user = self._user(from_data)
        command_name = ""
        created_object = None

        try:
            command = self.parser.parse(text)
            command_name = command.name

            if command.name == "help":
                response = self._help_text()
                status = TelegramCommandLog.Status.SUCCESS
            elif command.name == "whoami":
                response = self._whoami_text(from_data, user)
                status = TelegramCommandLog.Status.SUCCESS
            elif not user:
                response = self._not_linked_text(from_data)
                status = TelegramCommandLog.Status.DENIED
            elif command.name == "report":
                self._require_accounting(user, "accounting_can_retrieve")
                response = self.reports.build(command)
                status = TelegramCommandLog.Status.SUCCESS
            elif command.name == "wallet":
                response = self._wallet_text()
                status = TelegramCommandLog.Status.SUCCESS
            elif command.name == "income":
                self._require_accounting(user, "accounting_can_create")
                with transaction.atomic():
                    created_object = Income.objects.create(
                        name=command.label,
                        type=command.label,
                        amount=command.amount,
                        date_earned=command.record_date,
                        note=f"Telegram: {text}",
                    )
                    record_income_created(
                        created_object,
                        actor=user,
                        description=f"Telegram income: {command.label}",
                    )
                response = self._created_text("income", command)
                status = TelegramCommandLog.Status.SUCCESS
            elif command.name == "spending":
                self._require_accounting(user, "accounting_can_create")
                with transaction.atomic():
                    created_object = Spending.objects.create(
                        name=command.label,
                        type=command.label,
                        amount=command.amount,
                        date_spend=command.record_date,
                        note=f"Telegram: {text}",
                    )
                    record_spending_created(
                        created_object,
                        actor=user,
                        description=f"Telegram spending: {command.label}",
                    )
                response = self._created_text("spending", command)
                status = TelegramCommandLog.Status.SUCCESS
            else:
                response = self._help_text()
                status = TelegramCommandLog.Status.IGNORED
            error = ""
        except PermissionError as exc:
            response = str(exc)
            status = TelegramCommandLog.Status.DENIED
            error = str(exc)
        except CommandParseError as exc:
            response = f"{exc}\n\n{self._help_text()}"
            status = TelegramCommandLog.Status.FAILED
            error = str(exc)

        if chat_data.get("id"):
            self.client.send_message(chat_data["id"], response)

        log = TelegramCommandLog.objects.create(
            update_id=update_id,
            chat=chat,
            user=user,
            telegram_user_id=from_data.get("id"),
            telegram_chat_id=chat_data.get("id"),
            command=command_name,
            text=text,
            status=status,
            response=response,
            error=error,
            created_object_type=created_object._meta.label if created_object else "",
            created_object_id=str(created_object.pk) if created_object else "",
        )

        return {"duplicate": False, "log_id": log.id, "status": status}

    def _handle_callback_query(self, update_id, callback_query: dict) -> dict:
        message = callback_query.get("message") or {}
        chat_data = message.get("chat") or {}
        from_data = callback_query.get("from") or {}
        data = callback_query.get("data", "")
        callback_id = callback_query.get("id")
        chat = self._upsert_chat(chat_data)
        user = self._user(from_data)
        command_name = "callback"
        response = ""
        status = TelegramCommandLog.Status.IGNORED
        error = ""
        created_object_type = ""
        created_object_id = ""

        try:
            if data.startswith(f"{TelegramTaskApprovalService.CALLBACK_PREFIX}:"):
                result = TelegramTaskApprovalService(self.client).handle_callback(
                    callback_query,
                    user,
                )
                command_name = "task_approval"
                response = result.response
                status = (
                    TelegramCommandLog.Status.SUCCESS
                    if result.status == "success"
                    else TelegramCommandLog.Status.IGNORED
                )
                created_object_type = "onboards.Task" if result.task_id else ""
                created_object_id = str(result.task_id) if result.task_id else ""
            else:
                response = "Неизвестное действие."
                error = response
        except PermissionError as exc:
            response = str(exc)
            status = TelegramCommandLog.Status.DENIED
            error = str(exc)
        except (ObjectDoesNotExist, ValueError) as exc:
            response = str(exc)
            status = TelegramCommandLog.Status.FAILED
            error = str(exc)

        if callback_id:
            self.client.answer_callback_query(
                callback_id,
                response,
                show_alert=status != TelegramCommandLog.Status.SUCCESS,
            )

        log = TelegramCommandLog.objects.create(
            update_id=update_id,
            chat=chat,
            user=user,
            telegram_user_id=from_data.get("id"),
            telegram_chat_id=chat_data.get("id"),
            command=command_name,
            text=data,
            status=status,
            response=response,
            error=error,
            created_object_type=created_object_type,
            created_object_id=created_object_id,
        )

        return {"duplicate": False, "log_id": log.id, "status": status}

    def _existing_log(self, update_id):
        if update_id is None:
            return None

        return TelegramCommandLog.objects.filter(update_id=update_id).first()

    def _log_ignored(self, update_id, chat_data: dict, from_data: dict) -> dict:
        chat = self._upsert_chat(chat_data)
        user = self._user(from_data)
        log = TelegramCommandLog.objects.create(
            update_id=update_id,
            chat=chat,
            user=user,
            telegram_user_id=from_data.get("id"),
            telegram_chat_id=chat_data.get("id"),
            status=TelegramCommandLog.Status.IGNORED,
        )
        return {"duplicate": False, "log_id": log.id, "status": log.status}

    def _upsert_chat(self, chat_data: dict) -> TelegramChat | None:
        chat_id = chat_data.get("id")

        if not chat_id:
            return None

        defaults = {
            "title": chat_data.get("title") or chat_data.get("username") or "",
            "type": chat_data.get("type", ""),
            "is_active": True,
        }
        chat, _ = TelegramChat.objects.update_or_create(
            chat_id=chat_id,
            defaults=defaults,
        )
        return chat

    def _user(self, from_data: dict):
        telegram_user_id = from_data.get("id")

        if not telegram_user_id:
            return None

        return (
            get_user_model()
            .objects.select_related("employee")
            .filter(telegram_id=telegram_user_id)
            .first()
        )

    def _require_accounting(self, user, permission_field: str) -> None:
        if not user or not user.is_authenticated:
            raise PermissionError("Telegram аккаунт не привязан к CRM-пользователю.")

        if user.is_staff or user.is_superuser:
            return

        try:
            employee = user.employee
        except ObjectDoesNotExist as exc:
            raise PermissionError("У CRM-пользователя нет профиля сотрудника.") from exc

        if not getattr(employee, permission_field, False):
            raise PermissionError("У вас нет прав для этой команды.")

    def _created_text(self, record_type: str, command) -> str:
        label = "доход" if record_type == "income" else "расход"
        return (
            f"Создан {label}.\n"
            f"Сумма: {command.amount} KZT\n"
            f"Тип: {command.label}\n"
            f"Дата: {command.record_date.isoformat()}"
        )

    def _whoami_text(self, from_data: dict, user) -> str:
        lines = [
            f"Telegram ID: {from_data.get('id')}",
            f"Username: @{from_data.get('username')}" if from_data.get("username") else "Username: -",
        ]

        if user:
            lines.append(f"CRM пользователь: {user}")
        else:
            lines.append("CRM пользователь: не привязан")

        return "\n".join(lines)

    def _not_linked_text(self, from_data: dict) -> str:
        return (
            "Ваш Telegram аккаунт не привязан к CRM.\n"
            f"Отправьте этот Telegram ID администратору: {from_data.get('id')}\n"
            "Администратор должен указать его в поле telegram_id у CRM-пользователя."
        )

    def _wallet_text(self) -> str:
        wallet = Wallet.default()
        logs = (
            WalletLog.objects.select_related("actor", "wallet")
            .order_by("-created_at", "-id")[:5]
        )
        lines = [
            "Кошелек компании",
            f"Баланс: {self.reports._money(wallet.balance)} KZT",
            "",
            "Последние изменения:",
        ]

        if not logs:
            lines.append("Пока нет изменений.")
            return "\n".join(lines)

        for log in logs:
            actor = self._actor_name(log.actor)
            created_at = timezone.localtime(log.created_at).strftime("%Y-%m-%d %H:%M")
            sign = "+" if log.amount_delta >= 0 else ""
            description = log.description or log.get_action_display()
            lines.append(
                f"{created_at} {sign}{self.reports._money(log.amount_delta)} KZT "
                f"- {description} ({actor})"
            )

        return "\n".join(lines)

    def _actor_name(self, actor) -> str:
        if not actor:
            return "system"

        return actor.get_full_name() or actor.email or actor.username or str(actor)

    def _help_text(self) -> str:
        return (
            "Команды CRM-бота:\n\n"
            "1. Добавить доход\n"
            "/income 15000 website\n"
            "/income 15000 website 2026-06-09\n\n"
            "2. Добавить расход\n"
            "/spending 5000 ads\n"
            "/spending 5000 office yesterday\n\n"
            "3. Получить отчет\n"
            "/report week\n"
            "/report month\n"
            "/report 2026-06-01 2026-06-09\n\n"
            "4. Посмотреть кошелек компании\n"
            "/wallet\n\n"
            "5. Узнать свой Telegram ID\n"
            "/whoami\n\n"
            "Периоды: week, month, year, all.\n"
            "Даты: today, yesterday, YYYY-MM-DD или DD.MM.YYYY.\n\n"
            "Перед использованием бота администратор должен указать ваш Telegram ID "
            "в CRM-пользователе."
        )
