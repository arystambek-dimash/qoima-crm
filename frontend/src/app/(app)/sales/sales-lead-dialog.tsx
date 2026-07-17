"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Handshake, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { asApiError } from "@/lib/api";
import { sales } from "@/lib/endpoints";
import type { SalesLead } from "@/lib/types";

export function SalesLeadDialog({
  trigger,
  initial,
}: {
  trigger: React.ReactNode;
  initial?: SalesLead;
}) {
  const [open, setOpen] = useState(false);
  const [leadName, setLeadName] = useState(initial?.lead_name ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [comments, setComments] = useState(initial?.comments ?? "");
  const queryClient = useQueryClient();

  function openDialog() {
    setLeadName(initial?.lead_name ?? "");
    setCompany(initial?.company ?? "");
    setAmount(initial?.amount ?? "");
    setComments(initial?.comments ?? "");
    setOpen(true);
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        lead_name: leadName.trim(),
        company: company.trim(),
        amount,
        comments: comments.trim(),
      };
      return initial
        ? sales.update(initial.id, payload)
        : sales.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-leads"] });
      toast.success(initial ? "Лид обновлён." : "Лид добавлен в продажи.");
      setOpen(false);
      if (!initial) {
        setLeadName("");
        setCompany("");
        setAmount("");
        setComments("");
      }
    },
    onError: (error) => toast.error(asApiError(error).message),
  });

  const isValid =
    leadName.trim().length > 0 &&
    company.trim().length > 0 &&
    Number(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={openDialog}>{trigger}</div>
      <DialogContent className="max-w-[540px]">
        <DialogHeader
          eyebrow={
            initial
              ? "Отдел продаж · Редактирование"
              : "Отдел продаж · Новый лид"
          }
          title={
            <span className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-tag-blue-bg text-tag-blue-fg">
                <Handshake className="h-4 w-4" />
              </span>
              <span>{initial ? "Изменить лида" : "Добавить лида"}</span>
            </span>
          }
          description="Контакт и потенциальная сумма сделки будут доступны всему отделу продаж."
        />

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (isValid) mutation.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Имя лида">
              <Input
                value={leadName}
                onChange={(event) => setLeadName(event.target.value)}
                placeholder="Например, Айдана Садыкова"
                autoComplete="off"
                autoFocus
                required
              />
            </Field>

            <Field label="Компания лида">
              <Input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Например, Alem Logistics"
                autoComplete="organization"
                required
              />
            </Field>
          </div>

          <Field label="Сумма">
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-medium text-ink-3"
                aria-hidden
              >
                ₸
              </span>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="pl-7 pr-12 font-mono text-[15px] tabular-nums"
                required
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-[0.08em] text-ink-4">
                KZT
              </span>
            </div>
          </Field>

          <Field label="Комментарии" hint="Необязательно">
            <Textarea
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              rows={4}
              placeholder="Потребность лида, источник, договорённости или следующий шаг"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!isValid || mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Сохраняем…
                </>
              ) : (
                <>
                  {!initial && <Plus className="h-3.5 w-3.5" />}
                  {initial ? "Сохранить" : "Добавить лида"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
