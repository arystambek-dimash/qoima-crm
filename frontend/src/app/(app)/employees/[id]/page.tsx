"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Topbar } from "@/components/app-shell/topbar";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input, Field } from "@/components/ui/input";
import { employees, users } from "@/lib/endpoints";
import { asApiError } from "@/lib/api";
import { formatCurrency, plural } from "@/lib/utils";
import {
  nestedUserOf,
  userDisplayName,
  userEmail,
  userIdOf,
} from "@/lib/user-helpers";
import {
  EMPLOYEE_PERMISSION_FIELDS,
  type EmployeePermissionField,
  type Employee,
} from "@/lib/types";
import { ArrowLeft, Save, ShieldCheck } from "lucide-react";

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

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const employeeId = Number(id);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => employees.retrieve(employeeId),
  });

  const [overrides, setOverrides] = useState<Partial<Employee>>({});
  const [telegramId, setTelegramId] = useState<string | null>(null);

  const draft = useMemo<Partial<Employee> | null>(() => {
    if (!q.data) return null;
    return { ...q.data, ...overrides };
  }, [q.data, overrides]);

  function setDraft(
    updater: (prev: Partial<Employee>) => Partial<Employee>
  ) {
    setOverrides((prev) => updater(prev));
  }

  const e = draft;
  const currentUser = nestedUserOf(e?.user);
  const telegramValue =
    telegramId ?? (currentUser?.telegram_id ? String(currentUser.telegram_id) : "");

  const update = useMutation({
    mutationFn: async (payload: Partial<Employee>) => {
      const updatedEmployee = await employees.update(employeeId, payload);
      const userId = userIdOf(payload.user);

      if (userId && telegramId !== null) {
        const updatedUser = await users.update(userId, {
          telegram_id: telegramId ? Number(telegramId) : null,
        });

        return { ...updatedEmployee, user: updatedUser };
      }

      return updatedEmployee;
    },
    onSuccess: (data) => {
      qc.setQueryData(["employee", employeeId], data);
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      setTelegramId(null);
      toast.success("Сохранено.");
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  if (!e && q.isLoading) return <Topbar eyebrow="Команда" title="Загрузка…" />;
  if (!e)
    return (
      <>
        <Topbar eyebrow="Команда" title="Не найдено" />
        <main className="p-12 max-w-[1080px] mx-auto">
          <Link
            href="/employees"
            className="text-ink-3 hover:text-accent inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </main>
      </>
    );

  const grantedCount = EMPLOYEE_PERMISSION_FIELDS.filter(
    (f) => e[f as EmployeePermissionField]
  ).length;

  return (
    <>
      <Topbar
        eyebrow="Команда"
        title={`Сотрудник #${employeeId}`}
        actions={
          <Button
            variant="primary"
            size="sm"
            disabled={update.isPending}
            onClick={() => update.mutate(e)}
          >
            <Save className="h-3.5 w-3.5" />
            {update.isPending ? "Сохраняем…" : "Сохранить"}
          </Button>
        }
      />
      <main className="flex-1 px-6 lg:px-10 py-10 max-w-[1080px] mx-auto w-full stagger">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-accent transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          К списку сотрудников
        </Link>

        {/* Header */}
        <header className="mb-8 flex items-center gap-5">
          <Avatar
            name={userDisplayName(e.user)}
            size={64}
            className="text-[20px]"
          />
          <div>
            <h1 className="font-display text-[28px] tracking-tight text-ink">
              {userDisplayName(e.user)}
            </h1>
            {userEmail(e.user) && (
              <p className="text-[13px] text-ink-3 mt-1">{userEmail(e.user)}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge tone="gray">{e.role || "—"}</Badge>
              <Badge tone="purple">
                <ShieldCheck className="h-2.5 w-2.5" />
                {grantedCount} {plural(grantedCount, "право", "права", "прав")}
              </Badge>
              <span className="text-[13px] text-ink-3">
                {formatCurrency(e.salary)} / мес.
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4">
          {/* Permissions */}
          <Panel>
            <PanelHeader>
              <PanelTitle>Права доступа</PanelTitle>
              <span className="text-[12px] text-ink-3">
                {grantedCount} из {EMPLOYEE_PERMISSION_FIELDS.length} выдано
              </span>
            </PanelHeader>
            <PanelBody className="space-y-6">
              {PERMISSION_GROUPS.map((g) => (
                <section key={g.title}>
                  <h4 className="text-[12px] font-medium text-ink-3 mb-2">
                    {g.title}
                  </h4>
                  <div className="border border-hairline rounded-md divide-y divide-[var(--color-hairline)]">
                    {g.fields.map(({ f, label }) => (
                      <label
                        key={f}
                        htmlFor={f}
                        className="flex items-center justify-between px-4 h-12 cursor-pointer hover:bg-surface transition-colors first:rounded-t-md last:rounded-b-md"
                      >
                        <div className="flex flex-col leading-tight">
                          <span className="text-[14px] text-ink">{label}</span>
                          <span className="text-[12px] text-ink-4 font-mono">
                            {f}
                          </span>
                        </div>
                        <Switch
                          id={f}
                          checked={Boolean(e[f])}
                          onCheckedChange={(v) =>
                            setDraft((prev) => ({ ...prev, [f]: v }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </PanelBody>
          </Panel>

          {/* Profile */}
          <Panel>
            <PanelHeader>
              <PanelTitle>Профиль</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-4">
              <Field label="Должность">
                <Input
                  value={e.role ?? ""}
                  onChange={(ev) =>
                    setDraft((prev) => ({ ...prev, role: ev.target.value }))
                  }
                  placeholder="например, Менеджер по продажам"
                />
              </Field>
              <Field label="Зарплата в месяц (₸)">
                <Input
                  type="number"
                  step="0.01"
                  value={e.salary ?? ""}
                  onChange={(ev) =>
                    setDraft((prev) => ({ ...prev, salary: ev.target.value }))
                  }
                />
              </Field>
              <Field
                label="Telegram ID"
                hint="User sends /whoami to the bot, then paste that Telegram ID here."
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={telegramValue}
                  onChange={(ev) => setTelegramId(ev.target.value)}
                  placeholder="123456789"
                />
              </Field>
              <div className="pt-3 border-t border-hairline text-[12px] text-ink-3 space-y-1">
                <div className="flex justify-between">
                  <span>ID сотрудника</span>
                  <span className="text-ink-2 tabular-nums">
                    {String(e.id).padStart(4, "0")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Аккаунт</span>
                  <span className="text-ink-2">#{userIdOf(e.user) ?? "—"}</span>
                </div>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </main>
    </>
  );
}
