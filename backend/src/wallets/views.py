from decimal import Decimal

from core.permissions import WalletPermissions
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from src.wallets.models import Wallet, WalletLog
from src.wallets.serializers import WalletLogSerializer, WalletSerializer
from src.wallets.services import log_wallet_change


class WalletViewSet(viewsets.ModelViewSet):
    queryset = Wallet.objects.all()
    serializer_class = WalletSerializer
    permission_classes = [IsAuthenticated, WalletPermissions]

    @action(detail=False, methods=["get"], url_path="current")
    def current(self, request):
        serializer = self.get_serializer(Wallet.default())
        return Response(serializer.data)

    def perform_create(self, serializer):
        with transaction.atomic():
            is_default = serializer.validated_data.get("is_default")

            if is_default or not Wallet.objects.filter(is_default=True).exists():
                Wallet.objects.filter(is_default=True).update(is_default=False)
                is_default = True

            if is_default:
                wallet = serializer.save(is_default=True)
            else:
                wallet = serializer.save()
            balance_before = Decimal("0.00")
            log_wallet_change(
                wallet=wallet,
                actor=self.request.user,
                action=WalletLog.Action.WALLET_CREATED,
                amount_delta=wallet.balance,
                balance_before=balance_before,
                balance_after=wallet.balance,
                related_object=wallet,
                description=f"Wallet created: {wallet.name}",
            )

    def perform_update(self, serializer):
        with transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(pk=serializer.instance.pk)
            balance_before = wallet.balance

            if wallet.is_default and serializer.validated_data.get("is_default") is False:
                raise ValidationError("Default wallet cannot be unset.")

            if serializer.validated_data.get("is_default"):
                Wallet.objects.exclude(pk=wallet.pk).filter(is_default=True).update(
                    is_default=False,
                )

            updated_wallet = serializer.save()
            amount_delta = updated_wallet.balance - balance_before
            log_wallet_change(
                wallet=updated_wallet,
                actor=self.request.user,
                action=WalletLog.Action.WALLET_UPDATED,
                amount_delta=amount_delta,
                balance_before=balance_before,
                balance_after=updated_wallet.balance,
                related_object=updated_wallet,
                description=f"Wallet updated: {updated_wallet.name}",
            )

    def destroy(self, request, *args, **kwargs):
        wallet = self.get_object()

        if wallet.is_default:
            return Response(
                {"detail": "Default wallet cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.perform_destroy(wallet)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance):
        with transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(pk=instance.pk)
            log_wallet_change(
                wallet=wallet,
                actor=self.request.user,
                action=WalletLog.Action.WALLET_DELETED,
                amount_delta=-wallet.balance,
                balance_before=wallet.balance,
                balance_after=Decimal("0.00"),
                related_object=wallet,
                description=f"Wallet deleted: {wallet.name}",
            )
            wallet.delete()


class WalletLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WalletLog.objects.select_related("wallet", "actor")
    serializer_class = WalletLogSerializer
    permission_classes = [IsAuthenticated]
