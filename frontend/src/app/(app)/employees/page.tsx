"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/app-shell/topbar";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Table, THead, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PermissionDenied } from "@/components/permission-gate";
import { employees } from "@/lib/endpoints";
import { asApiError } from "@/lib/api";
import { useRole, useIsSuperuser, useHasPermission } from "@/lib/permissions";
import { userDisplayName, userEmail, userTelegramId } from "@/lib/user-helpers";
import { formatCurrency, cn, plural } from "@/lib/utils";
import {
  EMPLOYEE_PERMISSION_FIELDS,
  type Employee,
  type EmployeePermissionField,
} from "@/lib/types";
import {
  AlertTriangle,
  ChevronRight,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { InviteEmployeeDialog } from "./invite-employee-dialog";

const PERMISSION_LABELS: Record<EmployeePermissionField, string> = {
  tasks_can_create: "Задачи · создание",
  tasks_can_edit: "Задачи · редактирование",
  tasks_can_delete: "Задачи · удаление",
  deals_can_create: "Проекты · создание",
  deals_can_update: "Проекты · изменение",
  deals_can_delete: "Проекты · удаление",
  deals_can_view_amount: "Проекты · суммы",
  employees_can_create: "Сотрудники · добавление",
  employees_can_update: "Сотрудники · изменение",
  employees_can_delete: "Сотрудники · удаление",
  accounting_can_retrieve: "Бухгалтерия · просмотр",
  accounting_can_create: "Бухгалтерия · создание",
  accounting_can_update: "Бухгалтерия · изменение",
  accounting_can_delete: "Бухгалтерия · удаление",
  wallets_can_create: "Кошелёк · создание",
  wallets_can_update: "Кошелёк · изменение",
  wallets_can_delete: "Кошелёк · удаление",
  wallets_can_view_balance: "Кошелёк · баланс",
  sales_can_retrieve: "Отдел продаж · просмотр",
  sales_can_create: "Отдел продаж · создание",
  sales_can_update: "Отдел продаж · изменение",
  sales_can_delete: "Отдел продаж · удаление",
};

export default function EmployeesPage() {
  const role = useRole();
  const isSuper = useIsSuperuser();
  const canInvite = useHasPermission("employees_can_create");
  const allowed = isSuper || role === "employee";
  const showInvite = isSuper || canInvite.granted;
  const q = useQuery({
    queryKey: ["employees"],
    queryFn: employees.list,
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <>
        <Topbar eyebrow="Команда" title="Сотрудники" />
        <PermissionDenied
          title="Это внутренняя страница"
          detail="Список сотрудников доступен только команде Qoima."
        />
      </>
    );
  }

  return (
    <>
      <Topbar
        eyebrow="Команда"
        title="Сотрудники"
        actions={
          showInvite ? (
            <InviteEmployeeDialog
              trigger={
                <Button variant="primary" size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  Пригласить
                </Button>
              }
            />
          ) : undefined
        }
      />
      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-10 max-w-[1280px] mx-auto w-full">
        <header className="mb-8 anim-rise">
          <h1 className="font-display text-[28px] tracking-tight text-ink">
            Команда
          </h1>
          <p className="mt-2 text-[14px] text-ink-3">
            Все сотрудники с доступом к Qoima: роль, зарплата и права.
          </p>
        </header>

        <Header data={q.data ?? []} />

        {q.isLoading && (
          <Panel className="p-10 text-center text-[13px] text-ink-4 anim-fade">
            Загружаем список…
          </Panel>
        )}

        {q.isError && (
          <Panel className="p-6 anim-fade">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 grid place-items-center bg-tag-red-bg text-tag-red-fg rounded-md">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] text-ink font-medium">
                  Не удалось загрузить сотрудников
                </h3>
                <p className="text-[13px] text-ink-3 mt-1">
                  {asApiError(q.error).message}
                </p>
                <p className="text-[12px] font-mono text-ink-4 mt-3">
                  GET /api/employees/
                </p>
              </div>
            </div>
          </Panel>
        )}

        {q.data && q.data.length === 0 && (
          <Panel className="p-14 text-center anim-fade">
            <div className="mx-auto h-12 w-12 grid place-items-center bg-surface-2 rounded-lg mb-4">
              <Users className="h-5 w-5 text-ink-3" />
            </div>
            <h3 className="font-display text-[20px] text-ink">
              Сотрудников ещё нет
            </h3>
            <p className="text-[14px] text-ink-3 mt-1 mb-5">
              Пригласите коллегу — создайте профиль и выдайте права.
            </p>
            {showInvite && (
              <InviteEmployeeDialog
                trigger={
                  <Button variant="primary" size="md">
                    <Plus className="h-3.5 w-3.5" />
                    Пригласить
                  </Button>
                }
              />
            )}
          </Panel>
        )}

        {q.data && q.data.length > 0 && (
          <Panel className="anim-fade">
            <PanelHeader>
              <PanelTitle>Список</PanelTitle>
              <span className="text-[12px] text-ink-3">
                {q.data.length} {plural(q.data.length, "человек", "человека", "человек")}
              </span>
            </PanelHeader>
            <Table>
              <THead>
                <TR>
                  <TH>Имя</TH>
                  <TH className="hidden md:table-cell">Должность</TH>
                  <TH className="text-right">Зарплата</TH>
                  <TH className="hidden md:table-cell">Права</TH>
                  <TH className="w-10"></TH>
                </TR>
              </THead>
              <tbody>
                {q.data.map((e) => (
                  <EmployeeRow key={e.id} e={e} />
                ))}
              </tbody>
            </Table>
          </Panel>
        )}
      </main>
    </>
  );
}

function Header({ data }: { data: Employee[] }) {
  const totalSalary = data.reduce((a, e) => a + Number(e.salary), 0);
  const adminCount = data.filter(
    (e) => e.employees_can_create || e.employees_can_delete
  ).length;
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger">
      <Stat label="Численность" value={String(data.length)} />
      <Stat label="ФОТ в месяц" value={formatCurrency(totalSalary)} />
      <Stat label="Админов" value={String(adminCount)} />
      <Stat
        label="Средняя зарплата"
        value={formatCurrency(data.length ? totalSalary / data.length : 0)}
      />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas border border-hairline rounded-lg px-3 sm:px-4 py-3">
      <div className="text-[12px] text-ink-3 mb-1">{label}</div>
      <div className="font-display text-[18px] sm:text-[22px] tabular-nums text-ink break-words">
        {value}
      </div>
    </div>
  );
}

function EmployeeRow({ e }: { e: Employee }) {
  const isAdmin = e.employees_can_create || e.employees_can_delete;
  const name = userDisplayName(e.user);
  const email = userEmail(e.user);
  const telegramId = userTelegramId(e.user);

  return (
    <TR>
      <TD>
        <Link
          href={`/employees/${e.id}` as never}
          className="flex items-center gap-3 group"
        >
          <Avatar name={name} size={32} />
          <div className="flex flex-col leading-tight">
            <span className="text-ink font-medium group-hover:text-accent transition-colors">
              {name}
            </span>
            <span className="text-[12px] text-ink-3">
              {email || `ID ${String(e.id).padStart(4, "0")}`}
            </span>
            {telegramId && (
              <span className="text-[11px] text-ink-4 tabular-nums">
                TG {telegramId}
              </span>
            )}
          </div>
        </Link>
      </TD>
      <TD className="hidden md:table-cell">
        <div className="flex items-center gap-2">
          <span className="text-ink-2">{e.role || "—"}</span>
          {isAdmin && (
            <Badge tone="purple">
              <ShieldCheck className="h-2.5 w-2.5" />
              админ
            </Badge>
          )}
        </div>
      </TD>
      <TD className="text-right font-medium tabular-nums">
        {formatCurrency(e.salary)}
      </TD>
      <TD className="hidden md:table-cell">
        <PermissionBars employee={e} />
      </TD>
      <TD>
        <Link
          href={`/employees/${e.id}` as never}
          className="inline-flex items-center justify-center h-6 w-6 rounded text-ink-4 hover:text-ink hover:bg-surface-2 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </TD>
    </TR>
  );
}

function PermissionBars({ employee }: { employee: Employee }) {
  const total = EMPLOYEE_PERMISSION_FIELDS.length;
  const granted = EMPLOYEE_PERMISSION_FIELDS.filter((f) => employee[f]).length;
  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex items-center gap-0.5">
        {EMPLOYEE_PERMISSION_FIELDS.map((f) => (
          <div
            key={f}
            title={PERMISSION_LABELS[f]}
            className={cn(
              "h-3.5 w-1.5 rounded-sm",
              employee[f] ? "bg-accent" : "bg-surface-3"
            )}
          />
        ))}
      </div>
      <span className="text-[12px] text-ink-3 tabular-nums">
        {granted}/{total}
      </span>
    </div>
  );
}
