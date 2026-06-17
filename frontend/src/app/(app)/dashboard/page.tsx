"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar, PrimaryAction } from "@/components/app-shell/topbar";
import {
  Panel,
  PanelHeader,
  PanelTitle,
  PanelBody,
  StatCard,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TR, TH, TD } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/permission-gate";
import { useNow } from "@/lib/use-now";
import { useChartColors } from "@/lib/use-chart-colors";
import {
  useCurrentUser,
  useRole,
  useHasPermission,
  useIsSuperuser,
} from "@/lib/permissions";
import { dashboard, deals, onboards } from "@/lib/endpoints";
import { formatCurrency, formatDate, cn, pluralProjects } from "@/lib/utils";
import { projectName, stageLabel } from "@/lib/deal-labels";
import {
  APPROVAL_LABEL,
  APPROVAL_TONE,
  resolveApprovalStatus,
} from "@/lib/task-helpers";
import { typeMetaForIncome } from "@/lib/income-type-meta";
import { typeMetaForSpending } from "@/lib/spending-type-meta";
import {
  ArrowUpRight,
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  ListChecks,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DashboardFilters,
  DashboardPeriod,
  DashboardGroupBy,
} from "@/lib/types";

const MASKED_AMOUNT = "******";

function canViewDealAmount(deal: { can_view_amount?: boolean }) {
  return deal.can_view_amount !== false;
}

function numericAmount(value: number | string | null | undefined) {
  if (value == null || value === "") return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function formatDealAmount(
  deal: { can_view_amount?: boolean },
  value: number | string | null | undefined
) {
  return canViewDealAmount(deal) ? formatCurrency(value) : MASKED_AMOUNT;
}

export default function DashboardPage() {
  const role = useRole();
  const user = useCurrentUser();
  const isSuper = useIsSuperuser();
  const canSeeAccounting = useHasPermission("accounting_can_retrieve");
  const canCreateDeal = useHasPermission("deals_can_create");
  const c = useChartColors();
  const now = useNow();

  if (role === "collaborator" && !isSuper) {
    return (
      <CollaboratorDashboard
        userId={user?.id ?? 0}
        userName={
          user
            ? `${user.first_name} ${user.last_name}`.trim() || user.username
            : ""
        }
      />
    );
  }

  return (
    <EmployeeDashboard
      c={c}
      now={now}
      canSeeAccounting={isSuper || canSeeAccounting.granted}
      canCreateDeal={isSuper || canCreateDeal.granted}
    />
  );
}

/* ----------- Collaborator dashboard -----------
 *
 * Composed entirely from the shared collaborator-scoped endpoints. We do NOT
 * call /api/dashboard/analytics/ for collaborators — that endpoint requires
 * accounting permissions. Backend scopes /deals/, /onboards/ and
 * /onboards/tasks/ to the requesting user automatically.
 */

function CollaboratorDashboard({
  userId,
  userName,
}: {
  userId: number;
  userName: string;
}) {
  const now = useNow();
  const myDealsQ = useQuery({
    queryKey: ["deals", "mine", userId],
    queryFn: () => deals.listForUser(userId),
    enabled: !!userId,
  });
  const myOnboardsQ = useQuery({
    queryKey: ["onboards", "mine", userId],
    queryFn: onboards.list,
    enabled: !!userId,
  });
  const myTasksQ = useQuery({
    queryKey: ["onboards", "tasks", "mine", userId],
    queryFn: onboards.tasksList,
    enabled: !!userId,
  });

  const myDeals = useMemo(() => myDealsQ.data ?? [], [myDealsQ.data]);
  const myOnboards = useMemo(
    () => myOnboardsQ.data ?? [],
    [myOnboardsQ.data]
  );
  const myTasks = useMemo(() => myTasksQ.data ?? [], [myTasksQ.data]);

  const active = myDeals.filter((d) => d.stage === "active");
  const canViewAmounts = myDeals.every(canViewDealAmount);
  const totalValue = myDeals.reduce((a, d) => a + numericAmount(d.deal_amount), 0);
  const paid = myDeals.reduce((a, d) => a + numericAmount(d.paid_to_date), 0);
  const remaining = myDeals.reduce((a, d) => a + numericAmount(d.remaining), 0);

  const approvalBuckets = useMemo(() => {
    const out = {
      pending: [] as typeof myTasks,
      approved: [] as typeof myTasks,
      rejected: [] as typeof myTasks,
      cancelled: [] as typeof myTasks,
    };
    for (const t of myTasks) {
      const a = resolveApprovalStatus(t);
      if (a && a in out) out[a].push(t);
    }
    return out;
  }, [myTasks]);

  const upcomingDeadlines = useMemo(() => {
    if (now === 0) return [];
    const horizon = now + 1000 * 60 * 60 * 24 * 14;
    return myTasks
      .filter((t) => t.is_active && resolveApprovalStatus(t) !== "cancelled")
      .map((t) => ({ t, end: new Date(t.date_end).getTime() }))
      .filter(({ end }) => !Number.isNaN(end) && end <= horizon)
      .sort((a, b) => a.end - b.end)
      .slice(0, 6);
  }, [myTasks, now]);

  const ordersHint = active.length
    ? canViewAmounts
      ? `У вас ${active.length} ${pluralProjects(active.length)} в работе на сумму ${formatCurrency(totalValue)}.`
      : `У вас ${active.length} ${pluralProjects(active.length)} в работе.`
    : "Активных проектов сейчас нет.";

  return (
    <>
      <Topbar eyebrow="Главная" title="Главная" />
      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-10 max-w-[1080px] mx-auto w-full">
        <header className="mb-8 stagger">
          <h1 className="font-display text-[22px] sm:text-[28px] tracking-tight text-ink text-balance">
            Привет, {userName.split(" ")[0] || "коллега"}.{" "}
            <span className="font-normal text-ink-3">
              Вот ваши проекты и задачи.
            </span>
          </h1>
          <p className="mt-3 text-[14px] text-ink-3 max-w-[60ch]">
            {ordersHint} Откройте любой проект, чтобы увидеть план задач — или
            предложите новую задачу, она уйдёт на одобрение.
          </p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8 stagger">
          <StatCard
            label="Проекты в работе"
            value={String(active.length)}
            caption={`${myDeals.length} всего`}
          />
          <StatCard
            accent
            label="Оплачено"
            value={canViewAmounts ? formatCurrency(paid) : MASKED_AMOUNT}
            caption="по всем проектам"
          />
          <StatCard
            label="Остаток"
            value={canViewAmounts ? formatCurrency(remaining) : MASKED_AMOUNT}
            caption="к оплате"
          />
          <StatCard
            label="Ожидают одобрения"
            value={String(approvalBuckets.pending.length)}
            caption={`${myTasks.length} задач всего`}
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mb-6">
          <Panel>
            <PanelHeader>
              <PanelTitle>Ваши проекты</PanelTitle>
              <Link
                href="/projects"
                className="text-[13px] text-ink-3 hover:text-accent transition-colors inline-flex items-center gap-1"
              >
                Все проекты
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </PanelHeader>
            {myDeals.length === 0 ? (
              <PanelBody className="text-center text-[14px] text-ink-3 py-10">
                Проектов пока нет. Они появятся здесь, как только мы подпишем
                договор.
              </PanelBody>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Проект</TH>
                    <TH>Статус</TH>
                    <TH className="text-right">Сумма</TH>
                    <TH className="text-right hidden sm:table-cell">Оплачено</TH>
                    <TH className="hidden sm:table-cell">Срок</TH>
                  </TR>
                </THead>
                <tbody>
                  {myDeals.map((d) => (
                    <TR key={d.id} className="cursor-pointer">
                      <TD>
                        <Link
                          href={`/projects/${d.id}` as never}
                          className="text-ink hover:text-accent transition-colors font-medium"
                        >
                          {projectName(d)}
                        </Link>
                      </TD>
                      <TD>
                        <StatusBadge stage={d.stage} />
                      </TD>
                      <TD className="text-right font-medium tabular-nums">
                        {formatDealAmount(d, d.deal_amount)}
                      </TD>
                      <TD className="text-right text-ink-3 tabular-nums hidden sm:table-cell">
                        {formatDealAmount(d, d.paid_to_date)}
                      </TD>
                      <TD className="text-ink-3 tabular-nums hidden sm:table-cell">
                        {formatDate(d.date_end)}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Согласование задач</PanelTitle>
              <span className="text-[12px] text-ink-3">
                всего {myTasks.length}
              </span>
            </PanelHeader>
            <PanelBody className="space-y-2.5">
              <ApprovalTile
                icon={Clock}
                tone="warn"
                label={APPROVAL_LABEL.pending}
                count={approvalBuckets.pending.length}
              />
              <ApprovalTile
                icon={ClipboardCheck}
                tone="success"
                label={APPROVAL_LABEL.approved}
                count={approvalBuckets.approved.length}
              />
              <ApprovalTile
                icon={XCircle}
                tone="danger"
                label={APPROVAL_LABEL.rejected}
                count={approvalBuckets.rejected.length}
              />
              <ApprovalTile
                icon={X}
                tone="neutral"
                label={APPROVAL_LABEL.cancelled}
                count={approvalBuckets.cancelled.length}
              />
            </PanelBody>
          </Panel>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>Ожидают одобрения</PanelTitle>
              <span className="text-[12px] text-ink-3">
                {approvalBuckets.pending.length}
              </span>
            </PanelHeader>
            <PanelBody>
              {approvalBuckets.pending.length === 0 ? (
                <p className="text-[13px] text-ink-3 text-center py-8">
                  Все ваши задачи рассмотрены.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {approvalBuckets.pending.slice(0, 8).map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 px-2 h-9 rounded-md hover:bg-surface-2 transition-colors"
                    >
                      <span className="text-[13px] text-ink truncate">
                        {t.name}
                      </span>
                      <Badge tone={APPROVAL_TONE.pending} dot>
                        ожидает
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Ближайшие сроки</PanelTitle>
              <span className="text-[12px] text-ink-3">
                {upcomingDeadlines.length}
              </span>
            </PanelHeader>
            <PanelBody>
              {upcomingDeadlines.length === 0 ? (
                <p className="text-[13px] text-ink-3 text-center py-8">
                  На ближайшие 2 недели сроков нет.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {upcomingDeadlines.map(({ t, end }) => {
                    const overdue = now > 0 && end < now;
                    return (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-3 px-2 h-9 rounded-md hover:bg-surface-2 transition-colors"
                      >
                        <span className="text-[13px] text-ink truncate">
                          {t.name}
                        </span>
                        <span
                          className={cn(
                            "text-[12px] tabular-nums inline-flex items-center gap-1",
                            overdue ? "text-danger font-medium" : "text-ink-3"
                          )}
                        >
                          {overdue && <AlertTriangle className="h-3 w-3" />}
                          {formatDate(t.date_end, {
                            month: "short",
                            day: "2-digit",
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </section>

        {myOnboards.length > 0 && (
          <Panel className="mt-6">
            <PanelHeader>
              <PanelTitle>Программы</PanelTitle>
              <span className="text-[12px] text-ink-3">
                {myOnboards.length} {plural(myOnboards.length, "программа", "программы", "программ")}
              </span>
            </PanelHeader>
            <PanelBody>
              <ul className="space-y-1.5">
                {myOnboards.slice(0, 5).map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-3 px-2 h-9 rounded-md hover:bg-surface-2 transition-colors"
                  >
                    <Link
                      href={`/onboards/${o.id}` as never}
                      className="text-[13px] text-ink hover:text-accent transition-colors truncate"
                    >
                      {o.name || o.client_name || `Онбординг #${o.id}`}
                    </Link>
                    <span className="text-[12px] text-ink-3 tabular-nums">
                      до {formatDate(o.term_of_end)}
                    </span>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>
        )}
      </main>
    </>
  );
}

function ApprovalTile({
  icon: Icon,
  label,
  count,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  tone: "warn" | "success" | "danger" | "neutral";
}) {
  const toneCls: Record<string, string> = {
    warn: "bg-tag-yellow-bg/60 text-tag-yellow-fg",
    success: "bg-tag-green-bg/60 text-tag-green-fg",
    danger: "bg-tag-red-bg/50 text-tag-red-fg",
    neutral: "bg-surface-2 text-ink-3",
  };
  return (
    <div className="flex items-center gap-3 px-3 h-11 rounded-md border border-hairline bg-canvas">
      <span
        className={cn(
          "h-7 w-7 rounded-md grid place-items-center shrink-0",
          toneCls[tone]
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-[13px] text-ink-2">{label}</span>
      <span className="font-display text-[16px] tabular-nums text-ink">
        {count}
      </span>
    </div>
  );
}

/* ----------- Employee dashboard (uses /api/dashboard/analytics/) ----------- */

const PERIOD_OPTIONS: { key: DashboardPeriod; label: string }[] = [
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "year", label: "Год" },
  { key: "all", label: "Всё" },
];

const GROUP_OPTIONS: { key: DashboardGroupBy; label: string }[] = [
  { key: "day", label: "По дням" },
  { key: "week", label: "По неделям" },
  { key: "month", label: "По месяцам" },
  { key: "year", label: "По годам" },
];

function EmployeeDashboard({
  c,
  now,
  canSeeAccounting,
  canCreateDeal,
}: {
  c: ReturnType<typeof useChartColors>;
  now: number;
  canSeeAccounting: boolean;
  canCreateDeal: boolean;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [groupBy, setGroupBy] = useState<DashboardGroupBy>("day");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filters: DashboardFilters = useMemo(() => {
    const f: DashboardFilters = { period, group_by: groupBy };
    if (fromDate) f.from_date = fromDate;
    if (toDate) f.to_date = toDate;
    return f;
  }, [period, groupBy, fromDate, toDate]);

  const analyticsQ = useQuery({
    queryKey: ["dashboard-analytics", filters],
    queryFn: () => dashboard.analytics(filters),
    enabled: canSeeAccounting,
  });

  // Без accounting-доступа показываем простую заглушку и кнопку — мы не
  // блокируем страницу полностью, потому что обычный сотрудник тоже
  // может зайти на дашборд (просто без чисел).
  if (!canSeeAccounting) {
    return (
      <>
        <Topbar eyebrow="Рабочее пространство" title="Главная" />
        <PermissionDenied
          title="Аналитика недоступна"
          detail="Запросите у администратора право «accounting_can_retrieve», чтобы видеть финансовые показатели и графики."
        />
      </>
    );
  }

  const data = analyticsQ.data;
  const finance = data?.finance;
  const tasks = data?.tasks;

  return (
    <>
      <Topbar
        eyebrow="Рабочее пространство"
        title="Главная"
        actions={
          canCreateDeal ? (
            <Link href="/projects">
              <PrimaryAction label="Новый проект" />
            </Link>
          ) : undefined
        }
      />
      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-10 max-w-[1280px] mx-auto w-full">
        <header className="mb-8 stagger">
          <p className="text-[13px] text-ink-3 mb-2">
            {new Intl.DateTimeFormat("ru-RU", {
              weekday: "long",
              month: "long",
              day: "numeric",
            }).format(now ? new Date(now) : new Date())}
          </p>
          <h1 className="font-display text-[24px] sm:text-[28px] md:text-[32px] tracking-tight text-ink text-balance">
            Добро пожаловать.{" "}
            <span className="font-normal text-ink-3">
              Сводка по доходам, расходам и задачам.
            </span>
          </h1>
        </header>

        {/* Period & group controls */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-[12px] text-ink-3">Период:</span>
              {PERIOD_OPTIONS.map((p) => (
                <Chip
                  key={p.key}
                  active={period === p.key && !fromDate && !toDate}
                  onClick={() => {
                    setPeriod(p.key);
                    setFromDate("");
                    setToDate("");
                  }}
                  label={p.label}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-[12px] text-ink-3 md:ml-2">Группировка:</span>
              {GROUP_OPTIONS.map((g) => (
                <Chip
                  key={g.key}
                  active={groupBy === g.key}
                  onClick={() => setGroupBy(g.key)}
                  label={g.label}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[11px] text-ink-3 block mb-1">С даты</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-full sm:w-[140px] text-[12px]"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-[11px] text-ink-3 block mb-1">По дату</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-full sm:w-[140px] text-[12px]"
              />
            </div>
            {(fromDate || toDate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
              >
                <X className="h-3.5 w-3.5" />
                Сбросить
              </Button>
            )}
          </div>
        </section>

        {analyticsQ.isError && (
          <Panel className="p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 grid place-items-center bg-tag-red-bg text-tag-red-fg rounded-md">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] text-ink font-medium">
                  Не удалось загрузить аналитику
                </h3>
                <p className="text-[12px] font-mono text-ink-4 mt-1">
                  GET /api/dashboard/analytics/
                </p>
              </div>
            </div>
          </Panel>
        )}

        {analyticsQ.isLoading && (
          <Panel className="p-12 text-center text-[13px] text-ink-3">
            Загружаем аналитику…
          </Panel>
        )}

        {data && finance && tasks && (
          <>
            {/* KPI cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-8 stagger">
              {finance.wallet && (
                <StatCard
                  accent
                  label={`Кошелёк · ${finance.wallet.name}`}
                  value={
                    finance.wallet.can_view_balance
                      ? formatCurrency(finance.wallet.balance)
                      : MASKED_AMOUNT
                  }
                  caption="Текущий остаток компании"
                />
              )}
              <StatCard
                label="Чистая прибыль"
                value={formatCurrency(finance.summary.net_total)}
                caption={
                  Number(finance.summary.net_total) >= 0
                    ? "Доходы превышают расходы"
                    : "Расходы превышают доходы"
                }
              />
              <StatCard
                label="Доходы"
                value={formatCurrency(finance.summary.income_total)}
                caption={`${finance.summary.income_count} ${plural(
                  finance.summary.income_count,
                  "поступление",
                  "поступления",
                  "поступлений"
                )}`}
              />
              <StatCard
                label="Расходы"
                value={formatCurrency(finance.summary.spending_total)}
                caption={`${finance.summary.spending_count} ${plural(
                  finance.summary.spending_count,
                  "запись",
                  "записи",
                  "записей"
                )}`}
              />
              <StatCard
                label="Задачи"
                value={String(tasks.summary.total)}
                delta={
                  tasks.summary.overdue > 0
                    ? { value: `${tasks.summary.overdue} просрочено`, positive: false }
                    : undefined
                }
                caption={`${tasks.summary.active} в работе · ${tasks.summary.inactive} закрыто`}
              />
            </section>

            {/* Finance combo chart */}
            <Panel className="mb-6">
              <PanelHeader>
                <PanelTitle eyebrow={periodLabel(data.meta)}>
                  Доходы и расходы
                </PanelTitle>
                <span className="text-[12px] text-ink-3">
                  За всё время:{" "}
                  <span className="text-ink-2">
                    {formatCurrency(finance.all_time.net_total)}
                  </span>
                </span>
              </PanelHeader>
              <PanelBody>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={finance.series.map((p) => ({
                        date: p.date,
                        income: Number(p.income_total),
                        spending: Number(p.spending_total),
                        net: Number(p.net_total),
                      }))}
                      margin={{ top: 10, right: 4, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="incFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3D9C47" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#3D9C47" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="spFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#D8473A" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="#D8473A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={c.hairline} vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke={c.ink4}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) =>
                          formatBucket(String(v), data.meta.group_by)
                        }
                      />
                      <YAxis
                        stroke={c.ink4}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: c.canvas,
                          border: `1px solid ${c.hairlineStrong}`,
                          borderRadius: 8,
                          fontSize: 12,
                          color: c.ink,
                        }}
                        labelFormatter={(v) =>
                          formatBucket(String(v), data.meta.group_by, true)
                        }
                        formatter={(v: number | string, key) => [
                          formatCurrency(Number(v)),
                          key === "income"
                            ? "Доходы"
                            : key === "spending"
                            ? "Расходы"
                            : "Чистая прибыль",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="income"
                        stroke="#3D9C47"
                        strokeWidth={2}
                        fill="url(#incFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="spending"
                        stroke="#D8473A"
                        strokeWidth={2}
                        fill="url(#spFill)"
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        stroke={c.accent}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-center gap-5 text-[12px] text-ink-3">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-success" /> Доходы
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-danger" /> Расходы
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-0.5 w-3 rounded-sm"
                      style={{ background: c.accent }}
                    />{" "}
                    Чистая прибыль
                  </span>
                </div>
              </PanelBody>
            </Panel>

            {/* By type donuts */}
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
              <ByTypeDonut
                title="По типам доходов"
                rows={finance.by_type.incomes}
                resolver={(t) => typeMetaForIncome(t)}
                total={Number(finance.summary.income_total)}
                c={c}
              />
              <ByTypeDonut
                title="По типам расходов"
                rows={finance.by_type.spendings}
                resolver={(t) => typeMetaForSpending(t)}
                total={Number(finance.summary.spending_total)}
                c={c}
              />
            </section>

            {/* Tasks block — always visible, with friendly empty state */}
            <TasksPanel tasks={tasks} c={c} />
          </>
        )}
      </main>
    </>
  );
}

/* ----------- Tasks panel ----------- */

function TasksPanel({
  tasks,
  c,
}: {
  tasks: import("@/lib/types").DashboardTasks;
  c: ReturnType<typeof useChartColors>;
}) {
  const s = tasks.summary;
  const hasTasks = s.total > 0;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle eyebrow="Задачи">Сводка</PanelTitle>
        {hasTasks && (
          <Link
            href="/projects"
            className="text-[13px] text-ink-3 hover:text-accent transition-colors inline-flex items-center gap-1"
          >
            К проектам
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </PanelHeader>
      <PanelBody className="space-y-5">
        {/* 4 tiles — always visible */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <TaskTile
            icon={ListChecks}
            label="Всего"
            value={s.total}
            tone="neutral"
          />
          <TaskTile
            icon={Loader2}
            label="В работе"
            value={s.active}
            tone="blue"
          />
          <TaskTile
            icon={CheckCircle2}
            label="Готово"
            value={s.inactive}
            tone="green"
          />
          <TaskTile
            icon={AlertTriangle}
            label="Просрочено"
            value={s.overdue}
            tone={s.overdue > 0 ? "red" : "neutral"}
            danger={s.overdue > 0}
          />
        </div>

        {/* Body: chart when there are tasks, otherwise an inviting empty state */}
        {hasTasks ? (
          <TasksByTypeChart byType={tasks.by_type} c={c} />
        ) : (
          <TasksEmpty />
        )}
      </PanelBody>
    </Panel>
  );
}

function TaskTile({
  icon: Icon,
  label,
  value,
  tone,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "neutral" | "blue" | "green" | "red";
  danger?: boolean;
}) {
  const toneCls: Record<string, { bg: string; ic: string; ring: string }> = {
    neutral: {
      bg: "bg-surface",
      ic: "text-ink-3",
      ring: "ring-1 ring-hairline",
    },
    blue: {
      bg: "bg-tag-blue-bg/50",
      ic: "text-tag-blue-fg",
      ring: "ring-1 ring-tag-blue-fg/20",
    },
    green: {
      bg: "bg-tag-green-bg/50",
      ic: "text-tag-green-fg",
      ring: "ring-1 ring-tag-green-fg/20",
    },
    red: {
      bg: "bg-tag-red-bg/40",
      ic: "text-danger",
      ring: "ring-1 ring-danger/30",
    },
  };
  const t = toneCls[tone];
  return (
    <div
      className={cn(
        "relative rounded-lg p-4 flex items-center gap-3",
        t.bg,
        t.ring,
        danger && "animate-[pulse_3s_ease-in-out_infinite]"
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-md grid place-items-center shrink-0 bg-canvas/70 backdrop-blur",
          t.ic
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-col leading-tight min-w-0">
        <span className="font-display text-[26px] tabular-nums text-ink">
          {value}
        </span>
        <span className="text-[12px] text-ink-3">{label}</span>
      </div>
    </div>
  );
}

function TasksByTypeChart({
  byType,
  c,
}: {
  byType: import("@/lib/types").DashboardTasksByType[];
  c: ReturnType<typeof useChartColors>;
}) {
  if (byType.length === 0) {
    // Have tasks aggregated by date but none grouped by type — possible if
    // backend returns empty by_type. Show a small notice instead of nothing.
    return (
      <p className="text-[13px] text-ink-3 text-center py-6">
        Нет данных для группировки по типу.
      </p>
    );
  }
  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={byType}
          margin={{ top: 10, right: 4, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke={c.hairline} vertical={false} />
          <XAxis
            dataKey="type"
            stroke={c.ink4}
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={c.ink4}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: c.canvas,
              border: `1px solid ${c.hairlineStrong}`,
              borderRadius: 8,
              fontSize: 12,
              color: c.ink,
            }}
            formatter={(v: number | string, key) => [
              v,
              key === "active"
                ? "В работе"
                : key === "inactive"
                ? "Закрыто"
                : key === "overdue"
                ? "Просрочено"
                : "Всего",
            ]}
          />
          <Bar dataKey="active" stackId="t" fill={c.accent} />
          <Bar dataKey="inactive" stackId="t" fill="#3D9C47" />
          <Bar dataKey="overdue" stackId="t" fill="#D8473A" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TasksEmpty() {
  return (
    <div className="rounded-lg border border-dashed border-hairline-strong bg-surface/50 px-6 py-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-xl bg-canvas border border-hairline grid place-items-center mb-4 shadow-card">
        <ClipboardList className="h-5 w-5 text-ink-3" />
      </div>
      <h3 className="font-display text-[20px] text-ink mb-1.5">
        Задач за этот период нет
      </h3>
      <p className="text-[13px] text-ink-3 max-w-[44ch] mx-auto mb-5">
        Задачи появляются автоматически, когда вы добавляете план работ к
        проекту. Откройте любой проект и нажмите «Создать задачу».
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Link href="/projects">
          <Button variant="primary" size="md">
            <Briefcase className="h-3.5 w-3.5" />
            К проектам
          </Button>
        </Link>
        <span className="text-[11px] text-ink-4 inline-flex items-center gap-1">
          <Circle className="h-2 w-2 fill-current" />
          или поменяйте период выше
        </span>
      </div>
    </div>
  );
}

/* ----------- helpers ----------- */

function Chip({
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
        "inline-flex items-center h-8 md:h-7 px-2.5 rounded-full text-[12px] border transition-colors",
        active
          ? "bg-accent-soft border-accent/40 text-accent-ink font-medium"
          : "bg-canvas border-hairline-strong text-ink-2 hover:border-ink-5 hover:bg-surface-2"
      )}
    >
      {label}
    </button>
  );
}

function ByTypeDonut({
  title,
  rows,
  resolver,
  total,
  c,
}: {
  title: string;
  rows: { type: string; count: number; total_amount: string }[];
  resolver: (t: string) => { label: string; color: string };
  total: number;
  c: ReturnType<typeof useChartColors>;
}) {
  const data = rows
    .map((r) => ({
      name: r.type,
      value: Number(r.total_amount),
      label: resolver(r.type).label,
      color: resolver(r.type).color,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        <span className="text-[12px] text-ink-3">
          {data.length}{" "}
          {plural(data.length, "категория", "категории", "категорий")}
        </span>
      </PanelHeader>
      <PanelBody>
        {data.length === 0 ? (
          <p className="text-[13px] text-ink-4 text-center py-10">
            Нет данных за период
          </p>
        ) : (
          <div className="flex flex-col xl:flex-row items-center gap-6">
            <div className="h-[180px] w-[180px] relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    innerRadius={56}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: c.canvas,
                      border: `1px solid ${c.hairlineStrong}`,
                      borderRadius: 8,
                      fontSize: 12,
                      color: c.ink,
                    }}
                    formatter={(v) => formatCurrency(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-[10px] text-ink-3">Всего</div>
                  <div className="font-display text-[16px] tabular-nums text-ink mt-0.5">
                    {total >= 1000
                      ? `${(total / 1000).toFixed(1)}k`
                      : formatCurrency(total)}
                  </div>
                </div>
              </div>
            </div>
            <ul className="flex-1 w-full space-y-1">
              {data.map((d) => {
                const pct = total > 0 ? (d.value / total) * 100 : 0;
                return (
                  <li
                    key={d.name}
                    className="flex items-center justify-between gap-2 text-[12px] px-2 py-1 rounded hover:bg-surface-2 min-w-0"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: d.color }}
                      />
                      <span className="text-ink truncate">{d.label}</span>
                    </span>
                    <span className="flex items-center gap-3 tabular-nums shrink-0">
                      <span className="text-ink-3">{pct.toFixed(0)}%</span>
                      <span className="text-ink">{formatCurrency(d.value)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function periodLabel(meta: { period: DashboardPeriod; date_from: string; date_to: string }) {
  const map: Record<DashboardPeriod, string> = {
    week: "Неделя",
    month: "Месяц",
    year: "Год",
    all: "Всё время",
    custom: "Период",
  };
  if (meta.period === "all") return map.all;
  return `${formatDate(meta.date_from)} — ${formatDate(meta.date_to)}`;
}

function formatBucket(
  raw: string,
  groupBy: DashboardGroupBy,
  long = false
): string {
  // Date strings from backend look like "2026-06-09" (day/week/month start)
  // or "2026-01-01" for years. Render compact ticks vs verbose tooltip label.
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  if (groupBy === "year") {
    return String(d.getFullYear());
  }
  if (groupBy === "month") {
    return new Intl.DateTimeFormat("ru-RU", {
      month: "short",
      year: long ? "numeric" : undefined,
    }).format(d);
  }
  if (groupBy === "week") {
    return long
      ? `Неделя с ${formatDate(d)}`
      : new Intl.DateTimeFormat("ru-RU", {
          day: "2-digit",
          month: "short",
        }).format(d);
  }
  return long
    ? formatDate(d, { day: "2-digit", month: "long", year: "numeric" })
    : new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "short",
      }).format(d);
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function StatusBadge({ stage }: { stage: string }) {
  const m = stageLabel(stage);
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  );
}
