from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q


class Wallet(models.Model):
    name = models.CharField(max_length=120)
    balance = models.DecimalField(
        decimal_places=2,
        default=Decimal("0.00"),
        max_digits=20,
    )
    is_default = models.BooleanField(default=False, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-is_default", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("is_default",),
                condition=Q(is_default=True),
                name="wallets_single_default_wallet",
            ),
        ]

    def __str__(self):
        return f"{self.name}: {self.balance}"

    @classmethod
    def default(cls):
        wallet = cls.objects.filter(is_default=True).first()

        if wallet:
            return wallet

        return cls.objects.create(name="Company wallet", is_default=True)


class WalletLog(models.Model):
    class Action(models.TextChoices):
        WALLET_CREATED = "wallet_created", "Wallet created"
        WALLET_UPDATED = "wallet_updated", "Wallet updated"
        WALLET_DELETED = "wallet_deleted", "Wallet deleted"
        WALLET_INITIALIZED = "wallet_initialized", "Wallet initialized"
        INCOME_CREATED = "income_created", "Income created"
        INCOME_UPDATED = "income_updated", "Income updated"
        INCOME_DELETED = "income_deleted", "Income deleted"
        SPENDING_CREATED = "spending_created", "Spending created"
        SPENDING_UPDATED = "spending_updated", "Spending updated"
        SPENDING_DELETED = "spending_deleted", "Spending deleted"

    wallet = models.ForeignKey(
        Wallet,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="logs",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="wallet_logs",
    )
    action = models.CharField(max_length=40, choices=Action.choices)
    amount_delta = models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=20)
    balance_before = models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=20)
    balance_after = models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=20)
    description = models.TextField(blank=True)
    related_object_type = models.CharField(max_length=120, blank=True)
    related_object_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")

    def __str__(self):
        return f"{self.action}: {self.amount_delta}"
