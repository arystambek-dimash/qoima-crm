# Telegram CRM bot

Бот работает через webhook: Telegram отправляет команды на Django endpoint,
backend проверяет права CRM пользователя и выполняет действие.

## Как запустить

1. Создай бота через BotFather и получи token.
2. Добавь переменные окружения:

```bash
TELEGRAM_BOT_TOKEN=123456:telegram-token
TELEGRAM_WEBHOOK_SECRET=some-random-secret
```

3. Запусти backend и примени миграции:

```bash
poetry run python manage.py migrate
poetry run python manage.py runserver
```

4. Backend должен быть доступен Telegram по публичному HTTPS URL.
   Для локальной разработки можно открыть backend через ngrok/cloudflared.

5. Установи webhook:

```bash
poetry run python manage.py set_telegram_webhook https://your-domain.com/api/telegram/webhook/
```

6. В Telegram отправь боту или в группе:

```text
/whoami
```

7. Скопируй Telegram ID и в Django admin создай `TelegramAccount`,
   привязав этот ID к CRM пользователю.

## Команды

```text
/income 15000 сайт
/dohod 15000 сайт 2026-06-09

/spending 5000 реклама
/rashod 5000 офис вчера

/report week
/otchet month
/otchet 2026-06-01 2026-06-09

/whoami
/help
```

Периоды для отчёта: `week`, `month`, `year`, `all`.
Также можно писать: `неделя`, `месяц`, `год`, `все`.

Даты: `сегодня`, `вчера`, `YYYY-MM-DD`, `DD.MM.YYYY`.

## Права

Бот использует CRM permissions:

- создание доходов/расходов: `accounting_can_create`
- отчёты: `accounting_can_retrieve`
- staff/superuser проходят проверку автоматически
