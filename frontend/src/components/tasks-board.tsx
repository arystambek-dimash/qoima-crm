"use client";

/**
 * Trello-style tasks board.
 *
 * - Columns are TaskCategories of a given Onboard.
 * - Cards are OnboardTasks belonging to a category.
 * - Dragging a card to another column patches `task.category` on the backend.
 * - The whole card is draggable (no separate handle). Tap/click without drag
 *   opens the detail modal.
 * - List-level actions: add a new column, rename, delete.
 */

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Trash2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { TaskDetailDialog } from "@/components/task-detail-dialog";
import { cn, formatDate } from "@/lib/utils";
import { asApiError } from "@/lib/api";
import { onboards } from "@/lib/endpoints";
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  approvalChip,
  resolvePriority,
  ticketKey,
  typeMeta,
} from "@/lib/task-helpers";
import type { OnboardTask, TaskCategory } from "@/lib/types";

interface TasksBoardProps {
  onboardId: number;
  categories: TaskCategory[];
  readOnly?: boolean;
  /**
   * When true, the "+ Add card" button is shown even in readOnly mode. Used
   * for collaborators, who can propose new tasks (pending approval) but
   * cannot edit categories or drag cards around.
   */
  canAddCards?: boolean;
  /** Called when user clicks "+ Add card" on a column. */
  onAddCard: (categoryId: number) => void;
}

/**
 * Custom collision detection: prefer pointer-within (more forgiving for fast
 * cursor moves) and fall back to rect intersection. This is the recommended
 * pattern in dnd-kit docs for multi-column boards.
 */
const customCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

export function TasksBoard({
  onboardId,
  categories,
  readOnly,
  canAddCards,
  onAddCard,
}: TasksBoardProps) {
  const qc = useQueryClient();
  const [activeTask, setActiveTask] = useState<OnboardTask | null>(null);
  const [detailTask, setDetailTask] = useState<OnboardTask | null>(null);

  // Pointer sensor with small activation distance — short clicks open the
  // detail modal, longer drags move the card.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor)
  );

  type CachedOnboard = {
    categories?: TaskCategory[];
    [k: string]: unknown;
  } | null;
  const onboardKey = ["onboard", onboardId];

  function findCategoryByTaskId(catList: TaskCategory[], taskId: number) {
    for (const c of catList) {
      if ((c.tasks ?? []).some((t) => t.id === taskId)) return c;
    }
    return null;
  }

  const moveTask = useMutation({
    mutationFn: ({
      taskId,
      newCategoryId,
    }: {
      taskId: number;
      newCategoryId: number;
    }) => onboards.updateTask(taskId, { category: newCategoryId }),
    onMutate: async ({ taskId, newCategoryId }) => {
      await qc.cancelQueries({ queryKey: onboardKey });
      const snapshot = qc.getQueryData<CachedOnboard>(onboardKey);
      qc.setQueryData<CachedOnboard>(onboardKey, (cur) => {
        if (!cur?.categories) return cur;
        const cats = cur.categories;
        const fromCat = findCategoryByTaskId(cats, taskId);
        if (!fromCat || fromCat.id === newCategoryId) return cur;
        const task = (fromCat.tasks ?? []).find((t) => t.id === taskId);
        if (!task) return cur;
        return {
          ...cur,
          categories: cats.map((c) => {
            if (c.id === fromCat.id) {
              return {
                ...c,
                tasks: (c.tasks ?? []).filter((t) => t.id !== taskId),
              };
            }
            if (c.id === newCategoryId) {
              return {
                ...c,
                tasks: [
                  ...(c.tasks ?? []),
                  { ...task, category: newCategoryId },
                ],
              };
            }
            return c;
          }),
        };
      });
      return { snapshot };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.snapshot !== undefined) {
        qc.setQueryData(onboardKey, ctx.snapshot);
      }
      toast.error(asApiError(err).message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: onboardKey });
      qc.invalidateQueries({ queryKey: ["onboards-for-deal"] });
    },
  });

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (!id.startsWith("task-")) return;
    const taskId = Number(id.slice("task-".length));
    const cat = findCategoryByTaskId(categories, taskId);
    const task = cat?.tasks?.find((t) => t.id === taskId);
    if (task) setActiveTask(task);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;

    const activeId = String(active.id);
    if (!activeId.startsWith("task-")) return;
    const taskId = Number(activeId.slice("task-".length));

    const overId = String(over.id);
    let newCategoryId: number | null = null;
    if (overId.startsWith("column-")) {
      newCategoryId = Number(overId.slice("column-".length));
    } else if (overId.startsWith("task-")) {
      const overCat = findCategoryByTaskId(
        categories,
        Number(overId.slice("task-".length))
      );
      if (overCat) newCategoryId = overCat.id;
    }
    if (newCategoryId == null) return;

    const fromCat = findCategoryByTaskId(categories, taskId);
    if (!fromCat || fromCat.id === newCategoryId) return;

    moveTask.mutate({ taskId, newCategoryId });
  }

  return (
    <>
      <div className="overflow-x-auto scrollbar-thin -mx-2 px-2 pb-3">
        <DndContext
          sensors={sensors}
          collisionDetection={customCollision}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveTask(null)}
        >
          <div className="flex items-start gap-3 min-w-fit">
            {categories.map((c) => (
              <CategoryColumn
                key={c.id}
                category={c}
                readOnly={readOnly}
                canAddCards={canAddCards}
                onAddCard={onAddCard}
                onOpenTask={(t) => setDetailTask(t)}
              />
            ))}
            {!readOnly && <AddColumn onboardId={onboardId} />}
          </div>

          <DragOverlay zIndex={1000}>
            {activeTask ? (
              <div className="rotate-3 shadow-pop">
                <TaskCardVisual t={activeTask} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <TaskDetailDialog
        task={detailTask}
        categories={categories}
        onboardId={onboardId}
        open={!!detailTask}
        onOpenChange={(v) => {
          if (!v) setDetailTask(null);
        }}
        readOnly={readOnly}
      />
    </>
  );
}

/* ---------------------- Column ---------------------- */

function CategoryColumn({
  category,
  readOnly,
  canAddCards,
  onAddCard,
  onOpenTask,
}: {
  category: TaskCategory;
  readOnly?: boolean;
  canAddCards?: boolean;
  onAddCard: (categoryId: number) => void;
  onOpenTask: (task: OnboardTask) => void;
}) {
  const qc = useQueryClient();
  const tasks = useMemo(() => category.tasks ?? [], [category.tasks]);
  const taskIds = useMemo(() => tasks.map((t) => `task-${t.id}`), [tasks]);

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(category.name);

  const rename = useMutation({
    mutationFn: (name: string) =>
      onboards.updateCategory(category.id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboard"] });
      qc.invalidateQueries({ queryKey: ["onboards-for-deal"] });
      qc.invalidateQueries({ queryKey: ["onboards"] });
      toast.success("Категория переименована.");
      setRenaming(false);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  const remove = useMutation({
    mutationFn: () => onboards.removeCategory(category.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboard"] });
      qc.invalidateQueries({ queryKey: ["onboards-for-deal"] });
      qc.invalidateQueries({ queryKey: ["onboards"] });
      toast.success("Категория удалена.");
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  return (
    <div className="bg-surface-2 border border-hairline rounded-xl flex flex-col w-[280px] sm:w-[300px] shrink-0 max-h-[calc(100dvh-180px)] md:max-h-[calc(100vh-280px)]">
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        {renaming ? (
          <form
            className="flex items-center gap-1 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (draftName.trim() && draftName.trim() !== category.name) {
                rename.mutate(draftName.trim());
              } else {
                setRenaming(false);
              }
            }}
          >
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => {
                if (draftName.trim() && draftName.trim() !== category.name) {
                  rename.mutate(draftName.trim());
                } else {
                  setRenaming(false);
                  setDraftName(category.name);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setRenaming(false);
                  setDraftName(category.name);
                }
              }}
              className="h-7 text-[14px] font-semibold"
            />
          </form>
        ) : (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && setRenaming(true)}
            className="flex items-center gap-2 flex-1 text-left h-7 min-w-0"
            title={readOnly ? undefined : "Переименовать"}
          >
            <span className="text-[14px] font-semibold text-ink truncate">
              {category.name}
            </span>
            <span className="text-[12px] text-ink-3 tabular-nums">
              {tasks.length}
            </span>
          </button>
        )}
        {!readOnly && !renaming && (
          <button
            type="button"
            onClick={() => {
              const msg =
                tasks.length > 0
                  ? `Удалить категорию «${category.name}» и ${tasks.length} задач(и) внутри?`
                  : `Удалить категорию «${category.name}»?`;
              if (confirm(msg)) remove.mutate();
            }}
            className="h-6 w-6 grid place-items-center rounded text-ink-4 hover:text-danger hover:bg-tag-red-bg/30 transition-colors"
            aria-label="Удалить категорию"
            title="Удалить категорию"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Cards (sortable inside the column) */}
      <SortableContext
        id={`column-${category.id}`}
        items={taskIds}
        strategy={verticalListSortingStrategy}
      >
        <ColumnDroppable id={`column-${category.id}`}>
          <div className="px-2 pb-2 flex flex-col gap-2 flex-1 overflow-y-auto scrollbar-thin">
            {tasks.length === 0 && (
              <div className="text-[13px] text-ink-4 text-center py-8 px-3 border border-dashed border-hairline rounded-md">
                Перетащите задачу сюда
              </div>
            )}
            {tasks.map((t) => (
              <SortableTaskCard
                key={t.id}
                t={t}
                readOnly={readOnly}
                onOpen={() => onOpenTask(t)}
              />
            ))}
          </div>
        </ColumnDroppable>
      </SortableContext>

      {/* Footer — Add card */}
      {(!readOnly || canAddCards) && (
        <button
          type="button"
          onClick={() => onAddCard(category.id)}
          className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-ink-3 hover:text-ink hover:bg-surface-3 transition-colors rounded-b-xl border-t border-hairline"
        >
          <Plus className="h-3.5 w-3.5" />
          {readOnly ? "Предложить задачу" : "Добавить карточку"}
        </button>
      )}
    </div>
  );
}

/* ---------------------- Droppable wrapper ---------------------- */

function ColumnDroppable({
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

/* ---------------------- Add Column ---------------------- */

function AddColumn({ onboardId }: { onboardId: number }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: (name: string) =>
      onboards.createCategory({ name, onboard: onboardId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboard"] });
      qc.invalidateQueries({ queryKey: ["onboards-for-deal"] });
      qc.invalidateQueries({ queryKey: ["onboards"] });
      toast.success("Категория создана.");
      setName("");
      setAdding(false);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="w-[280px] sm:w-[300px] shrink-0 h-10 grid place-items-center text-[13px] text-ink-3 hover:text-ink bg-surface/60 hover:bg-surface border border-dashed border-hairline-strong rounded-xl transition-colors"
      >
        <span className="inline-flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Новая категория
        </span>
      </button>
    );
  }

  return (
    <form
      className="bg-surface-2 border border-hairline-strong rounded-xl p-2 w-[280px] sm:w-[300px] shrink-0 flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) create.mutate(name.trim());
      }}
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название категории"
        className="h-8 text-[13px]"
      />
      <Button
        type="submit"
        variant="primary"
        size="icon"
        disabled={!name.trim() || create.isPending}
        title="Создать"
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => {
          setName("");
          setAdding(false);
        }}
        title="Отмена"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}

/* ---------------------- Sortable Card ---------------------- *
 *
 * The card itself is the drag handle — that's the Trello pattern. To still
 * detect clicks for opening the detail modal, we rely on dnd-kit's pointer
 * activation distance (6px). If the user moves more than 6px, it's a drag and
 * the click handler won't fire (we bail in onClick when isDragging was true).
 */

function SortableTaskCard({
  t,
  readOnly,
  onOpen,
}: {
  t: OnboardTask;
  readOnly?: boolean;
  onOpen: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${t.id}`,
    disabled: readOnly,
  });

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
        onOpen();
      }}
      className={cn(
        "touch-none select-none",
        readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
      )}
    >
      <TaskCardVisual t={t} />
    </div>
  );
}

/* ---------------------- Card visual (Trello-style) ---------------------- */

function TaskCardVisual({ t }: { t: OnboardTask }) {
  const tm = typeMeta(t.type);
  const priority = resolvePriority(t);
  const isDone = !t.is_active;
  const chip = approvalChip(t);
  const approval = t.approval_status;
  const isPendingCreate =
    approval === "pending" && t.approval_action !== "cancel";
  const isPendingCancel =
    approval === "pending" && t.approval_action === "cancel";
  const isRejected = approval === "rejected";
  const isCancelled = approval === "cancelled" || t.status === "cancelled";

  // Trello-style: chunky colored labels at the top of the card.
  const labels: { color: string; tooltip: string }[] = [
    { color: LABEL_COLORS[tm.tone] ?? "#9b9a94", tooltip: tm.label },
    {
      color: PRIORITY_LABEL_COLOR[priority],
      tooltip: PRIORITY_LABEL[priority],
    },
  ];

  return (
    <div
      className={cn(
        "group relative bg-canvas border border-hairline rounded-md p-2.5 hover:border-hairline-strong hover:shadow-card transition-all",
        isDone && "opacity-70",
        isPendingCreate && "border-warn/40 ring-1 ring-warn/20",
        isPendingCancel && "border-orange-400/40 ring-1 ring-orange-300/20",
        isRejected && "border-danger/40 ring-1 ring-danger/20",
        isCancelled && "opacity-60"
      )}
    >
      {/* Top labels */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {labels.map((l, i) => (
          <span
            key={i}
            title={l.tooltip}
            className="h-2 min-w-[36px] rounded-sm"
            style={{ background: l.color }}
          />
        ))}
        {isDone && (
          <span
            className="h-2 min-w-[36px] rounded-sm bg-success"
            title="Выполнено"
          />
        )}
      </div>

      {chip && chip.short !== "одобрено" && (
        <div className="mb-2">
          <Badge tone={chip.tone} className="text-[11px]">
            {chip.short}
          </Badge>
        </div>
      )}

      {/* Title */}
      <div
        className={cn(
          "text-[14px] leading-snug font-medium text-ink",
          isDone && "line-through text-ink-3"
        )}
      >
        {t.name}
      </div>

      {/* Sub-labels for hover detail */}
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        <Badge tone={tm.tone} className="text-[11px]">
          <span>{tm.emoji}</span>
          {tm.label}
        </Badge>
        <Badge tone={PRIORITY_TONE[priority]} className="text-[11px]">
          {PRIORITY_LABEL[priority]}
        </Badge>
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-ink-4">
          <span className="font-mono tabular-nums">{ticketKey(t)}</span>
          <span className="tabular-nums">
            {formatDate(t.date_end, { month: "short", day: "2-digit" })}
          </span>
        </div>
        <AssigneeStack task={t} />
      </div>
    </div>
  );
}

function AssigneeStack({ task }: { task: OnboardTask }) {
  // Prefer performance[] (real backend), fall back to legacy single assignee.
  const items: { id: number; name: string }[] = [];
  if (task.performance && task.performance.length > 0) {
    for (const p of task.performance) {
      const u = p.user_detail;
      const name = u
        ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
          u.username ||
          `User #${p.user}`
        : `User #${p.user}`;
      items.push({ id: p.user, name });
    }
  } else if (task.assignee) {
    items.push({ id: task.assignee.id, name: task.assignee.name });
  }
  if (items.length === 0) return null;
  const visible = items.slice(0, 3);
  const extra = items.length - visible.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((it) => (
        <Avatar
          key={it.id}
          name={it.name}
          size={22}
          className="text-[10px] ring-2 ring-canvas"
        />
      ))}
      {extra > 0 && (
        <span className="h-[22px] min-w-[22px] px-1.5 grid place-items-center rounded-full bg-surface-3 text-[10px] font-medium text-ink-3 ring-2 ring-canvas">
          +{extra}
        </span>
      )}
    </div>
  );
}

/* ---------------------- Constants ---------------------- */

const LABEL_COLORS: Record<string, string> = {
  blue: "#2383E2",
  green: "#3D9C47",
  purple: "#7C5CC4",
  orange: "#E08A3A",
  gray: "#9B9A94",
  red: "#D8473A",
  yellow: "#C5A23E",
  brown: "#A87A55",
  pink: "#C95A8B",
};

const PRIORITY_LABEL_COLOR = {
  urgent: "#D8473A",
  high: "#E08A3A",
  medium: "#C5A23E",
  low: "#9B9A94",
};
