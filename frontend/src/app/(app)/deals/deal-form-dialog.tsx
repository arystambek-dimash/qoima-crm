"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
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

  // Deal fields
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

  // New client fields
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");

  const collaboratorsQ = useQuery({
    queryKey: ["users", "collaborator"],
    queryFn: () => users.list("collaborator"),
    enabled: open && showsClientControls && clientMode === "existing",
  });

  function reset() {
    setStage("active");
    setAmount("");
    setPaymentType("card");
    setDateStart(new Date().toISOString().slice(0, 10));
    setDateEnd("");
    setClientMode("existing");
    setSelectedUserId("");
    setNewUsername("");
    setNewEmail("");
    setNewPassword("");
    setNewFirstName("");
    setNewLastName("");
  }

  const create = useMutation({
    mutationFn: async () => {
      // Step 1: resolve userId (create new client if needed).
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

      // Step 2: create the deal. For collaborators, leave `user` out — backend
      // attaches request.user automatically.
      const payload: DealCreate & { user?: number } = {
        stage,
        deal_amount: amount,
        payment_type: paymentType,
        date_start: dateStart,
        date_end: dateEnd,
      };
      if (userId !== undefined) {
        payload.user = userId;
      }
      return deals.create(payload as DealCreate);
    },
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["users", "collaborator"] });
      toast.success("Заказ создан.");
      setOpen(false);
      reset();
      router.push(`/deals/${deal.id}`);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  const canSubmit =
    !!amount &&
    !!dateEnd &&
    (!showsClientControls ||
      (clientMode === "existing" && selectedUserId !== "") ||
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
          title="Новый заказ"
          description={
            showsClientControls
              ? "Выберите клиента или создайте новый аккаунт. Заказ будет привязан к клиенту."
              : "Создайте договор/заказ — заказ будет привязан к вашему аккаунту."
          }
        />
        <form onSubmit={submit} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
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
                <select
                  className="h-9 w-full bg-canvas border border-hairline-strong rounded-md px-3 text-[14px] text-ink hover:border-ink-5 focus:border-accent focus:shadow-[0_0_0_3px_rgba(35,131,226,0.18)] outline-none transition-all cursor-pointer"
                  value={selectedUserId === "" ? "" : String(selectedUserId)}
                  onChange={(e) =>
                    setSelectedUserId(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  required
                >
                  <option value="">— выберите клиента —</option>
                  {(collaboratorsQ.data ?? []).map((u: User) => (
                    <option key={u.id} value={u.id}>
                      {clientDisplay(u)}
                    </option>
                  ))}
                </select>
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
                    заказ.
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
            <Field label="Стадия">
              <select
                className="h-9 w-full bg-canvas border border-hairline-strong rounded-md px-3 text-[14px] text-ink hover:border-ink-5 focus:border-accent focus:shadow-[0_0_0_3px_rgba(35,131,226,0.18)] outline-none transition-all cursor-pointer"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                <option value="active">Активный</option>
                <option value="completed">Выполнен</option>
                <option value="cancelled">Отменён</option>
              </select>
            </Field>
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
              {create.isPending ? "Создаём…" : "Создать заказ"}
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
