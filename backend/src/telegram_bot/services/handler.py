from django.core.exceptions import ObjectDoesNotExist
from src.incomes.models import Income
from src.spendings.models import Spending
from src.telegram_bot.models import (
    TelegramAccount,
    TelegramChat,
    TelegramCommandLog,
)
from src.telegram_bot.services.parser import CommandParseError, CommandParser
from src.telegram_bot.services.reports import ReportBuilder
from src.telegram_bot.services.telegram import TelegramClient


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

        message = update.get("message") or update.get("edited_message") or {}
        text = message.get("text", "")
        chat_data = message.get("chat") or {}
        from_data = message.get("from") or {}

        if not text:
            return self._log_ignored(update_id, chat_data, from_data)

        chat = self._upsert_chat(chat_data)
        account = self._account(from_data)
        user = account.user if account else None
        command_name = ""
        created_object = None

        try:
            command = self.parser.parse(text)
            command_name = command.name

            if command.name == "help":
                response = self._help_text()
                status = TelegramCommandLog.Status.SUCCESS
            elif command.name == "whoami":
                response = self._whoami_text(from_data, account)
                status = TelegramCommandLog.Status.SUCCESS
            elif not account or not account.is_active:
                response = self._not_linked_text(from_data)
                status = TelegramCommandLog.Status.DENIED
            elif command.name == "report":
                self._require_accounting(user, "accounting_can_retrieve")
                response = self.reports.build(command)
                status = TelegramCommandLog.Status.SUCCESS
            elif command.name == "income":
                self._require_accounting(user, "accounting_can_create")
                created_object = Income.objects.create(
                    name=command.label,
                    type=command.label,
                    amount=command.amount,
                    date_earned=command.record_date,
                    note=f"Telegram: {text}",
                )
                response = self._created_text("income", command)
                status = TelegramCommandLog.Status.SUCCESS
            elif command.name == "spending":
                self._require_accounting(user, "accounting_can_create")
                created_object = Spending.objects.create(
                    name=command.label,
                    type=command.label,
                    amount=command.amount,
                    date_spend=command.record_date,
                    note=f"Telegram: {text}",
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
            account=account,
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

    def _existing_log(self, update_id):
        if update_id is None:
            return None

        return TelegramCommandLog.objects.filter(update_id=update_id).first()

    def _log_ignored(self, update_id, chat_data: dict, from_data: dict) -> dict:
        chat = self._upsert_chat(chat_data)
        account = self._account(from_data)
        log = TelegramCommandLog.objects.create(
            update_id=update_id,
            chat=chat,
            account=account,
            user=account.user if account else None,
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

    def _account(self, from_data: dict) -> TelegramAccount | None:
        telegram_user_id = from_data.get("id")

        if not telegram_user_id:
            return None

        account = (
            TelegramAccount.objects.select_related("user")
            .filter(telegram_user_id=telegram_user_id)
            .first()
        )

        if account:
            account.username = from_data.get("username", "")
            account.first_name = from_data.get("first_name", "")
            account.last_name = from_data.get("last_name", "")
            account.save(update_fields=["username", "first_name", "last_name", "updated_at"])

        return account

    def _require_accounting(self, user, permission_field: str) -> None:
        if not user or not user.is_authenticated:
            raise PermissionError("Telegram account is not linked to a CRM user.")

        if user.is_staff or user.is_superuser:
            return

        try:
            employee = user.employee
        except ObjectDoesNotExist as exc:
            raise PermissionError("CRM user has no employee permission profile.") from exc

        if not getattr(employee, permission_field, False):
            raise PermissionError("You do not have permission for this command.")

    def _created_text(self, record_type: str, command) -> str:
        return (
            f"Created {record_type}.\n"
            f"Amount: {command.amount} KZT\n"
            f"Type: {command.label}\n"
            f"Date: {command.record_date.isoformat()}"
        )

    def _whoami_text(self, from_data: dict, account: TelegramAccount | None) -> str:
        lines = [
            f"Telegram ID: {from_data.get('id')}",
            f"Username: @{from_data.get('username')}" if from_data.get("username") else "Username: -",
        ]

        if account:
            lines.append(f"CRM user: {account.user}")
        else:
            lines.append("CRM user: not linked")

        return "\n".join(lines)

    def _not_linked_text(self, from_data: dict) -> str:
        return (
            "Your Telegram account is not linked to CRM.\n"
            f"Send this Telegram ID to an admin: {from_data.get('id')}"
        )

    def _help_text(self) -> str:
        return (
            "Commands:\n"
            "/income 15000 website [date]\n"
            "/spending 5000 ads [date]\n"
            "/report week|month|year|all\n"
            "/report 2026-06-01 2026-06-09\n"
            "/whoami\n\n"
            "Dates: today, yesterday, YYYY-MM-DD, or DD.MM.YYYY."
        )
