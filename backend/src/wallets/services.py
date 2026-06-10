from decimal import Decimal

from django.db import transaction

from src.wallets.models import Wallet, WalletLog


def actor_or_none(user):
    if user and getattr(user, "is_authenticated", False):
        return user

    return None


def default_wallet_for_update():
    wallet = Wallet.objects.select_for_update().filter(is_default=True).first()

    if wallet:
        return wallet

    return Wallet.objects.create(name="Company wallet", is_default=True)


def log_wallet_change(
    *,
    wallet,
    actor=None,
    action,
    amount_delta,
    balance_before,
    balance_after,
    related_object=None,
    description="",
):
    related_object_type = ""
    related_object_id = ""

    if related_object is not None:
        related_object_type = related_object._meta.label
        related_object_id = str(related_object.pk)

    return WalletLog.objects.create(
        wallet=wallet,
        actor=actor_or_none(actor),
        action=action,
        amount_delta=amount_delta,
        balance_before=balance_before,
        balance_after=balance_after,
        related_object_type=related_object_type,
        related_object_id=related_object_id,
        description=description,
    )


@transaction.atomic
def apply_default_wallet_delta(
    amount_delta,
    *,
    actor=None,
    action,
    related_object=None,
    description="",
):
    wallet = default_wallet_for_update()
    delta = Decimal(amount_delta)
    balance_before = wallet.balance
    wallet.balance = balance_before + delta
    wallet.save(update_fields=("balance", "updated_at"))

    log = log_wallet_change(
        wallet=wallet,
        actor=actor,
        action=action,
        amount_delta=delta,
        balance_before=balance_before,
        balance_after=wallet.balance,
        related_object=related_object,
        description=description,
    )

    return wallet, log


def record_income_created(income, *, actor=None, description=""):
    return apply_default_wallet_delta(
        income.amount,
        actor=actor,
        action=WalletLog.Action.INCOME_CREATED,
        related_object=income,
        description=description or f"Income created: {income.name}",
    )


def record_income_updated(income, *, old_amount, actor=None, description=""):
    return apply_default_wallet_delta(
        income.amount - old_amount,
        actor=actor,
        action=WalletLog.Action.INCOME_UPDATED,
        related_object=income,
        description=description or f"Income updated: {income.name}",
    )


def record_income_deleted(income, *, actor=None, description=""):
    return apply_default_wallet_delta(
        -income.amount,
        actor=actor,
        action=WalletLog.Action.INCOME_DELETED,
        related_object=income,
        description=description or f"Income deleted: {income.name}",
    )


def record_spending_created(spending, *, actor=None, description=""):
    return apply_default_wallet_delta(
        -spending.amount,
        actor=actor,
        action=WalletLog.Action.SPENDING_CREATED,
        related_object=spending,
        description=description or f"Spending created: {spending.name}",
    )


def record_spending_updated(spending, *, old_amount, actor=None, description=""):
    return apply_default_wallet_delta(
        old_amount - spending.amount,
        actor=actor,
        action=WalletLog.Action.SPENDING_UPDATED,
        related_object=spending,
        description=description or f"Spending updated: {spending.name}",
    )


def record_spending_deleted(spending, *, actor=None, description=""):
    return apply_default_wallet_delta(
        spending.amount,
        actor=actor,
        action=WalletLog.Action.SPENDING_DELETED,
        related_object=spending,
        description=description or f"Spending deleted: {spending.name}",
    )
