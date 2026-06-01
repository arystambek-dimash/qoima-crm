from enum import Enum

from django.db.models.enums import TextChoices


class UserRole(TextChoices):
    COLLABORATOR = "collaborator"
    EMPLOYEE = "employee"


class DealPaymentType(TextChoices):
    CASH = "cash"
    CARD = "card"
    LOAN = "loan"