"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Topbar } from "@/components/app-shell/topbar";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Table, THead, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deals } from "@/lib/endpoints";
import { asApiError } from "@/lib/api";
import {
  useCurrentUser,
  useRole,
  useIsSuperuser,
  useHasPermission,
} from "@/lib/permissions";
import { useNow } from "@/lib/use-now";
import { DealFormDialog } from "./deal-form-dialog";
import { formatCurrency, formatDate, cn, plural } from "@/lib/utils";
import {
  paymentTypeLabel as plLabel,
  stageLabel,
  dealClientName,
  dealClientEmail,
  isDealOverdue,
} from "@/lib/deal-labels";
import {
  Search,
  ChevronRight,
  Briefcase,
  Plus,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import type { Deal } from "@/lib/types";

type StatusFilter = "all" | "active" | "completed" | "cancelled";
type View = "table" | "board";
type SortKey = "client" | "stage" | "amount" | "paid" | "deadline";
type SortDir = "asc" | "desc";

export default function DealsPage() {
  const role = useRole();
  const user = useCurrentUser();
  const isSuper = useIsSuperuser();
  const canCreate = useHasPermission("deals_can_create");
  const canUpdate = useHasPermission("deals_can_update");
  const now = useNow();

  const canCreateDeal =
    isSuper || role === "collaborator" || canCreate.granted;
  const canMoveStage = isSuper || canUpdate.granted;

  const scopedToMine = role === "collaborator" && !isSuper;
  const dealsQ = useQuery({
    queryKey: scopedToMine ? ["deals", "mine", user?.id] : ["deals"],
    queryFn: () =>
      scopedToMine && user ? deals.listForUser(user.id) : deals.list(),
    enabled: !!user,
  });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [view, setView] = useState<View>("table");
  const [sortKey, setSortKey] = useState<SortKey>("deadline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const allDeals = useMemo(() => dealsQ.data ?? [], [dealsQ.data]);

  const counts = useMemo(
    () => ({
      all: allDeals.length,
      active: allDeals.filter((d) => d.stage === "active").length,
      completed: allDeals.filter((d) => d.stage === "completed").length,
      cancelled: allDeals.filter((d) => d.stage === "cancelled").length,
    }),
    [allDeals]
  );

  const filtered = useMemo(() => {
    let list = allDeals;
    if (status !== "all") list = list.filter((d) => d.stage === status);
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((d) => {
        const name = dealClientName(d).toLowerCase();
        const email = dealClientEmail(d).toLowerCase();
        return (
          name.includes(term) ||
          email.includes(term) ||
          String(d.id).includes(term)
        );
      });
    }
    return list;
  }, [allDeals, q, status]);

  const sorted = useMemo(
    () => sortDeals(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  );

  const totalValue = filtered.reduce((a, d) => a + Number(d.deal_amount), 0);
  const paidValue = filtered.reduce(
    (a, d) => a + Number(d.paid_to_date ?? 0),
    0
  );

  const isCollaborator = scopedToMine;

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir(k === "amount" || k === "paid" ? "desc" : "asc");
    }
  }

  // True when ANY deal in the data has client info / paid amounts. We hide
  // those columns when nobody has data (no point in showing dashes).
  const hasClientData = useMemo(
    () => allDeals.some((d) => dealClientName(d) || dealClientEmail(d)),
    [allDeals]
  );
  const hasPaidData = useMemo(
    () => allDeals.some((d) => d.paid_to_date != null),
    [allDeals]
  );

  return (
    <>
      <Topbar
        eyebrow={isCollaborator ? "Мои заказы" : "Работа"}
        title={isCollaborator ? "Ваши заказы" : "Заказы"}
        actions={
          canCreateDeal ? (
            <DealFormDialog
              trigger={
                <Button variant="primary" size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  Новый заказ
                </Button>
              }
            />
          ) : undefined
        }
      />

      <main className="flex-1 px-6 lg:px-10 py-10 max-w-[1280px] mx-auto w-full">
        <header className="mb-8 anim-rise">
          <h1 className="font-display text-[28px] tracking-tight text-ink">
            {isCollaborator ? "Ваши заказы" : "Заказы"}
          </h1>
          <p className="mt-2 text-[14px] text-ink-3">
            {isCollaborator
              ? "Следите за выполнением каждого договора. Откройте заказ, чтобы увидеть задачи."
              : "Все подписанные договоры и заказы. У каждого свой план задач и график платежей."}
          </p>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger">
          <Stat label="Всего заказов" value={String(filtered.length)} />
          <Stat label="Активные" value={String(counts.active)} />
          <Stat label="Общая сумма" value={formatCurrency(totalValue)} />
          <Stat label="Оплачено" value={formatCurrency(paidValue)} accent />
        </section>

        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4 anim-fade">
          <div className="flex items-center gap-2 flex-1 max-w-md relative">
            <Search className="absolute left-3 h-4 w-4 text-ink-4 pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по клиенту, email или #ID"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-surface-2 border border-hairline rounded-md p-0.5">
              <StatusChip
                active={status === "all"}
                onClick={() => setStatus("all")}
                label="Все"
                count={counts.all}
              />
              <StatusChip
                active={status === "active"}
                onClick={() => setStatus("active")}
                label="Активные"
                count={counts.active}
              />
              <StatusChip
                active={status === "completed"}
                onClick={() => setStatus("completed")}
                label="Выполненные"
                count={counts.completed}
              />
              {!isCollaborator && (
                <StatusChip
                  active={status === "cancelled"}
                  onClick={() => setStatus("cancelled")}
                  label="Отменённые"
                  count={counts.cancelled}
                />
              )}
            </div>
            <div className="flex bg-surface-2 border border-hairline rounded-md p-0.5">
              <ViewChip
                active={view === "table"}
                onClick={() => setView("table")}
                icon={ListIcon}
                label="Таблица"
              />
              <ViewChip
                active={view === "board"}
                onClick={() => setView("board")}
                icon={LayoutGrid}
                label="Доска"
              />
            </div>
          </div>
        </section>

        {/* Body */}
        {allDeals.length === 0 && !dealsQ.isLoading ? (
          <EmptyDeals
            isCollaborator={isCollaborator}
            canCreate={canCreateDeal}
          />
        ) : sorted.length === 0 ? (
          <NoMatch
            onReset={() => {
              setQ("");
              setStatus("all");
            }}
            isCollaborator={isCollaborator}
          />
        ) : view === "table" ? (
          <Panel className="anim-fade">
            <PanelHeader>
              <PanelTitle>
                {status === "all" ? "Все заказы" : labelFor(status)}
              </PanelTitle>
              <span className="text-[12px] text-ink-3">
                {sorted.length}{" "}
                {plural(sorted.length, "заказ", "заказа", "заказов")}
              </span>
            </PanelHeader>
            <Table>
              <THead>
                <TR>
                  <SortableHeader
                    label={hasClientData ? "Клиент / заказ" : "Заказ"}
                    sortKey="client"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortableHeader
                    label="Статус"
                    sortKey="stage"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <TH>Оплата</TH>
                  <SortableHeader
                    label="Сумма"
                    sortKey="amount"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                  {hasPaidData && (
                    <SortableHeader
                      label="Оплачено"
                      sortKey="paid"
                      activeKey={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                      align="right"
                    />
                  )}
                  <SortableHeader
                    label="Срок"
                    sortKey="deadline"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <TH className="w-10"></TH>
                </TR>
              </THead>
              <tbody>
                {sorted.map((d) => (
                  <DealRow
                    key={d.id}
                    d={d}
                    now={now}
                    hasClientData={hasClientData}
                    hasPaidData={hasPaidData}
                  />
                ))}
              </tbody>
            </Table>
          </Panel>
        ) : (
          <BoardView
            deals={sorted}
            readOnly={!canMoveStage}
            now={now}
            includeCancelled={!isCollaborator}
          />
        )}
      </main>
    </>
  );
}

/* ---------------- Sort helpers ---------------- */

function sortDeals(list: Deal[], key: SortKey, dir: SortDir): Deal[] {
  const mul = dir === "asc" ? 1 : -1;
  const arr = [...list];
  arr.sort((a, b) => {
    switch (key) {
      case "client": {
        const an = (dealClientName(a) || `#${a.id}`).toLowerCase();
        const bn = (dealClientName(b) || `#${b.id}`).toLowerCase();
        return an.localeCompare(bn) * mul;
      }
      case "stage":
        return a.stage.localeCompare(b.stage) * mul;
      case "amount":
        return (Number(a.deal_amount) - Number(b.deal_amount)) * mul;
      case "paid":
        return (
          (Number(a.paid_to_date ?? 0) - Number(b.paid_to_date ?? 0)) * mul
        );
      case "deadline":
      default:
        return (
          (new Date(a.date_end).getTime() - new Date(b.date_end).getTime()) *
          mul
        );
    }
  });
  return arr;
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  align,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "right";
}) {
  const isActive = activeKey === sortKey;
  return (
    <TH className={cn(align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-ink transition-colors",
          align === "right" && "flex-row-reverse",
          isActive && "text-ink-2 font-medium"
        )}
      >
        {label}
        {isActive ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TH>
  );
}

/* ---------------- Chips ---------------- */

function StatusChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 inline-flex items-center gap-1.5 text-[13px] rounded transition-colors",
        active
          ? "bg-canvas text-ink shadow-sm font-medium"
          : "text-ink-3 hover:text-ink"
      )}
    >
      {label}
      <span
        className={cn(
          "text-[11px] tabular-nums",
          active ? "text-ink-3" : "text-ink-4"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ViewChip({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 inline-flex items-center gap-1.5 text-[13px] rounded transition-colors",
        active
          ? "bg-canvas text-ink shadow-sm font-medium"
          : "text-ink-3 hover:text-ink"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ---------------- Stat tile ---------------- */

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-canvas border border-hairline rounded-lg px-4 py-3",
        accent && "bg-accent-soft border-accent/20"
      )}
    >
      <div className="text-[12px] text-ink-3 mb-1">{label}</div>
      <div
        className={cn(
          "font-display text-[22px] tabular-nums",
          accent ? "text-accent-ink" : "text-ink"
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ---------------- Table row ---------------- */

function DealRow({
  d,
  now,
  hasClientData,
  hasPaidData,
}: {
  d: Deal;
  now: number;
  hasClientData: boolean;
  hasPaidData: boolean;
}) {
  const router = useRouter();
  const name = dealClientName(d);
  const email = dealClientEmail(d);
  const progress = computeProgress(d);
  const overdue = now > 0 && isDealOverdue(d, now);

  return (
    <TR
      className="cursor-pointer"
      onClick={() => router.push(`/deals/${d.id}` as never)}
    >
      <TD>
        <div className="flex flex-col leading-tight">
          {hasClientData && name ? (
            <span className="text-ink font-medium">{name}</span>
          ) : (
            <span className="text-ink font-medium">Заказ #{d.id}</span>
          )}
          {hasClientData && email ? (
            <span className="text-[12px] text-ink-3">{email}</span>
          ) : (
            <span className="text-[12px] text-ink-3 font-mono tabular-nums">
              открыт {formatDate(d.date_start, { month: "short", day: "2-digit" })}
            </span>
          )}
        </div>
      </TD>
      <TD>
        <StatusBadge stage={d.stage} />
      </TD>
      <TD>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge tone="gray">{plLabel(d.payment_type)}</Badge>
          {d.payment_completed && <Badge tone="green">оплачено</Badge>}
        </div>
      </TD>
      <TD className="text-right font-medium tabular-nums">
        {formatCurrency(d.deal_amount)}
      </TD>
      {hasPaidData && (
        <TD className="text-right tabular-nums">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-ink-2">
              {formatCurrency(d.paid_to_date)}
            </span>
            <ProgressBar pct={progress} />
          </div>
        </TD>
      )}
      <TD>
        <span
          className={cn(
            "tabular-nums inline-flex items-center gap-1.5",
            overdue ? "text-danger font-medium" : "text-ink-3"
          )}
        >
          {overdue && <AlertTriangle className="h-3 w-3" />}
          {formatDate(d.date_end)}
        </span>
      </TD>
      <TD>
        <ChevronRight className="h-4 w-4 text-ink-4 mx-auto" />
      </TD>
    </TR>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-[80px] h-1 bg-surface-3 rounded-full overflow-hidden mt-1">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          pct >= 100 ? "bg-success" : "bg-accent"
        )}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
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

function labelFor(s: StatusFilter): string {
  const map: Record<StatusFilter, string> = {
    all: "Все",
    active: "Активные",
    completed: "Выполненные",
    cancelled: "Отменённые",
  };
  return map[s];
}

function computeProgress(d: Deal): number {
  const total = Number(d.deal_amount);
  const paid = Number(d.paid_to_date ?? 0);
  if (total <= 0) return 0;
  return Math.min(Math.round((paid / total) * 100), 100);
}

/* ---------------- Empty states ---------------- */

function EmptyDeals({
  isCollaborator,
  canCreate,
}: {
  isCollaborator: boolean;
  canCreate: boolean;
}) {
  return (
    <Panel className="p-14 text-center anim-fade">
      <div className="mx-auto h-12 w-12 grid place-items-center bg-surface-2 rounded-lg mb-3">
        <Briefcase className="h-5 w-5 text-ink-3" />
      </div>
      <h3 className="font-display text-[20px] text-ink mb-1.5">
        {isCollaborator ? "Заказов пока нет" : "В системе нет заказов"}
      </h3>
      <p className="text-[14px] text-ink-3 mb-5 max-w-[44ch] mx-auto">
        {isCollaborator
          ? "Как только мы подпишем договор — он появится здесь со всеми задачами и платежами."
          : "Создайте первый заказ — это займёт пару кликов. Можно сразу завести клиенту аккаунт."}
      </p>
      {canCreate && (
        <DealFormDialog
          trigger={
            <Button variant="primary" size="md">
              <Plus className="h-3.5 w-3.5" />
              Новый заказ
            </Button>
          }
        />
      )}
    </Panel>
  );
}

function NoMatch({
  onReset,
  isCollaborator,
}: {
  onReset: () => void;
  isCollaborator: boolean;
}) {
  return (
    <Panel className="p-12 text-center anim-fade">
      <div className="mx-auto h-12 w-12 grid place-items-center bg-surface-2 rounded-lg mb-3">
        <Search className="h-5 w-5 text-ink-3" />
      </div>
      <h3 className="font-display text-[20px] text-ink mb-1.5">
        Ничего не найдено
      </h3>
      <p className="text-[14px] text-ink-3 mb-5">
        {isCollaborator
          ? "Поменяйте фильтр или сбросьте поиск."
          : "Попробуйте другой поисковый запрос или сбросьте фильтры."}
      </p>
      <Button variant="outline" size="md" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" />
        Сбросить фильтры
      </Button>
    </Panel>
  );
}

/* ============================================================
 * BOARD VIEW — Trello-style columns by stage
 * ============================================================ */

const BOARD_STAGES: { key: string; label: string }[] = [
  { key: "active", label: "Активные" },
  { key: "completed", label: "Выполненные" },
  { key: "cancelled", label: "Отменённые" },
];

const customCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return rectIntersection(args);
};

function BoardView({
  deals: list,
  readOnly,
  now,
  includeCancelled,
}: {
  deals: Deal[];
  readOnly: boolean;
  now: number;
  includeCancelled: boolean;
}) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const activeDeal = list.find((d) => d.id === activeId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const columns = useMemo(() => {
    const stages = includeCancelled
      ? BOARD_STAGES
      : BOARD_STAGES.filter((s) => s.key !== "cancelled");
    return stages.map((s) => ({
      ...s,
      deals: list.filter((d) => d.stage === s.key),
    }));
  }, [list, includeCancelled]);

  const moveStage = useMutation({
    mutationFn: ({
      dealId,
      newStage,
    }: {
      dealId: number;
      newStage: string;
    }) =>
      deals.update(dealId, {
        stage: newStage,
        // Optional flags: keep is_active in sync with stage.
      } as never),
    onMutate: async ({ dealId, newStage }) => {
      await qc.cancelQueries({ queryKey: ["deals"] });
      const prev = qc.getQueryData<Deal[]>(["deals"]);
      if (prev) {
        qc.setQueryData<Deal[]>(
          ["deals"],
          prev.map((d) =>
            d.id === dealId
              ? { ...d, stage: newStage, is_active: newStage === "active" }
              : d
          )
        );
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["deals"], ctx.prev);
      toast.error(asApiError(err).message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
  });

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (!id.startsWith("deal-")) return;
    setActiveId(Number(id.slice("deal-".length)));
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeStr = String(active.id);
    if (!activeStr.startsWith("deal-")) return;
    const dealId = Number(activeStr.slice("deal-".length));

    const overStr = String(over.id);
    let newStage: string | null = null;
    if (overStr.startsWith("stage-")) {
      newStage = overStr.slice("stage-".length);
    } else if (overStr.startsWith("deal-")) {
      const target = list.find(
        (d) => d.id === Number(overStr.slice("deal-".length))
      );
      if (target) newStage = target.stage;
    }
    if (!newStage) return;
    const deal = list.find((d) => d.id === dealId);
    if (!deal || deal.stage === newStage) return;
    moveStage.mutate({ dealId, newStage });
  }

  return (
    <div className="overflow-x-auto scrollbar-thin -mx-2 px-2 pb-3 anim-fade">
      <DndContext
        sensors={sensors}
        collisionDetection={customCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex items-start gap-3 min-w-fit">
          {columns.map((col) => (
            <BoardColumn
              key={col.key}
              stageKey={col.key}
              label={col.label}
              deals={col.deals}
              readOnly={readOnly}
              now={now}
            />
          ))}
        </div>
        <DragOverlay zIndex={1000}>
          {activeDeal ? (
            <div className="rotate-3 shadow-pop">
              <DealCardVisual d={activeDeal} now={now} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function BoardColumn({
  stageKey,
  deals: list,
  readOnly,
  now,
}: {
  stageKey: string;
  /** Reserved — backend stage key is what we badge on. */
  label?: string;
  deals: Deal[];
  readOnly: boolean;
  now: number;
}) {
  const total = list.reduce((a, d) => a + Number(d.deal_amount), 0);
  return (
    <div className="bg-surface-2 border border-hairline rounded-xl flex flex-col w-[320px] shrink-0 max-h-[calc(100vh-280px)]">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge stage={stageKey} />
          <span className="text-[12px] text-ink-3 tabular-nums">
            {list.length}
          </span>
        </div>
        <span className="text-[11px] text-ink-3 tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
      <SortableContext
        id={`stage-${stageKey}`}
        items={list.map((d) => `deal-${d.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <StageDroppable id={`stage-${stageKey}`}>
          <div className="px-2 pb-3 flex flex-col gap-2 flex-1 overflow-y-auto scrollbar-thin">
            {list.length === 0 && (
              <div className="text-[13px] text-ink-4 text-center py-8 px-3 border border-dashed border-hairline rounded-md">
                Перетащите заказ сюда
              </div>
            )}
            {list.map((d) => (
              <SortableDealCard
                key={d.id}
                d={d}
                readOnly={readOnly}
                now={now}
              />
            ))}
          </div>
        </StageDroppable>
      </SortableContext>
    </div>
  );
}

function StageDroppable({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-h-[60px] transition-colors rounded-md",
        isOver && "bg-accent-soft/40"
      )}
    >
      {children}
    </div>
  );
}

function SortableDealCard({
  d,
  readOnly,
  now,
}: {
  d: Deal;
  readOnly: boolean;
  now: number;
}) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `deal-${d.id}`, disabled: readOnly });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (isDragging) return;
        router.push(`/deals/${d.id}` as never);
      }}
      className={cn(
        "touch-none select-none",
        readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
      )}
    >
      <DealCardVisual d={d} now={now} />
    </div>
  );
}

function DealCardVisual({ d, now }: { d: Deal; now: number }) {
  const name = dealClientName(d) || `Заказ #${d.id}`;
  const overdue = now > 0 && isDealOverdue(d, now);
  const progress = computeProgress(d);

  return (
    <div className="bg-canvas border border-hairline rounded-md p-3 hover:border-hairline-strong hover:shadow-card transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-ink leading-snug truncate">
            {name}
          </div>
          {d.user_detail?.email && (
            <div className="text-[11px] text-ink-3 truncate">
              {d.user_detail.email}
            </div>
          )}
        </div>
        <span className="text-[10px] font-mono text-ink-4 tabular-nums shrink-0 mt-0.5">
          #{d.id}
        </span>
      </div>

      <div className="font-display text-[20px] tabular-nums text-ink leading-none mb-2">
        {formatCurrency(d.deal_amount)}
      </div>

      {d.paid_to_date != null && (
        <ProgressBar pct={progress} />
      )}

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <Badge tone="gray">{plLabel(d.payment_type)}</Badge>
        <span
          className={cn(
            "tabular-nums inline-flex items-center gap-1",
            overdue ? "text-danger font-medium" : "text-ink-4"
          )}
        >
          {overdue && <AlertTriangle className="h-3 w-3" />}
          {formatDate(d.date_end, { month: "short", day: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
