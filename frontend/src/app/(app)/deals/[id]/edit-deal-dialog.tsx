"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { deals } from "@/lib/endpoints";
import { asApiError } from "@/lib/api";
import type { Deal, DealPaymentType } from "@/lib/types";

const PAYMENT_TYPES: { value: DealPaymentType; label: string }[] = [
  { value: "card", label: "Карта" },
  { value: "cash", label: "Наличные" },
  { value: "loan", label: "В рассрочку" },
];

const STAGES = [
  { value: "active", label: "Активный" },
  { value: "completed", label: "Выполнен" },
  { value: "cancelled", label: "Отменён" },
];

export function EditDealDialog({
  deal,
  open,
  onOpenChange,
}: {
  deal: Deal;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();

  const [stage, setStage] = useState(deal.stage);
  const [amount, setAmount] = useState(deal.deal_amount);
  const [paymentType, setPaymentType] = useState<DealPaymentType>(
    deal.payment_type
  );
  const [dateStart, setDateStart] = useState(deal.date_start);
  const [dateEnd, setDateEnd] = useState(deal.date_end);
  const [paymentCompleted, setPaymentCompleted] = useState(
    deal.payment_completed
  );

  const update = useMutation({
    mutationFn: () =>
      deals.update(deal.id, {
        stage,
        deal_amount: amount,
        payment_type: paymentType,
        date_start: dateStart,
        date_end: dateEnd,
        // payment_completed is not in DealCreate; sent through `as never` —
        // backend accepts it on PATCH because the serializer is partial=True.
        payment_completed: paymentCompleted,
        is_active: stage === "active",
      } as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal", deal.id] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Заказ обновлён.");
      onOpenChange(false);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader
          eyebrow={`Заказ #${deal.id} · Редактировать`}
          title="Редактировать заказ"
          description="Поменяйте сумму, способ оплаты, сроки или статус — изменения уйдут на сервер."
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
          className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1"
        >
          <Field label="Стадия">
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="h-9 w-full bg-canvas border border-hairline-strong rounded-md px-3 text-[14px] text-ink hover:border-ink-5 focus:border-accent focus:shadow-[0_0_0_3px_rgba(35,131,226,0.18)] outline-none transition-all cursor-pointer"
            >
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Сумма (₸)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
            <Field label="Способ оплаты">
              <select
                value={paymentType}
                onChange={(e) =>
                  setPaymentType(e.target.value as DealPaymentType)
                }
                className="h-9 w-full bg-canvas border border-hairline-strong rounded-md px-3 text-[14px] text-ink hover:border-ink-5 focus:border-accent focus:shadow-[0_0_0_3px_rgba(35,131,226,0.18)] outline-none transition-all cursor-pointer"
              >
                {PAYMENT_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Дата начала">
              <Input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                required
              />
            </Field>
            <Field label="Срок">
              <Input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                required
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-ink-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={paymentCompleted}
              onChange={(e) => setPaymentCompleted(e.target.checked)}
              className="h-3.5 w-3.5 accent-accent"
            />
            Оплачено полностью
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={update.isPending}
            >
              {update.isPending ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
