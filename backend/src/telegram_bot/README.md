# Telegram CRM Bot

Бот работает через webhook: Telegram отправляет команды в Django endpoint,
backend проверяет привязанного CRM-пользователя и его права, затем создает
записи, обновляет кошелек или возвращает аналитику.

## Как Запустить

1. Создайте бота через BotFather и скопируйте token.
2. Добавьте переменные окружения:

```bash
TELEGRAM_BOT_TOKEN=123456:telegram-token
TELEGRAM_WEBHOOK_SECRET=some-random-secret
```

3. Запустите backend и примените migrations:

```bash
poetry run python manage.py migrate
poetry run python manage.py runserver
```

4. Telegram должен видеть backend через публичный HTTPS URL.
   Для локального запуска можно использовать ngrok или cloudflared.

5. Зарегистрируйте webhook:

```bash
poetry run python manage.py set_telegram_webhook https://your-domain.com/api/telegram/webhook/
```

6. В Telegram отправьте команду боту или в группу:

```text
/whoami
```

7. Скопируйте Telegram ID и укажите его в поле `telegram_id` нужного
   CRM-пользователя в Django admin.

## Команды

Добавить доход:

```text
/income 15000 website
/income 15000 website 2026-06-09
```

Добавить расход:

```text
/spending 5000 ads
/spending 5000 office yesterday
```

Получить отчет:

```text
/report week
/report month
/report year
/report all
/report 2026-06-01 2026-06-09
```

Посмотреть кошелек компании:

```text
/wallet
```

Служебные команды:

```text
/whoami
/help
```

Поддерживаемые периоды отчета: `week`, `month`, `year`, `all`.

Поддерживаемые даты: `today`, `yesterday`, `YYYY-MM-DD` или `DD.MM.YYYY`.

## Права

Бот использует права CRM:

- создание income/spending: `accounting_can_create`
- доступ к отчетам: `accounting_can_retrieve`
- просмотр `/wallet`: любой привязанный CRM-пользователь
- staff и superuser проходят без employee-флагов
