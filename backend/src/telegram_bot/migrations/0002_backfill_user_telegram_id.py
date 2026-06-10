from django.db import migrations


def copy_telegram_accounts_to_users(apps, schema_editor):
    TelegramAccount = apps.get_model("telegram_bot", "TelegramAccount")
    User = apps.get_model("users", "User")

    for account in TelegramAccount.objects.exclude(telegram_user_id__isnull=True):
        User.objects.filter(pk=account.user_id, telegram_id__isnull=True).update(
            telegram_id=account.telegram_user_id
        )


def clear_user_telegram_ids(apps, schema_editor):
    TelegramAccount = apps.get_model("telegram_bot", "TelegramAccount")
    User = apps.get_model("users", "User")
    telegram_ids = TelegramAccount.objects.values_list("telegram_user_id", flat=True)
    User.objects.filter(telegram_id__in=telegram_ids).update(telegram_id=None)


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_user_telegram_id"),
        ("telegram_bot", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            copy_telegram_accounts_to_users,
            clear_user_telegram_ids,
        ),
    ]
