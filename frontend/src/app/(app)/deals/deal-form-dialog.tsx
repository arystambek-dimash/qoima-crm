"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { useRole, useIsSuperuser, useHasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { DealCreate, DealPaymentType, User } from "@/lib/types";

const PAYMENT_TYPES: { value: DealPaymentType; label: string }[] = [
  { value: "card", label: "Карта" },
  { value: "cash", label: "Наличные" },
  { value: "loan", label: "В рассрочку" },
];

type ClientMode = "existing" | "new";

export function DealFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  const role = useRole();
  const isSuper = useIsSuperuser();
  const canCreateEmployee = useHasPermission("employees_can_create");

  // Admin = anyone allowed to manage employees, plus superusers. Collaborators
  // never see the client picker — backend will attach `user = request.user`.
  const isAdmin = isSuper || canCreateEmployee.granted;
  const showsClientControls = role !== "collaborator" && isAdmin;

  // Project fields
  const [name, setName] = useState("");
  const [stage, setStage] = useState("active");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState<DealPaymentType>("card");
  const [dateStart, setDateStart] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [dateEnd, setDateEnd] = useState("");

  // Client picker
  const [clientMode, setClientMode] = useState<ClientMode>("existing");
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  // Extra collaborators (beyond primary). Backend takes them via `collaborators`.
  const [extraCollaboratorIds, setExtraCollaboratorIds] = useState<number[]>(
    []
  );
  const [responsibleIds, setResponsibleIds] = useState<number[]>([]);

  // New client fields
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");

  const collaboratorsQ = useQuery({
    queryKey: ["users", "collaborator"],
    queryFn: () => users.list("collaborator"),
    enabled: open && showsClientControls,
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

  function reset() {
    setName("");
    setStage("active");
    setAmount("");
    setPaymentType("card");
    setDateStart(new Date().toISOString().slice(0, 10));
    setDateEnd("");
    setClientMode("existing");
    setSelectedUserId("");
    setExtraCollaboratorIds([]);
    setResponsibleIds([]);
    setNewUsername("");
    setNewEmail("");
    setNewPassword("");
    setNewFirstName("");
    setNewLastName("");
  }

  const create = useMutation({
    mutationFn: async () => {
      // Step 1: resolve primary userId (create new client if needed).
      let userId: number | undefined;

      if (showsClientControls) {
        if (clientMode === "new") {
          const newUser = await users.create({
            username: newUsername,
            email: newEmail,
            password: newPassword,
            first_name: newFirstName || undefined,
            last_name: newLastName || undefined,
            role: "collaborator",
          });
          userId = newUser.id;
        } else if (selectedUserId !== "") {
          userId = selectedUserId;
        }
      }

      // Step 2: build collaborators list. Primary user always counts as the
      // first collaborator (backend de-dupes server-side, but we keep the
      // payload tidy too).
      const collaboratorSet = new Set<number>();
      if (userId !== undefined) collaboratorSet.add(userId);
      for (const id of extraCollaboratorIds) collaboratorSet.add(id);

      // Step 3: create the deal. For collaborators creating their own deal,
      // leave both fields out — backend attaches request.user automatically.
      const payload: DealCreate = {
        name,
        stage,
        deal_amount: amount,
        payment_type: paymentType,
        date_start: dateStart,
        date_end: dateEnd,
      };
      if (userId !== undefined) {
        payload.user = userId;
      }
      if (collaboratorSet.size > 0) {
        payload.collaborators = Array.from(collaboratorSet);
      }
      if (responsibleIds.length > 0) {
        payload.responsibles = responsibleIds;
      }
      return deals.create(payload);
    },
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["users", "collaborator"] });
      toast.success("Проект создан.");
      setOpen(false);
      reset();
      router.push(`/projects/${deal.id}`);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  const canSubmit =
    !!name.trim() &&
    !!amount &&
    !!dateEnd &&
    (!showsClientControls ||
      clientMode === "existing" ||
      (clientMode === "new" &&
        !!newUsername &&
        !!newEmail &&
        !!newPassword));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent className="max-w-[540px]">
        <DialogHeader
          eyebrow="Работа · Новый"
          title="Новый проект"
          description={
            showsClientControls
              ? "Клиента можно выбрать, создать или оставить проект без клиента."
              : "Создайте проект — он будет привязан к вашему аккаунту."
          }
        />
        <form onSubmit={submit} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
          <Field label="Название проекта">
            <Input
              placeholder="CRM для «Алтын Маркет»"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </Field>

          {showsClientControls && (
            <section>
              <label className="block text-[12px] font-medium text-ink-2 mb-1.5">
                Клиент
              </label>
              <div className="inline-flex bg-surface-2 border border-hairline rounded-md p-0.5 mb-3">
                <ModeChip
                  active={clientMode === "existing"}
                  onClick={() => setClientMode("existing")}
                  label="Существующий"
                />
                <ModeChip
                  active={clientMode === "new"}
                  onClick={() => setClientMode("new")}
                  label="Новый аккаунт"
                />
              </div>

              {clientMode === "existing" ? (
                <div className="space-y-3">
                  <select
                    className="h-9 w-full bg-canvas border border-hairline-strong rounded-md px-3 text-[14px] text-ink hover:border-ink-5 focus:border-accent focus:shadow-[0_0_0_3px_rgba(35,131,226,0.18)] outline-none transition-all cursor-pointer"
                    value={selectedUserId === "" ? "" : String(selectedUserId)}
                    onChange={(e) => {
                      const next = e.target.value
                        ? Number(e.target.value)
                        : "";
                      setSelectedUserId(next);
                      // Drop the new primary from extras if it was there.
                      if (typeof next === "number") {
                        setExtraCollaboratorIds((prev) =>
                          prev.filter((id) => id !== next)
                        );
                      }
                    }}
                  >
                    <option value="">Без клиента</option>
                    {collaboratorList.map((u: User) => (
                      <option key={u.id} value={u.id}>
                        {clientDisplay(u)}
                      </option>
                    ))}
                  </select>

                  <CollaboratorMultiSelect
                    users={collaboratorList}
                    primaryId={
                      typeof selectedUserId === "number"
                        ? selectedUserId
                        : null
                    }
                    selectedIds={extraCollaboratorIds}
                    onChange={setExtraCollaboratorIds}
                    loading={collaboratorsQ.isLoading}
                  />
                </div>
              ) : (
                <div className="space-y-3 border border-hairline rounded-md p-3 bg-surface/40">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Имя">
                      <Input
                        placeholder="Иван"
                        value={newFirstName}
                        onChange={(e) => setNewFirstName(e.target.value)}
                      />
                    </Field>
                    <Field label="Фамилия">
                      <Input
                        placeholder="Иванов"
                        value={newLastName}
                        onChange={(e) => setNewLastName(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Email">
                    <Input
                      type="email"
                      placeholder="ops@northwind.io"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Логин">
                      <Input
                        placeholder="northwind"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        autoComplete="off"
                        required
                      />
                    </Field>
                    <Field label="Временный пароль">
                      <Input
                        type="text"
                        placeholder="Передайте клиенту"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                    </Field>
                  </div>
                  <p className="text-[11px] text-ink-3 leading-relaxed">
                    Аккаунт будет создан с ролью <code>collaborator</code>.
                    После создания клиент сможет войти и видеть только этот
                    проект.
                  </p>
                </div>
              )}
            </section>
          )}

          <section className="border-t border-hairline pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Сумма (₸)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </Field>
              <Field label="Способ оплаты">
                <select
                  className="h-9 w-full bg-canvas border border-hairline-strong rounded-md px-3 text-[14px] text-ink hover:border-ink-5 focus:border-accent focus:shadow-[0_0_0_3px_rgba(35,131,226,0.18)] outline-none transition-all cursor-pointer"
                  value={paymentType}
                  onChange={(e) =>
                    setPaymentType(e.target.value as DealPaymentType)
                  }
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
              <Field label="Срок (дедлайн)">
                <Input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field label="Статус проекта">
              <select
                className="h-9 w-full bg-canvas border border-hairline-strong rounded-md px-3 text-[14px] text-ink hover:border-ink-5 focus:border-accent focus:shadow-[0_0_0_3px_rgba(35,131,226,0.18)] outline-none transition-all cursor-pointer"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                <option value="active">В процессе</option>
                <option value="completed">Выполнено</option>
                <option value="cancelled">Отменено</option>
              </select>
            </Field>
            <ResponsibleMultiSelect
              users={responsibleList}
              selectedIds={responsibleIds}
              onChange={setResponsibleIds}
              loading={responsiblesQ.isLoading}
            />
          </section>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
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
              disabled={!canSubmit || create.isPending}
            >
              {create.isPending ? "Создаём…" : "Создать проект"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-3 text-[13px] rounded transition-colors",
        active
          ? "bg-canvas text-ink shadow-sm font-medium"
          : "text-ink-3 hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}

function clientDisplay(u: User): string {
  const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  if (name) return `${name} · ${u.email}`;
  return `${u.username} · ${u.email}`;
}

function userShortName(u: User): string {
  return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.username || u.email;
}

function ResponsibleMultiSelect({
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
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 h-7 pl-1 pr-1.5 rounded-full bg-tag-green-bg text-tag-green-fg text-[12px]"
            >
              <Avatar name={userShortName(u)} size={20} className="text-[10px]" />
              <span className="max-w-[160px] truncate">{userShortName(u)}</span>
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

function CollaboratorMultiSelect({
  users: list,
  primaryId,
  selectedIds,
  onChange,
  loading,
}: {
  users: User[];
  /** Excluded from picker — primary is implicit. */
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
                name={clientDisplay(u)}
                size={20}
                className="text-[10px] ring-1 ring-canvas"
              />
              <span className="max-w-[160px] truncate">
                {u.first_name || u.username}
              </span>
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
                        name={clientDisplay(u)}
                        size={20}
                        className="text-[10px]"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-ink truncate">
                          {`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
                            u.username}
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
