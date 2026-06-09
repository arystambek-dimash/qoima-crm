from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
import re

from django.utils import timezone
from django.utils.dateparse import parse_date


class CommandParseError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedCommand:
    name: str
    raw: str
    amount: Decimal | None = None
    label: str = ""
    record_date: date | None = None
    period: str = ""
    date_from: date | None = None
    date_to: date | None = None


class CommandParser:
    AMOUNT_RE = re.compile(
        r"^\s*(?P<amount>\d[\d\s_]*(?:[.,]\d{1,2})?)\s*(?P<tail>.*)$"
    )
    PERIODS = {"week", "month", "year", "all"}
    PERIOD_ALIASES = {
        "week": "week",
        "nedelya": "week",
        "неделя": "week",
        "неделю": "week",
        "апта": "week",
        "month": "month",
        "mesyac": "month",
        "месяц": "month",
        "ай": "month",
        "year": "year",
        "god": "year",
        "год": "year",
        "жыл": "year",
        "all": "all",
        "vse": "all",
        "все": "all",
        "барлығы": "all",
    }

    def parse(self, text: str) -> ParsedCommand:
        raw = text.strip()

        if not raw:
            raise CommandParseError("Пустая команда.")

        command, rest = self._split_command(raw)

        if command in {"start", "help", "pomosh"}:
            return ParsedCommand(name="help", raw=raw)

        if command in {"whoami", "ktoya"}:
            return ParsedCommand(name="whoami", raw=raw)

        if command in {"income", "in", "dohod"}:
            return self._parse_money_command("income", raw, rest)

        if command in {"spending", "expense", "spend", "out", "rashod"}:
            name = "spending"
            return self._parse_money_command(name, raw, rest)

        if command in {"report", "r", "otchet"}:
            return self._parse_report(raw, rest)

        raise CommandParseError(f"Неизвестная команда: /{command}")

    def _split_command(self, raw: str) -> tuple[str, str]:
        if not raw.startswith("/"):
            raise CommandParseError("Команда должна начинаться с /. Например: /otchet month.")

        first, _, rest = raw.partition(" ")
        command = first.removeprefix("/").split("@", 1)[0].lower()
        return command, rest.strip()

    def _parse_money_command(
        self,
        command: str,
        raw: str,
        rest: str,
    ) -> ParsedCommand:
        match = self.AMOUNT_RE.match(rest)

        if not match:
            raise CommandParseError(
                f"Формат: /{command} <сумма> <тип> [дата]."
            )

        amount = self._parse_amount(match.group("amount"))
        label, record_date = self._extract_tail_date(match.group("tail"))

        return ParsedCommand(
            name=command,
            raw=raw,
            amount=amount,
            label=label or "telegram",
            record_date=record_date or timezone.localdate(),
        )

    def _parse_report(self, raw: str, rest: str) -> ParsedCommand:
        today = timezone.localdate()
        parts = rest.split()

        if not parts:
            return ParsedCommand(name="report", raw=raw, period="month")

        first_date = self._parse_date(parts[0], today)

        if first_date:
            second_date = self._parse_date(parts[1], today) if len(parts) > 1 else today

            if second_date is None:
                raise CommandParseError("Вторая дата отчёта указана неверно.")

            return ParsedCommand(
                name="report",
                raw=raw,
                period="custom",
                date_from=first_date,
                date_to=second_date,
            )

        period = self.PERIOD_ALIASES.get(parts[0].lower(), "")

        if period not in self.PERIODS:
            raise CommandParseError(
                "Формат отчёта: /otchet week, month, year, all или две даты."
            )

        return ParsedCommand(name="report", raw=raw, period=period)

    def _extract_tail_date(self, tail: str) -> tuple[str, date | None]:
        today = timezone.localdate()
        parts = tail.split()

        if not parts:
            return "", None

        parsed = self._parse_date(parts[-1], today)

        if parsed:
            return " ".join(parts[:-1]).strip(), parsed

        return tail.strip(), None

    def _parse_amount(self, value: str) -> Decimal:
        normalized = re.sub(r"[\s_]", "", value).replace(",", ".")

        try:
            amount = Decimal(normalized)
        except InvalidOperation as error:
            raise CommandParseError("Сумма указана неверно.") from error

        if amount <= 0:
            raise CommandParseError("Сумма должна быть больше нуля.")

        return amount

    def _parse_date(self, value: str, today: date) -> date | None:
        normalized = value.strip().lower()

        if normalized in {"today", "сегодня", "bugun", "бүгін"}:
            return today

        if normalized in {"yesterday", "вчера", "keshe", "кеше"}:
            return today - timedelta(days=1)

        parsed = parse_date(normalized)

        if parsed:
            return parsed

        match = re.fullmatch(r"(\d{1,2})[./](\d{1,2})[./](\d{4})", normalized)

        if match:
            day, month, year = (int(part) for part in match.groups())

            try:
                return date(year, month, day)
            except ValueError:
                return None

        return None
