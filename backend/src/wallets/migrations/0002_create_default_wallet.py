from decimal import Decimal

from django.db import migrations
from django.db.models import Sum


def create_default_wallet(apps, schema_editor):
    Income = apps.get_model("incomes", "Income")
    Spending = apps.get_model("spendings", "Spending")
    Wallet = apps.get_model("wallets", "Wallet")
    WalletLog = apps.get_model("wallets", "WalletLog")

    income_total = Income.objects.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    spending_total = Spending.objects.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    balance = income_total - spending_total

    wallet = Wallet.objects.filter(is_default=True).first()
    balance_before = Decimal("0.00")

    if wallet is None:
        wallet = Wallet.objects.create(
            name="Company wallet",
            balance=balance,
            is_default=True,
        )
    else:
        balance_before = wallet.balance
        wallet.balance = balance
        wallet.save(update_fields=("balance", "updated_at"))

    WalletLog.objects.create(
        wallet=wallet,
        action="wallet_initialized",
        amount_delta=balance - balance_before,
        balance_before=balance_before,
        balance_after=balance,
        description="Initial wallet balance from existing incomes and spendings.",
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("incomes", "0002_alter_income_date_earned"),
        ("spendings", "0002_alter_spending_date_spend"),
        ("wallets", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_default_wallet, noop_reverse),
    ]
