# Telegram CRM Bot

The bot works through a webhook: Telegram sends commands to the Django endpoint,
the backend checks the linked CRM user's permissions, then creates records or
returns analytics.

## How To Run

1. Create a bot with BotFather and copy the bot token.
2. Add environment variables:

```bash
TELEGRAM_BOT_TOKEN=123456:telegram-token
TELEGRAM_WEBHOOK_SECRET=some-random-secret
```

3. Run the backend and apply migrations:

```bash
poetry run python manage.py migrate
poetry run python manage.py runserver
```

4. Telegram must be able to reach your backend through a public HTTPS URL.
   For local development, expose the backend with ngrok or cloudflared.

5. Register the webhook:

```bash
poetry run python manage.py set_telegram_webhook https://your-domain.com/api/telegram/webhook/
```

6. In Telegram, send this command to the bot or to the group:

```text
/whoami
```

7. Copy the Telegram ID and set it on the correct CRM user's `telegram_id`
   field in Django admin.

## Commands

Add income:

```text
/income 15000 website
/income 15000 website 2026-06-09
```

Add spending:

```text
/spending 5000 ads
/spending 5000 office yesterday
```

Get a report:

```text
/report week
/report month
/report year
/report all
/report 2026-06-01 2026-06-09
```

Utility:

```text
/whoami
/help
```

Supported report periods: `week`, `month`, `year`, `all`.

Supported dates: `today`, `yesterday`, `YYYY-MM-DD`, or `DD.MM.YYYY`.

## Permissions

The bot uses existing CRM permissions:

- creating income/spending records: `accounting_can_create`
- report access: `accounting_can_retrieve`
- staff and superuser accounts bypass employee flags
