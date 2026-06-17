"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { deals, users } from "@/lib/endpoints";
import { asApiError } from "@/lib/api";
import { userIdOf } from "@/lib/user-helpers";
import type { Deal, DealPaymentType, User } from "@/lib/types";

const PAYMENT_TYPES: { value: DealPaymentType; label: string }[] = [
  { value: "card", label: "Карта" },
  { value: "cash", label: "Наличные" },
  { value: "loan", label: "В рассрочку" },
];

const STAGES = [
  { value: "active", label: "В процессе" },
  { value: "completed", label: "Выполнено" },
  { value: "cancelled", label: "Отменено" },
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

  const [name, setName] = useState(deal.name ?? "");
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

  const primaryId = userIdOf(deal.user);
  const initialExtraIds = useMemo(() => {
    const all = deal.collaborators ?? [];
    return all.filter((id) => id !== primaryId);
  }, [deal.collaborators, primaryId]);
  const [extraCollaboratorIds, setExtraCollaboratorIds] =
    useState<number[]>(initialExtraIds);
  const [responsibleIds, setResponsibleIds] = useState<number[]>(
    deal.responsibles ?? []
  );

  const collaboratorsQ = useQuery({
    queryKey: ["users", "collaborator"],
    queryFn: () => users.list("collaborator"),
    enabled: open,
  });
  const responsiblesQ = useQuery({
    queryKey: ["users", "employee"],
    queryFn: () => users.list("employee"),
    enabled: open,
  });
  const collaboratorList = useMemo(
    () => collaboratorsQ.data ?? [],
    [collaboratorsQ.data]
  );
  const responsibleList = useMemo(
    () => responsiblesQ.data ?? [],
    [responsiblesQ.data]
  );

  const update = useMutation({
    mutationFn: () => {
      const collaboratorSet = new Set<number>();
      if (primaryId != null) collaboratorSet.add(primaryId);
      for (const id of extraCollaboratorIds) collaboratorSet.add(id);

      return deals.update(deal.id, {
        name,
        stage,
        deal_amount: amount,
        payment_type: paymentType,
        date_start: dateStart,
        date_end: dateEnd,
        // payment_completed and is_active aren't in DealCreate; sent through
        // `as never` — backend accepts them on PATCH (partial=True).
        payment_completed: paymentCompleted,
        is_active: stage === "active",
        collaborators: Array.from(collaboratorSet),
        responsibles: responsibleIds,
      } as never);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal", deal.id] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Проект обновлён.");
      onOpenChange(false);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader
          eyebrow={`Проект #${deal.id} · Редактировать`}
          title="Редактировать проект"
          description="Поменяйте название, сумму, сроки, ответственных или статус — изменения уйдут на сервер."
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
          className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1"
        >
          <Field label="Название проекта">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field label="Статус проекта">
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

          <EditCollaborators
            users={collaboratorList}
            primaryId={primaryId}
            selectedIds={extraCollaboratorIds}
            onChange={setExtraCollaboratorIds}
            loading={collaboratorsQ.isLoading}
          />

          <EditResponsibles
            users={responsibleList}
            selectedIds={responsibleIds}
            onChange={setResponsibleIds}
            loading={responsiblesQ.isLoading}
          />

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

function userShortName(u: User): string {
  return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.username || u.email;
}

function EditResponsibles({
  users: list,
  selectedIds,
  onChange,
  loading,
}: {
  users: User[];
  selectedIds: number[];
  onChange: (next: number[]) => void;
  loading?: boolean;
}) {
  const selected = list.filter((u) => selectedIds.includes(u.id));

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] font-medium text-ink-2">
          Ответственные
        </label>
        <span className="text-[11px] text-ink-4">
          {selected.length} выбрано
        </span>
      </div>
      <div className="rounded-md border border-hairline-strong bg-canvas max-h-[160px] overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="text-[12px] text-ink-4 px-3 py-4 text-center">
            Загрузка сотрудников…
          </div>
        ) : list.length === 0 ? (
          <div className="text-[12px] text-ink-4 px-3 py-4 text-center">
            Сотрудников пока нет
          </div>
        ) : (
          list.map((u) => {
            const picked = selectedIds.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className="w-full flex items-center gap-2 px-2 h-9 text-[13px] text-left hover:bg-surface-2 transition-colors"
              >
                <Avatar name={userShortName(u)} size={20} className="text-[10px]" />
                <span className="flex-1 min-w-0">
                  <span className="block text-ink truncate">{userShortName(u)}</span>
                  <span className="block text-[11px] text-ink-4 truncate">
                    {u.email}
                  </span>
                </span>
                {picked && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function EditCollaborators({
  users: list,
  primaryId,
  selectedIds,
  onChange,
  loading,
}: {
  users: User[];
  primaryId: number | null;
  selectedIds: number[];
  onChange: (next: number[]) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const selectableUsers = list.filter((u) => u.id !== primaryId);
  const selected = selectableUsers.filter((u) => selectedIds.includes(u.id));
  const term = filter.trim().toLowerCase();
  const candidates = selectableUsers.filter((u) => {
    if (!term) return true;
    return (
      (u.first_name ?? "").toLowerCase().includes(term) ||
      (u.last_name ?? "").toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function display(u: User) {
    const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
    return name || u.username || u.email;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] font-medium text-ink-2">
          Дополнительные участники
        </label>
        <span className="text-[11px] text-ink-4">
          {selected.length} выбрано
        </span>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 h-7 pl-1 pr-1.5 rounded-full bg-tag-blue-bg text-tag-blue-fg text-[12px]"
            >
              <Avatar
                name={display(u)}
                size={20}
                className="text-[10px] ring-1 ring-canvas"
              />
              <span className="max-w-[160px] truncate">{display(u)}</span>
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className="h-4 w-4 grid place-items-center rounded-full hover:bg-canvas/60 transition-colors"
                aria-label="Убрать"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={loading || selectableUsers.length === 0}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-dashed border-hairline-strong text-[13px] text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "Загрузка…"
            : selectableUsers.length === 0
            ? "Других клиентов нет"
            : selected.length > 0
            ? "Добавить ещё"
            : "Добавить участников"}
        </button>
      ) : (
        <div className="rounded-md border border-hairline-strong bg-canvas shadow-card overflow-hidden">
          <div className="px-2 py-1.5 border-b border-hairline flex items-center gap-2">
            <Input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Поиск по имени или email"
              className="h-7 text-[12px]"
            />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFilter("");
              }}
              className="h-7 w-7 grid place-items-center rounded text-ink-4 hover:text-ink hover:bg-surface-2"
              title="Закрыть"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {candidates.length === 0 ? (
            <div className="text-[12px] text-ink-4 px-3 py-4 text-center">
              Никого не нашли
            </div>
          ) : (
            <ul className="max-h-[200px] overflow-y-auto scrollbar-thin py-1">
              {candidates.map((u) => {
                const picked = selectedIds.includes(u.id);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => toggle(u.id)}
                      className="w-full flex items-center gap-2 px-2 h-9 text-[13px] text-left hover:bg-surface-2 transition-colors"
                    >
                      <Avatar
                        name={display(u)}
                        size={20}
                        className="text-[10px]"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-ink truncate">
                          {display(u)}
                        </span>
                        <span className="block text-[11px] text-ink-4 truncate">
                          {u.email}
                        </span>
                      </span>
                      {picked && (
                        <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
