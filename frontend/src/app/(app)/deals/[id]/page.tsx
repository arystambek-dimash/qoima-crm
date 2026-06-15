"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Topbar } from "@/components/app-shell/topbar";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TR, TH, TD } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Input, Field } from "@/components/ui/input";
import { PermissionDenied } from "@/components/permission-gate";
import { AddPaymentDialog } from "./payment-dialog";
import { AddTaskDialog } from "./task-dialog";
import { EditDealDialog } from "./edit-deal-dialog";
import { TasksBoard } from "@/components/tasks-board";
import { asApiError } from "@/lib/api";
import { deals, onboards } from "@/lib/endpoints";
import {
  useCurrentUser,
  useRole,
  useIsSuperuser,
  useHasPermission,
} from "@/lib/permissions";
import { formatCurrency, formatDate, cn, plural } from "@/lib/utils";
import { dealClientName, paymentTypeLabel, stageLabel } from "@/lib/deal-labels";
import { userDisplayName, userIdOf } from "@/lib/user-helpers";
import {
  APPROVAL_SHORT,
  APPROVAL_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_TONE,
  TASK_COLUMNS,
  resolveApprovalStatus,
  resolvePriority,
  resolveStatus,
  ticketKey,
  typeMeta,
} from "@/lib/task-helpers";
import {
  ArrowLeft,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  Plus,
  LayoutGrid,
  List as ListIcon,
  Filter,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  Deal,
  DealFile,
  DealFileCreate,
  DealPayment,
  DealPaymentCreate,
  Onboard,
  OnboardTask,
  TaskCategory,
} from "@/lib/types";

type Tab = "overview" | "tasks" | "payments" | "files";

export default function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const dealId = Number(id);
  const role = useRole();
  const user = useCurrentUser();
  const isSuper = useIsSuperuser();
  const canUpdateDeal = useHasPermission("deals_can_update");
  const isCollaborator = role === "collaborator" && !isSuper;
  const canManagePayments =
    isSuper || (role === "employee" && canUpdateDeal.granted);

  const dealQ = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => deals.retrieve(dealId),
  });

  const [tab, setTab] = useState<Tab>("overview");

  // Payments are session-local (no GET endpoint yet) — but the
  // "Record payment" action lives in two places (header + Payments tab), so
  // we lift state up so both can mutate the same list.
  const [sessionPayments, setSessionPayments] = useState<DealPayment[]>([]);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const qc = useQueryClient();
  const addPayment = useMutation({
    mutationFn: (payload: DealPaymentCreate) =>
      deals.addPayment(dealId, payload),
    onSuccess: (p) => {
      setSessionPayments((prev) => [p, ...prev]);
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
      toast.success("Платёж зафиксирован.");
      setPayDialogOpen(false);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  const d = dealQ.data;

  // Collaborators (non-super) can only view orders where they are attached —
  // either as the primary `user` or in the multi-collaborator list.
  const collaboratorIds = new Set<number>([
    ...(d?.collaborators ?? []),
    ...((d?.collaborator_details ?? []).map((u) => u.id)),
  ]);
  if (
    d &&
    isCollaborator &&
    user &&
    userIdOf(d.user) !== user.id &&
    !collaboratorIds.has(user.id)
  ) {
    return (
      <>
        <Topbar eyebrow="Мои заказы" title="Доступ запрещён" />
        <PermissionDenied
          title="Этот заказ принадлежит другому клиенту"
          detail="Вы можете видеть только свои заказы."
          cta="К вашим заказам"
          href="/deals"
        />
      </>
    );
  }

  if (!d && !dealQ.isLoading) {
    return (
      <>
        <Topbar eyebrow="Работа" title="Заказ не найден" />
        <main className="flex-1 px-8 py-12 max-w-[1080px] mx-auto w-full">
          <Link
            href="/deals"
            className="inline-flex items-center gap-2 text-ink-3 hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            К списку заказов
          </Link>
        </main>
      </>
    );
  }

  if (!d) return <Topbar eyebrow="Работа" title="Загрузка…" />;

  const paid = Number(d.paid_to_date ?? 0);
  const total = Number(d.deal_amount);
  const progressPct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;

  return (
    <>
      <Topbar
        eyebrow={isCollaborator ? "Мои заказы" : "Работа"}
        title={d.client_name ?? `Заказ #${d.id}`}
        actions={
          isCollaborator ? undefined : (
            <div className="flex items-center gap-2">
              {canManagePayments && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                >
                  Редактировать
                </Button>
              )}
              {canManagePayments && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setPayDialogOpen(true)}
                >
                  Зафиксировать платёж
                </Button>
              )}
            </div>
          )
        }
      />

      {/* Shared payment dialog for header + Payments tab */}
      <AddPaymentDialog
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        onSubmit={(values) => addPayment.mutate(values)}
        pending={addPayment.isPending}
      />
      <EditDealDialog
        deal={d}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <main className="flex-1 px-6 lg:px-10 py-10 max-w-[1080px] mx-auto w-full stagger">
        <Link
          href="/deals"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-accent transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isCollaborator ? "Ваши заказы" : "Все заказы"}
        </Link>

        {/* Page header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <StatusBadge stage={d.stage} />
            <Badge tone="gray">{paymentTypeLabel(d.payment_type)}</Badge>
            {d.payment_completed && <Badge tone="green">оплачено</Badge>}
          </div>
          <h1 className="font-display text-[28px] tracking-tight text-ink text-balance">
            {d.client_name}
          </h1>
          <p className="mt-2 text-[14px] text-ink-3">
            {d.client_email} · Открыт {formatDate(d.date_start)} · Срок{" "}
            {formatDate(d.date_end)}
          </p>
        </header>

        {/* Money summary */}
        <section className="grid grid-cols-3 gap-3 mb-6">
          <Money k="Сумма заказа" v={formatCurrency(d.deal_amount)} />
          <Money k="Оплачено" v={formatCurrency(d.paid_to_date)} accent />
          <Money k="Остаток" v={formatCurrency(d.remaining)} />
        </section>

        <Panel className="mb-8">
          <PanelBody>
            <div className="flex items-center justify-between mb-2 text-[13px]">
              <span className="text-ink-2 font-medium">Прогресс оплаты</span>
              <span className="text-ink-3 tabular-nums">
                {progressPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-surface-3 rounded-full relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </PanelBody>
        </Panel>

        {/* Tabs */}
        <div className="mb-6 border-b border-hairline flex items-center gap-1 overflow-x-auto scrollbar-thin">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            Обзор
          </TabButton>
          <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")}>
            Задачи
          </TabButton>
          <TabButton active={tab === "payments"} onClick={() => setTab("payments")}>
            Платежи
          </TabButton>
          <TabButton active={tab === "files"} onClick={() => setTab("files")}>
            Файлы
          </TabButton>
        </div>

        {tab === "overview" && (
          <OverviewTab dealId={dealId} isCollaborator={isCollaborator} d={d} />
        )}
        {tab === "tasks" && (
          <TasksTab dealId={dealId} isCollaborator={isCollaborator} />
        )}
        {tab === "payments" && (
          <PaymentsTab
            dealId={dealId}
            isCollaborator={isCollaborator}
            canManagePayments={canManagePayments}
            payments={sessionPayments}
            onRemovePayment={(pid) => {
              deals
                .removePayment(dealId, pid)
                .then(() => {
                  setSessionPayments((prev) =>
                    prev.filter((p) => p.id !== pid)
                  );
                  toast.success("Платёж удалён.");
                })
                .catch((err) => toast.error(asApiError(err).message));
            }}
            onOpenAdd={() => setPayDialogOpen(true)}
          />
        )}
        {tab === "files" && (
          <FilesTab dealId={dealId} isCollaborator={isCollaborator} />
        )}
      </main>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative h-9 px-3 text-[13px] transition-colors",
        active ? "text-ink font-medium" : "text-ink-3 hover:text-ink"
      )}
    >
      {children}
      {active && (
        <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-accent rounded-full" />
      )}
    </button>
  );
}

/* ------- Overview tab ------- */

function OverviewTab({
  dealId,
  isCollaborator,
  d,
}: {
  dealId: number;
  isCollaborator: boolean;
  d: Deal;
}) {
  const onboardsQ = useQuery({
    queryKey: ["onboards-for-deal", dealId],
    queryFn: () => onboards.forDeal(dealId),
  });
  const dealOnboards = onboardsQ.data ?? [];
  const primary = dealOnboards[0];

  // Pull full nested onboard so we can compute progress on the client.
  const fullOnboardQ = useQuery({
    queryKey: ["onboard", primary?.id],
    queryFn: () => onboards.retrieve(primary!.id),
    enabled: !!primary,
  });
  const onboard = fullOnboardQ.data;
  const progress = computeOnboardProgress(onboard);

  const paid = Number(d.paid_to_date ?? 0);
  const remaining = Number(d.remaining ?? Math.max(0, Number(d.deal_amount) - paid));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
      <Panel className="anim-fade">
        <PanelHeader>
          <PanelTitle>Детали заказа</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3 text-[14px]">
          <Row k="Клиент" v={dealClientName(d) || userDisplayName(d.user)} />
          <Row k="Контактный email" v={d.client_email ?? "—"} />
          <CollaboratorsRow deal={d} />
          <Row k="Статус" v={<StatusBadge stage={d.stage} />} />
          <Row k="Способ оплаты" v={<Badge tone="gray">{paymentTypeLabel(d.payment_type)}</Badge>} />
          <Row k="Открыт" v={formatDate(d.date_start)} />
          <Row k="Срок" v={formatDate(d.date_end)} />
          <Row k="Сумма заказа" v={formatCurrency(d.deal_amount)} />
          <Row k="Оплачено" v={formatCurrency(paid)} />
          <Row k="Остаток" v={formatCurrency(remaining)} />
        </PanelBody>
      </Panel>

      <Panel className="anim-fade">
        <PanelHeader>
          <PanelTitle>План задач</PanelTitle>
          {primary && (
            <span className="text-[12px] text-ink-3">
              {progress}% готово
            </span>
          )}
        </PanelHeader>
        <PanelBody>
          {!primary ? (
            <p className="text-[13px] text-ink-3">
              {isCollaborator
                ? "План задач пока не опубликован — мы скоро его составим."
                : "Плана задач пока нет. Создайте онбординг для этого заказа."}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2 text-[13px]">
                <span className="text-ink-2 font-medium">Общий прогресс</span>
                <span className="text-ink-3 tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 bg-surface-3 rounded-full relative overflow-hidden mb-4">
                <div
                  className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[13px] text-ink-3 mb-3">
                Срок сдачи: {formatDate(primary.term_of_end)}
              </p>
              <Link
                href={`/deals/${dealId}` as never}
                className="text-[13px] text-accent hover:text-accent-ink"
              >
                Открыть план задач →
              </Link>
            </>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

/** Progress percentage based on done tasks ratio inside an onboard. */
function computeOnboardProgress(o: Onboard | undefined): number {
  if (!o?.categories) return 0;
  let total = 0;
  let done = 0;
  for (const c of o.categories) {
    for (const t of c.tasks ?? []) {
      total += 1;
      if (!t.is_active) done += 1;
    }
  }
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline py-2.5 last:border-0">
      <span className="text-ink-3 w-[40%] shrink-0">{k}</span>
      <span className="text-ink-2 text-right">{v}</span>
    </div>
  );
}

function CollaboratorsRow({ deal }: { deal: Deal }) {
  const list = deal.collaborator_details ?? [];
  if (list.length === 0) return null;

  const primaryId = userIdOf(deal.user);
  const extras = list.filter((u) => u.id !== primaryId);
  if (extras.length === 0) return null;

  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline py-2.5 last:border-0">
      <span className="text-ink-3 w-[40%] shrink-0">Совместный доступ</span>
      <div className="flex-1 flex flex-wrap justify-end gap-1.5">
        {extras.map((u) => {
          const name =
            `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
            u.username ||
            u.email;
          return (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-full bg-surface-2 border border-hairline text-[12px] text-ink-2"
              title={u.email}
            >
              <Avatar
                name={name}
                size={20}
                className="text-[10px] ring-1 ring-canvas"
              />
              <span className="max-w-[160px] truncate">{name}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ------- Tasks tab (Jira-style) ------- */

type TaskView = "board" | "list";

function TasksTab({
  dealId,
  isCollaborator,
}: {
  dealId: number;
  isCollaborator: boolean;
}) {
  const qc = useQueryClient();

  // 1. Deal (for default term when auto-creating an onboard).
  const dealQ = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => deals.retrieve(dealId),
  });

  // 2. All onboards (KPI plans) for this deal.
  const dealOnboardsQ = useQuery({
    queryKey: ["onboards-for-deal", dealId],
    queryFn: () => onboards.forDeal(dealId),
  });
  const dealOnboards = useMemo(
    () => dealOnboardsQ.data ?? [],
    [dealOnboardsQ.data]
  );

  // 3. Which onboard is currently displayed. User can switch between them.
  const [selectedOnboardId, setSelectedOnboardId] = useState<number | null>(
    null
  );
  // Default-select the first onboard once data arrives, or if the chosen one
  // disappears (e.g. was deleted in another tab).
  const effectiveOnboardId = useMemo(() => {
    if (selectedOnboardId &&
        dealOnboards.some((o) => o.id === selectedOnboardId)) {
      return selectedOnboardId;
    }
    return dealOnboards[0]?.id ?? null;
  }, [selectedOnboardId, dealOnboards]);

  // Lazy-create an onboard the first time someone tries to add a task. We
  // default term_of_end to the deal's own deadline — sensible and editable
  // later from the Onboard detail page.
  const ensureOnboard = useMutation({
    mutationFn: async (): Promise<number> => {
      if (effectiveOnboardId) return effectiveOnboardId;
      const created = await onboards.create({
        deal: dealId,
        term_of_end:
          dealQ.data?.date_end ?? new Date().toISOString().slice(0, 10),
      });
      return created.id;
    },
    onSuccess: (id) => {
      // Switch to the newly-created onboard.
      setSelectedOnboardId(id);
      qc.invalidateQueries({ queryKey: ["onboards-for-deal", dealId] });
      qc.invalidateQueries({ queryKey: ["onboards"] });
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  // 4. Pull the full nested representation of the selected onboard.
  const onboardQ = useQuery({
    queryKey: ["onboard", effectiveOnboardId],
    queryFn: () => onboards.retrieve(effectiveOnboardId!),
    enabled: !!effectiveOnboardId,
  });
  const onboard = onboardQ.data;
  const cats = useMemo(() => onboard?.categories ?? [], [onboard?.categories]);
  const tasks = useMemo(() => cats.flatMap((c) => c.tasks ?? []), [cats]);

  const [view, setView] = useState<TaskView>("board");
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [approvalFilter, setApprovalFilter] =
    useState<"all" | "pending" | "approved" | "rejected" | "cancelled">("all");

  // Add-task dialog state.
  const [addOpen, setAddOpen] = useState(false);
  const [addCategoryId, setAddCategoryId] = useState<number | undefined>();
  const [pendingOnboardId, setPendingOnboardId] = useState<number | null>(null);

  async function openAdd(categoryId?: number) {
    setAddCategoryId(categoryId);
    try {
      const onboardId = await ensureOnboard.mutateAsync();
      setPendingOnboardId(onboardId);
      setAddOpen(true);
    } catch {
      /* toast already shown by mutation onError */
    }
  }

  const approvalCounts = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    for (const t of tasks) {
      const a = resolveApprovalStatus(t);
      if (a && a in counts) counts[a] += 1;
    }
    return counts;
  }, [tasks]);

  const filtered = useMemo(() => {
    let list = tasks;
    if (categoryFilter !== "all") {
      list = list.filter((t) => t.category === categoryFilter);
    }
    if (approvalFilter !== "all") {
      list = list.filter((t) => resolveApprovalStatus(t) === approvalFilter);
    }
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term) ||
          ticketKey(t).toLowerCase().includes(term)
      );
    }
    return list;
  }, [tasks, q, categoryFilter, approvalFilter]);

  return (
    <div className="anim-fade space-y-4">
      {/* Onboard selector — one chip per KPI plan */}
      {dealOnboards.length > 0 && (
        <OnboardSelector
          dealId={dealId}
          onboardsList={dealOnboards}
          selectedId={effectiveOnboardId}
          onSelect={setSelectedOnboardId}
          readOnly={isCollaborator}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md relative">
          <Search className="absolute left-3 h-4 w-4 text-ink-4 pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск QOI-001, названия или описания"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryFilter
            categories={cats}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
          <ApprovalFilter
            value={approvalFilter}
            onChange={setApprovalFilter}
            counts={approvalCounts}
          />
          <Button variant="outline" size="sm">
            <Filter className="h-3.5 w-3.5" />
            Фильтр
          </Button>
          <div className="flex bg-surface-2 border border-hairline rounded-md p-0.5">
            <button
              onClick={() => setView("board")}
              className={cn(
                "h-7 px-2.5 inline-flex items-center gap-1.5 text-[13px] rounded transition-colors",
                view === "board"
                  ? "bg-canvas text-ink shadow-sm font-medium"
                  : "text-ink-3 hover:text-ink"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Доска
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "h-7 px-2.5 inline-flex items-center gap-1.5 text-[13px] rounded transition-colors",
                view === "list"
                  ? "bg-canvas text-ink shadow-sm font-medium"
                  : "text-ink-3 hover:text-ink"
              )}
            >
              <ListIcon className="h-3.5 w-3.5" />
              Список
            </button>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openAdd()}
            disabled={ensureOnboard.isPending}
            title={
              isCollaborator
                ? "Задача уйдёт на одобрение администратору"
                : undefined
            }
          >
            <Plus className="h-3.5 w-3.5" />
            {ensureOnboard.isPending
              ? "Готовим…"
              : isCollaborator
              ? "Предложить задачу"
              : "Создать"}
          </Button>
        </div>
      </div>

      {view === "board" ? (
        effectiveOnboardId ? (
          <TasksBoard
            onboardId={effectiveOnboardId}
            categories={filterCategories(cats, filtered)}
            readOnly={isCollaborator}
            canAddCards={isCollaborator}
            onAddCard={(categoryId) => openAdd(categoryId)}
          />
        ) : (
          <EmptyBoardCTA
            isCollaborator={isCollaborator}
            onCreate={() => openAdd()}
            pending={ensureOnboard.isPending}
          />
        )
      ) : (
        <TasksList
          tasks={filtered}
          categories={cats}
          readOnly={isCollaborator}
        />
      )}

      {pendingOnboardId && (
        <AddTaskDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onboardId={pendingOnboardId}
          categories={cats}
          defaultCategoryId={addCategoryId}
        />
      )}
    </div>
  );
}

function EmptyBoardCTA({
  isCollaborator,
  onCreate,
  pending,
}: {
  isCollaborator: boolean;
  onCreate: () => void;
  pending: boolean;
}) {
  return (
    <Panel className="p-12 text-center anim-fade">
      <h3 className="font-display text-[20px] text-ink">
        Плана задач пока нет
      </h3>
      <p className="text-[14px] text-ink-3 mt-1 mb-5">
        {isCollaborator
          ? "Предложите первую задачу — она появится в плане после одобрения администратором."
          : "Нажмите «Создать задачу» — онбординг и первая категория добавятся автоматически."}
      </p>
      <Button
        variant="primary"
        size="md"
        onClick={onCreate}
        disabled={pending}
      >
        <Plus className="h-3.5 w-3.5" />
        {pending
          ? "Готовим…"
          : isCollaborator
          ? "Предложить задачу"
          : "Создать задачу"}
      </Button>
    </Panel>
  );
}

/** Keep all categories, but slice each category's tasks to the filtered set. */
function filterCategories(
  cats: TaskCategory[],
  filteredTasks: OnboardTask[]
): TaskCategory[] {
  const allowed = new Set(filteredTasks.map((t) => t.id));
  return cats.map((c) => ({
    ...c,
    tasks: (c.tasks ?? []).filter((t) => allowed.has(t.id)),
  }));
}

/* ------- Onboard selector (KPI plans for this deal) ------- */

function OnboardSelector({
  dealId,
  onboardsList,
  selectedId,
  onSelect,
  readOnly,
}: {
  dealId: number;
  onboardsList: Onboard[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const removeOnboard = useMutation({
    mutationFn: (id: number) => onboards.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboards-for-deal", dealId] });
      qc.invalidateQueries({ queryKey: ["onboards"] });
      toast.success("Онбординг удалён.");
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[12px] text-ink-3 mr-1">Онбординг:</span>
      {onboardsList.map((o, idx) => (
        <OnboardChip
          key={o.id}
          o={o}
          fallbackIdx={idx}
          active={o.id === selectedId}
          dealId={dealId}
          onSelect={() => onSelect(o.id)}
          readOnly={readOnly}
          canDelete={onboardsList.length > 1}
          onDelete={() => {
            if (
              confirm(
                `Удалить онбординг «${displayOnboardName(o, idx)}»? Все его задачи и категории удалятся.`
              )
            ) {
              removeOnboard.mutate(o.id);
            }
          }}
        />
      ))}

      {!readOnly && <NewOnboardChip dealId={dealId} onCreated={onSelect} />}
    </div>
  );
}

function displayOnboardName(o: Onboard, idx: number): string {
  if (o.name && o.name.trim()) return o.name;
  if (o.client_name) return o.client_name;
  return `План #${idx + 1}`;
}

function OnboardChip({
  o,
  fallbackIdx,
  active,
  dealId,
  onSelect,
  readOnly,
  canDelete,
  onDelete,
}: {
  o: Onboard;
  fallbackIdx: number;
  active: boolean;
  dealId: number;
  onSelect: () => void;
  readOnly?: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(displayOnboardName(o, fallbackIdx));

  const rename = useMutation({
    mutationFn: (name: string) => onboards.update(o.id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboards-for-deal", dealId] });
      qc.invalidateQueries({ queryKey: ["onboards"] });
      qc.invalidateQueries({ queryKey: ["onboard", o.id] });
      toast.success("Онбординг переименован.");
      setRenaming(false);
    },
    onError: (err) => {
      toast.error(asApiError(err).message);
      setRenaming(false);
      setDraft(displayOnboardName(o, fallbackIdx));
    },
  });

  if (renaming) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const next = draft.trim();
          if (next && next !== displayOnboardName(o, fallbackIdx)) {
            rename.mutate(next);
          } else {
            setRenaming(false);
            setDraft(displayOnboardName(o, fallbackIdx));
          }
        }}
        className="inline-flex items-center gap-1"
      >
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const next = draft.trim();
            if (next && next !== displayOnboardName(o, fallbackIdx)) {
              rename.mutate(next);
            } else {
              setRenaming(false);
              setDraft(displayOnboardName(o, fallbackIdx));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setRenaming(false);
              setDraft(displayOnboardName(o, fallbackIdx));
            }
          }}
          className="h-7 text-[12px] w-[180px]"
        />
      </form>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-stretch rounded-full overflow-hidden border transition-colors",
        active
          ? "bg-accent-soft border-accent/40 text-accent-ink"
          : "bg-canvas border-hairline-strong text-ink-2 hover:border-ink-5 hover:bg-surface-2"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={() => !readOnly && setRenaming(true)}
        className={cn(
          "inline-flex items-center gap-2 h-7 pl-2.5 pr-2 text-[12px]",
          active && "font-medium"
        )}
        title={readOnly ? undefined : "Двойной клик — переименовать"}
      >
        <span>{displayOnboardName(o, fallbackIdx)}</span>
        <span
          className={cn(
            "text-[11px] tabular-nums",
            active ? "text-accent-ink/70" : "text-ink-3"
          )}
        >
          до {formatDate(o.term_of_end, { month: "short", day: "2-digit" })}
        </span>
        {o.is_completed && (
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
        )}
      </button>
      {!readOnly && active && (
        <>
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="px-1.5 grid place-items-center text-accent-ink/60 hover:text-accent-ink hover:bg-accent-soft/70 transition-colors border-l border-accent/30"
            title="Переименовать"
          >
            <Pencil className="h-3 w-3" />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="px-1.5 grid place-items-center text-accent-ink/60 hover:text-danger hover:bg-tag-red-bg/40 transition-colors border-l border-accent/30"
              title="Удалить онбординг"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

function NewOnboardChip({
  dealId,
  onCreated,
}: {
  dealId: number;
  onCreated: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");

  const create = useMutation({
    mutationFn: (term: string) =>
      onboards.create({ deal: dealId, term_of_end: term }),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ["onboards-for-deal", dealId] });
      qc.invalidateQueries({ queryKey: ["onboards"] });
      toast.success("Онбординг создан.");
      onCreated(o.id);
      setAdding(false);
      setDate("");
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] border border-dashed border-hairline-strong text-ink-3 hover:border-ink-5 hover:text-ink hover:bg-surface-2 transition-colors"
      >
        <Plus className="h-3 w-3" />
        Новый онбординг
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (date) create.mutate(date);
      }}
      className="inline-flex items-center gap-1.5"
    >
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        autoFocus
        required
        placeholder="Срок сдачи"
        className="h-7 text-[12px] w-[140px]"
      />
      <Button
        type="submit"
        variant="primary"
        size="icon"
        disabled={!date || create.isPending}
        title="Создать"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => {
          setAdding(false);
          setDate("");
        }}
        title="Отмена"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}

function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: { id: number; name: string }[];
  value: number | "all";
  onChange: (v: number | "all") => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "all" ? "all" : Number(v));
      }}
      className="h-8 bg-canvas border border-hairline-strong rounded-md px-2 text-[13px] text-ink-2 hover:border-ink-5 transition-colors cursor-pointer"
    >
      <option value="all">Все категории</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

const APPROVAL_FILTER_OPTIONS: {
  key: "all" | "pending" | "approved" | "rejected" | "cancelled";
  label: string;
}[] = [
  { key: "all", label: "Все" },
  { key: "pending", label: "Ожидают" },
  { key: "approved", label: "Одобренные" },
  { key: "rejected", label: "Отклонённые" },
  { key: "cancelled", label: "Отменённые" },
];

function ApprovalFilter({
  value,
  onChange,
  counts,
}: {
  value: "all" | "pending" | "approved" | "rejected" | "cancelled";
  onChange: (
    v: "all" | "pending" | "approved" | "rejected" | "cancelled"
  ) => void;
  counts: { pending: number; approved: number; rejected: number; cancelled: number };
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as typeof value)}
      className="h-8 bg-canvas border border-hairline-strong rounded-md px-2 text-[13px] text-ink-2 hover:border-ink-5 transition-colors cursor-pointer"
      title="Фильтр по статусу согласования"
    >
      {APPROVAL_FILTER_OPTIONS.map((o) => {
        const n = o.key === "all" ? null : counts[o.key];
        return (
          <option key={o.key} value={o.key}>
            {o.label}
            {n != null ? ` (${n})` : ""}
          </option>
        );
      })}
    </select>
  );
}

/* Board view is provided by the shared TasksBoard component (Trello-style).
 * Old per-status board has been replaced — see src/components/tasks-board.tsx.
 */

/* ----- List view ----- */

function TasksList({
  tasks,
  categories,
  readOnly,
}: {
  tasks: OnboardTask[];
  categories: { id: number; name: string }[];
  readOnly: boolean;
}) {
  const catName = (id: number) =>
    categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <Panel>
      <Table>
        <THead>
          <TR>
            <TH className="w-[90px]">Ключ</TH>
            <TH>Название</TH>
            <TH>Статус</TH>
            <TH>Согласование</TH>
            <TH>Приоритет</TH>
            <TH>Категория</TH>
            <TH>Исполнитель</TH>
            <TH>Срок</TH>
          </TR>
        </THead>
        <tbody>
          {tasks.map((t) => {
            const tm = typeMeta(t.type);
            const status = resolveStatus(t);
            const priority = resolvePriority(t);
            const approval = resolveApprovalStatus(t);
            const isDone = status === "done";
            return (
              <TR key={t.id} className="cursor-pointer">
                <TD className="font-mono text-[12px] text-ink-3 tabular-nums">
                  {ticketKey(t)}
                </TD>
                <TD>
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[14px] shrink-0"
                      aria-hidden
                      title={tm.label}
                    >
                      {tm.emoji}
                    </span>
                    <span
                      className={cn(
                        "text-ink truncate",
                        isDone && "line-through text-ink-3"
                      )}
                    >
                      {t.name}
                    </span>
                  </div>
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[status]} dot>
                    {TASK_COLUMNS.find((c) => c.key === status)?.label ?? status}
                  </Badge>
                </TD>
                <TD>
                  {approval ? (
                    <Badge tone={APPROVAL_TONE[approval]} dot>
                      {APPROVAL_SHORT[approval]}
                    </Badge>
                  ) : (
                    <span className="text-ink-4 text-[12px]">—</span>
                  )}
                </TD>
                <TD>
                  <Badge tone={PRIORITY_TONE[priority]}>
                    {PRIORITY_LABEL[priority]}
                  </Badge>
                </TD>
                <TD className="text-ink-3 text-[13px]">{catName(t.category)}</TD>
                <TD>
                  {t.assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={t.assignee.name}
                        size={22}
                        className="text-[10px]"
                      />
                      <span className="text-[13px] text-ink-2 truncate max-w-[14ch]">
                        {t.assignee.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-ink-4 text-[13px]">Не назначен</span>
                  )}
                </TD>
                <TD className="text-ink-3 tabular-nums text-[13px]">
                  {formatDate(t.date_end, { month: "short", day: "2-digit" })}
                </TD>
              </TR>
            );
          })}
          {tasks.length === 0 && (
            <TR>
              <TD colSpan={8} className="text-center text-ink-4 py-12">
                Задачи по фильтрам не найдены.
                {!readOnly && (
                  <span className="ml-1 text-accent hover:text-accent-ink cursor-pointer">
                    Создать новую →
                  </span>
                )}
              </TD>
            </TR>
          )}
        </tbody>
      </Table>
    </Panel>
  );
}

/* ------- Payments tab ------- *
 *
 * Backend exposes only POST /deals/{id}/payments/ and DELETE — there is no
 * GET endpoint for listing payments yet. To stay honest with the user, we
 * keep a session-local list of payments added during this session and show a
 * note explaining the limitation. Once the backend adds a GET endpoint, swap
 * the source to a useQuery against `/deals/{id}/payments/`.
 */

function PaymentsTab({
  isCollaborator,
  canManagePayments,
  payments,
  onRemovePayment,
  onOpenAdd,
}: {
  dealId: number;
  isCollaborator: boolean;
  canManagePayments: boolean;
  payments: DealPayment[];
  onRemovePayment: (paymentId: number) => void;
  onOpenAdd: () => void;
}) {
  return (
    <Panel className="anim-fade">
      <PanelHeader>
        <PanelTitle>График платежей</PanelTitle>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-ink-3">
            {payments.length}{" "}
            {plural(payments.length, "платёж", "платежа", "платежей")} за сессию
          </span>
          {!isCollaborator && canManagePayments && (
            <Button variant="primary" size="sm" onClick={onOpenAdd}>
              <Plus className="h-3.5 w-3.5" />
              Добавить
            </Button>
          )}
        </div>
      </PanelHeader>
      <PanelBody>
        <p className="text-[12px] text-ink-3 mb-3">
          Backend пока не отдаёт список платежей через GET. Здесь видны только
          платежи, добавленные в этой сессии.
        </p>
        {payments.length === 0 ? (
          <div className="text-[13px] text-ink-4 py-8 text-center">
            Платежей пока нет в этой сессии.
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH className="w-12">#</TH>
                <TH>Дата</TH>
                <TH className="text-right">Сумма</TH>
                <TH>Статус</TH>
                <TH className="w-10"></TH>
              </TR>
            </THead>
            <tbody>
              {payments.map((p, i) => {
                const past = new Date(p.payment_date) < new Date();
                const status: {
                  tone: "green" | "yellow" | "gray";
                  label: string;
                } = p.delayed
                  ? { tone: "yellow", label: "задержан" }
                  : past
                  ? { tone: "green", label: "оплачен" }
                  : { tone: "gray", label: "запланирован" };
                return (
                  <TR key={p.id}>
                    <TD className="text-ink-3 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </TD>
                    <TD className="text-ink-2 tabular-nums">
                      {formatDate(p.payment_date)}
                    </TD>
                    <TD className="text-right font-medium tabular-nums">
                      {formatCurrency(p.amount)}
                    </TD>
                    <TD>
                      <Badge tone={status.tone} dot>
                        {status.tone === "green" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {status.label}
                      </Badge>
                    </TD>
                    <TD>
                      {!isCollaborator && canManagePayments && (
                        <button
                          onClick={() => onRemovePayment(p.id)}
                          className="h-7 w-7 grid place-items-center rounded text-ink-3 hover:text-danger hover:bg-tag-red-bg/30 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </PanelBody>
    </Panel>
  );
}

// AddPaymentDialog is now defined in ./payment-dialog.tsx and imported above.

/* ------- Files tab ------- *
 *
 * Same backend limitation as payments — only POST/DELETE are exposed, no GET
 * list endpoint. Session-local list with the same disclaimer.
 */

function FilesTab({
  dealId,
  isCollaborator,
}: {
  dealId: number;
  isCollaborator: boolean;
}) {
  const [local, setLocal] = useState<DealFile[]>([]);
  const [open, setOpen] = useState(false);

  const add = useMutation({
    mutationFn: (payload: DealFileCreate) => deals.addFile(dealId, payload),
    onSuccess: (f) => {
      setLocal((prev) => [f, ...prev]);
      toast.success("Файл прикреплён.");
      setOpen(false);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  const remove = useMutation({
    mutationFn: (fileId: number) => deals.removeFile(dealId, fileId),
    onSuccess: (_, fileId) => {
      setLocal((prev) => prev.filter((f) => f.id !== fileId));
      toast.success("Файл удалён.");
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  return (
    <Panel className="anim-fade">
      <PanelHeader>
        <PanelTitle>Файлы</PanelTitle>
        {!isCollaborator && (
          <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Прикрепить
          </Button>
        )}
      </PanelHeader>
      <PanelBody>
        <p className="text-[12px] text-ink-3 mb-3">
          Backend пока не отдаёт список файлов через GET. Здесь видны только
          файлы, прикреплённые в этой сессии.
        </p>
        {local.length === 0 ? (
          <div className="text-[13px] text-ink-4 py-8 text-center">
            В этой сессии файлов пока нет.
          </div>
        ) : (
          <div className="space-y-2">
            {local.map((f) => (
              <div
                key={f.id}
                className="group flex items-start gap-3 p-3 border border-hairline rounded-md hover:border-hairline-strong transition-colors"
              >
                <div className="h-9 w-9 grid place-items-center bg-surface-2 rounded-md shrink-0">
                  <FileText className="h-4 w-4 text-ink-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={f.file}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[14px] text-ink truncate group-hover:text-accent transition-colors block"
                  >
                    {f.file_name}
                  </a>
                  {f.description && (
                    <div className="text-[12px] text-ink-3 truncate">
                      {f.description}
                    </div>
                  )}
                </div>
                <a
                  href={f.file}
                  target="_blank"
                  rel="noreferrer"
                  className="h-7 w-7 grid place-items-center rounded text-ink-3 hover:text-accent transition-colors"
                  title="Скачать"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {!isCollaborator && (
                  <button
                    onClick={() => remove.mutate(f.id)}
                    disabled={remove.isPending}
                    className="h-7 w-7 grid place-items-center rounded text-ink-3 hover:text-danger hover:bg-tag-red-bg/30 transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <AddFileDialog
          open={open}
          onOpenChange={setOpen}
          onSubmit={(values) => add.mutate(values)}
          pending={add.isPending}
        />
      </PanelBody>
    </Panel>
  );
}

function AddFileDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (values: DealFileCreate) => void;
  pending: boolean;
}) {
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader
          eyebrow="Заказ · Файл"
          title="Прикрепить файл"
          description="Backend сейчас принимает ссылку на файл — загрузка через форму FormData будет добавлена позже."
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              file_name: fileName,
              file: url,
              description: description || undefined,
            });
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Название файла">
            <Input
              placeholder="например, договор-v2.pdf"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field label="URL или путь">
            <Input
              placeholder="https://… или /media/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </Field>
          <Field label="Описание">
            <Input
              placeholder="Необязательно"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
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
              disabled={pending || !fileName || !url}
            >
              {pending ? "Сохраняем…" : "Прикрепить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------- Shared ------- */

function Money({
  k,
  v,
  accent,
}: {
  k: string;
  v: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-canvas border border-hairline rounded-lg px-5 py-4",
        accent && "bg-accent-soft border-accent/20"
      )}
    >
      <div className="text-[12px] text-ink-3 mb-1">{k}</div>
      <div
        className={cn(
          "font-display text-[24px] tabular-nums",
          accent ? "text-accent-ink" : "text-ink"
        )}
      >
        {v}
      </div>
    </div>
  );
}

function StatusBadge({ stage }: { stage: string }) {
  const m = stageLabel(stage);
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  );
}
