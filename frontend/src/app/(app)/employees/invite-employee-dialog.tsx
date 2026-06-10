"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { employees, users } from "@/lib/endpoints";
import { asApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  EMPLOYEE_PERMISSION_FIELDS,
  type EmployeePermissionField,
  type EmployeePermissions,
} from "@/lib/types";
import { ShieldCheck } from "lucide-react";

/* ---- Permission groups for the inline matrix ---- */

const PERMISSION_GROUPS: {
  title: string;
  fields: { f: EmployeePermissionField; label: string }[];
}[] = [
  {
    title: "Заказы",
    fields: [
      { f: "deals_can_create", label: "Создавать заказы" },
      { f: "deals_can_update", label: "Изменять заказы" },
      { f: "deals_can_delete", label: "Удалять заказы" },
    ],
  },
  {
    title: "Задачи",
    fields: [
      { f: "tasks_can_create", label: "Создавать задачи" },
      { f: "tasks_can_edit", label: "Редактировать задачи" },
      { f: "tasks_can_delete", label: "Удалять задачи" },
    ],
  },
  {
    title: "Сотрудники",
    fields: [
      { f: "employees_can_create", label: "Добавлять сотрудников" },
      { f: "employees_can_update", label: "Изменять сотрудников" },
      { f: "employees_can_delete", label: "Удалять сотрудников" },
    ],
  },
  {
    title: "Бухгалтерия",
    fields: [
      { f: "accounting_can_retrieve", label: "Видеть доходы и расходы" },
      { f: "accounting_can_create", label: "Создавать записи" },
      { f: "accounting_can_update", label: "Изменять записи" },
      { f: "accounting_can_delete", label: "Удалять записи" },
    ],
  },
  {
    title: "Кошелёк компании",
    fields: [
      { f: "wallets_can_create", label: "Создавать кошельки" },
      { f: "wallets_can_update", label: "Изменять кошельки" },
      { f: "wallets_can_delete", label: "Удалять кошельки" },
    ],
  },
];

/* ---- Sensible role presets so the admin doesn't tick 10 switches ---- */

const ROLE_PRESETS: Record<
  string,
  { label: string; permissions: Partial<EmployeePermissions> }
> = {
  member: {
    label: "Сотрудник",
    permissions: { tasks_can_edit: true },
  },
  manager: {
    label: "Менеджер",
    permissions: {
      tasks_can_create: true,
      tasks_can_edit: true,
      deals_can_create: true,
      deals_can_update: true,
    },
  },
  accountant: {
    label: "Бухгалтер",
    permissions: {
      accounting_can_retrieve: true,
      accounting_can_create: true,
      accounting_can_update: true,
      accounting_can_delete: true,
      wallets_can_create: true,
      wallets_can_update: true,
    },
  },
  finance_viewer: {
    label: "Аналитик",
    permissions: { accounting_can_retrieve: true },
  },
  cashier: {
    label: "Кассир",
    permissions: {
      accounting_can_retrieve: true,
      accounting_can_create: true,
      wallets_can_create: true,
      wallets_can_update: true,
      wallets_can_delete: true,
    },
  },
  admin: {
    label: "Администратор",
    permissions: Object.fromEntries(
      EMPLOYEE_PERMISSION_FIELDS.map((f) => [f, true])
    ) as EmployeePermissions,
  },
};

function emptyPermissions(): EmployeePermissions {
  return Object.fromEntries(
    EMPLOYEE_PERMISSION_FIELDS.map((f) => [f, false])
  ) as EmployeePermissions;
}

export function InviteEmployeeDialog({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();

  // User fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [password, setPassword] = useState("");
  // Employee fields
  const [jobTitle, setJobTitle] = useState("");
  const [salary, setSalary] = useState("");
  const [preset, setPreset] = useState<string>("member");
  const [perms, setPerms] = useState<EmployeePermissions>(() => ({
    ...emptyPermissions(),
    ...ROLE_PRESETS.member.permissions,
  }));

  function applyPreset(key: string) {
    setPreset(key);
    setPerms({ ...emptyPermissions(), ...ROLE_PRESETS[key].permissions });
  }

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setUsername("");
    setTelegramId("");
    setPassword("");
    setJobTitle("");
    setSalary("");
    setPreset("member");
    setPerms({ ...emptyPermissions(), ...ROLE_PRESETS.member.permissions });
  }

  const invite = useMutation({
    mutationFn: async () => {
      // Step 1: create the user with role=employee
      const user = await users.create({
        username,
        email,
        password,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        role: "employee",
        telegram_id: telegramId ? Number(telegramId) : undefined,
      });
      // Step 2: create the Employee row with role title, salary, permissions
      const employee = await employees.create({
        user: user.id,
        role: jobTitle,
        salary,
        ...perms,
      });
      return employee;
    },
    onSuccess: (employee) => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Сотрудник приглашён.");
      setOpen(false);
      reset();
      router.push(`/employees/${employee.id}`);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  const grantedCount = EMPLOYEE_PERMISSION_FIELDS.filter((f) => perms[f]).length;
  const canSubmit =
    !!username && !!email && !!password && !!jobTitle && !!salary;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent className="max-w-[640px] p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-hairline">
          <DialogHeader
            eyebrow="Команда · Приглашение"
            title="Пригласить сотрудника"
            description="Создайте аккаунт коллеге и выдайте права. Передайте ему логин и временный пароль."
          />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate();
          }}
          className="flex flex-col gap-5 px-6 py-5 max-h-[70vh] overflow-y-auto scrollbar-thin"
        >
          {/* --- Person --- */}
          <section className="space-y-3">
            <h4 className="text-[12px] font-medium text-ink-3">Человек</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя">
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Айдар"
                  autoFocus
                />
              </Field>
              <Field label="Фамилия">
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Касымов"
                />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aidar@company.kz"
                required
              />
            </Field>
            <Field
              label="Telegram ID"
              hint="Optional. The employee can send /whoami to the bot to get this ID."
            >
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="123456789"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Логин">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="aidar"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="Временный пароль">
                <Input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Передайте сотруднику"
                  autoComplete="new-password"
                  required
                />
              </Field>
            </div>
          </section>

          {/* --- Job --- */}
          <section className="space-y-3 pt-4 border-t border-hairline">
            <h4 className="text-[12px] font-medium text-ink-3">Должность</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Должность / роль">
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Менеджер по продажам"
                  required
                />
              </Field>
              <Field label="Зарплата в месяц (₸)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="0"
                  required
                />
              </Field>
            </div>
          </section>

          {/* --- Permissions --- */}
          <section className="space-y-3 pt-4 border-t border-hairline">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-medium text-ink-3">Права</h4>
              <Badge tone="purple">
                <ShieldCheck className="h-2.5 w-2.5" />
                {grantedCount} из {EMPLOYEE_PERMISSION_FIELDS.length} выдано
              </Badge>
            </div>

            {/* Role preset chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.entries(ROLE_PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className={cn(
                    "inline-flex items-center h-7 px-2.5 rounded-full text-[12px] border transition-colors",
                    preset === key
                      ? "bg-accent-soft border-accent/40 text-accent-ink font-medium"
                      : "bg-canvas border-hairline-strong text-ink-2 hover:border-ink-5 hover:bg-surface-2"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Permission groups */}
            <div className="space-y-3">
              {PERMISSION_GROUPS.map((g) => (
                <div key={g.title}>
                  <h5 className="text-[11px] font-medium text-ink-3 mb-1.5">
                    {g.title}
                  </h5>
                  <div className="border border-hairline rounded-md divide-y divide-[var(--color-hairline)]">
                    {g.fields.map(({ f, label }) => (
                      <label
                        key={f}
                        htmlFor={`new-${f}`}
                        className="flex items-center justify-between px-3 h-10 cursor-pointer hover:bg-surface transition-colors first:rounded-t-md last:rounded-b-md"
                      >
                        <span className="text-[13px] text-ink-2">{label}</span>
                        <Switch
                          id={`new-${f}`}
                          checked={Boolean(perms[f])}
                          onCheckedChange={(v) => {
                            setPreset("");
                            setPerms((prev) => ({ ...prev, [f]: Boolean(v) }));
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </form>

        <div className="px-6 py-3 border-t border-hairline flex items-center justify-end gap-2 bg-surface/40">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => setOpen(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={!canSubmit || invite.isPending}
            onClick={() => invite.mutate()}
          >
            {invite.isPending ? "Создаём…" : "Пригласить"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
