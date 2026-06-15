"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { asApiError } from "@/lib/api";
import { onboards, users } from "@/lib/endpoints";
import {
  APPROVAL_LABEL,
  APPROVAL_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  auditLabel,
  resolveApprovalStatus,
  resolvePriority,
  ticketKey,
  typeMeta,
} from "@/lib/task-helpers";
import { formatDate, cn } from "@/lib/utils";
import {
  CalendarDays,
  Check,
  CheckSquare,
  ClipboardCheck,
  History,
  Plus,
  Square,
  Tag,
  Trash2,
  User as UserIcon,
  X,
  XCircle,
} from "lucide-react";
import type {
  OnboardTask,
  TaskAuditAction,
  TaskAuditLog,
  TaskCategory,
  TaskPerformance,
} from "@/lib/types";

const TASK_TYPES = [
  "research",
  "deliverable",
  "design",
  "infra",
  "data",
  "integration",
  "qa",
  "review",
  "compliance",
  "training",
  "rollout",
];

export function TaskDetailDialog(props: {
  task: OnboardTask | null;
  categories: TaskCategory[];
  onboardId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readOnly?: boolean;
}) {
  // Re-mount the inner editor whenever the task changes — this resets all
  // local state to the new task's values without needing useEffect+setState.
  return (
    <TaskDetailInner key={props.task?.id ?? "none"} {...props} />
  );
}

function TaskDetailInner({
  task,
  categories,
  onboardId,
  open,
  onOpenChange,
  readOnly,
}: {
  task: OnboardTask | null;
  categories: TaskCategory[];
  onboardId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();

  // Local edit state seeded from props on mount only.
  const [name, setName] = useState(task?.name ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [type, setType] = useState(task?.type ?? "deliverable");
  const [dateStart, setDateStart] = useState(task?.date_start ?? "");
  const [dateEnd, setDateEnd] = useState(task?.date_end ?? "");
  const [categoryId, setCategoryId] = useState<number>(
    task?.category ?? categories[0]?.id ?? 0
  );
  const [isActive, setIsActive] = useState(task?.is_active ?? true);

  const update = useMutation({
    mutationFn: () => {
      if (!task) throw new Error("no task");
      return onboards.updateTask(task.id, {
        name: name.trim(),
        description: description.trim(),
        type: type.trim(),
        date_start: dateStart,
        date_end: dateEnd,
        category: categoryId,
        is_active: isActive,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboard", onboardId] });
      qc.invalidateQueries({ queryKey: ["onboards-for-deal"] });
      qc.invalidateQueries({ queryKey: ["onboards"] });
      toast.success("Задача обновлена.");
      onOpenChange(false);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!task) throw new Error("no task");
      return onboards.removeTask(task.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboard", onboardId] });
      qc.invalidateQueries({ queryKey: ["onboards-for-deal"] });
      qc.invalidateQueries({ queryKey: ["onboards"] });
      toast.success("Задача удалена.");
      onOpenChange(false);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  if (!task) return null;

  const tm = typeMeta(type);
  const priority = resolvePriority(task);
  const currentCat = categories.find((c) => c.id === categoryId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px] p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-hairline">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-mono text-ink-3 tabular-nums">
              {ticketKey(task)}
            </span>
            <span className="text-ink-4">·</span>
            <span className="text-[12px] text-ink-3">
              в категории{" "}
              <strong className="text-ink-2 font-medium">
                {currentCat?.name ?? "—"}
              </strong>
            </span>
          </div>
          {readOnly ? (
            <h2 className="font-display text-[22px] tracking-tight text-ink leading-snug">
              {task.name}
            </h2>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название задачи"
              className="w-full font-display text-[22px] tracking-tight text-ink bg-transparent outline-none border-b border-transparent focus:border-accent transition-colors leading-snug"
            />
          )}
          <div className="flex items-center gap-1.5 flex-wrap mt-3">
            <Badge tone={tm.tone}>
              <span>{tm.emoji}</span>
              {tm.label}
            </Badge>
            <Badge tone={PRIORITY_TONE[priority]}>
              {PRIORITY_LABEL[priority]}
            </Badge>
            {!isActive && <Badge tone="green">выполнено</Badge>}
            {(() => {
              const approval = resolveApprovalStatus(task);
              if (!approval) return null;
              return (
                <Badge tone={APPROVAL_TONE[approval]} dot>
                  {APPROVAL_LABEL[approval]}
                </Badge>
              );
            })()}
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-[1fr_220px] gap-0">
          {/* Left — main fields */}
          <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto scrollbar-thin">
            <section>
              <label className="block text-[12px] font-medium text-ink-2 mb-1.5">
                Описание
              </label>
              {readOnly ? (
                <p className="text-[14px] text-ink-2 whitespace-pre-wrap min-h-[60px]">
                  {description || (
                    <span className="text-ink-4">Без описания</span>
                  )}
                </p>
              ) : (
                <Textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Что нужно сделать?"
                />
              )}
            </section>

            {!readOnly && (
              <section>
                <button
                  type="button"
                  onClick={() => setIsActive((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 h-9 rounded-md border text-[13px] transition-colors",
                    isActive
                      ? "border-hairline-strong text-ink-2 hover:bg-surface-2"
                      : "border-success/30 bg-tag-green-bg/40 text-tag-green-fg"
                  )}
                >
                  {isActive ? (
                    <>
                      <Square className="h-4 w-4" />
                      Отметить выполненной
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4" />
                      Выполнено
                    </>
                  )}
                </button>
              </section>
            )}

            <AuditLogList logs={task.audit_logs ?? []} />
          </div>

          {/* Right — meta */}
          <aside className="border-l border-hairline px-5 py-5 space-y-4 bg-surface/40">
            <MetaItem icon={Tag} label="Категория">
              {readOnly ? (
                <span className="text-[13px] text-ink-2">
                  {currentCat?.name ?? "—"}
                </span>
              ) : (
                <select
                  value={String(categoryId)}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="h-8 w-full bg-canvas border border-hairline-strong rounded-md px-2 text-[13px] text-ink hover:border-ink-5 cursor-pointer outline-none focus:border-accent"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </MetaItem>

            <MetaItem icon={Tag} label="Тип">
              {readOnly ? (
                <span className="text-[13px] text-ink-2 capitalize">
                  {type}
                </span>
              ) : (
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="h-8 w-full bg-canvas border border-hairline-strong rounded-md px-2 text-[13px] text-ink hover:border-ink-5 cursor-pointer outline-none focus:border-accent capitalize"
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </MetaItem>

            <MetaItem icon={CalendarDays} label="Срок">
              {readOnly ? (
                <span className="text-[13px] text-ink-2 tabular-nums">
                  {formatDate(dateEnd)}
                </span>
              ) : (
                <Input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="h-8 text-[13px]"
                />
              )}
            </MetaItem>

            <MetaItem icon={CalendarDays} label="Начало">
              {readOnly ? (
                <span className="text-[13px] text-ink-2 tabular-nums">
                  {formatDate(dateStart)}
                </span>
              ) : (
                <Input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="h-8 text-[13px]"
                />
              )}
            </MetaItem>

            <MetaItem icon={UserIcon} label="Исполнители">
              <AssigneesEditor
                taskId={task.id}
                performance={task.performance ?? []}
                fallbackAssignee={task.assignee ?? null}
                onboardId={onboardId}
                readOnly={readOnly}
              />
            </MetaItem>
          </aside>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-hairline flex items-center justify-between bg-surface/40">
          {!readOnly ? (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Удалить задачу «${task.name}»?`)) remove.mutate();
              }}
              disabled={remove.isPending}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded text-[13px] text-ink-3 hover:text-danger hover:bg-tag-red-bg/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить задачу
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-3.5 w-3.5" />
              Закрыть
            </Button>
            {!readOnly && (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => update.mutate()}
                disabled={update.isPending || !name.trim()}
              >
                <Check className="h-3.5 w-3.5" />
                {update.isPending ? "Сохраняем…" : "Сохранить"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ----- Assignees editor ----- */

function AssigneesEditor({
  taskId,
  performance,
  fallbackAssignee,
  onboardId,
  readOnly,
}: {
  taskId: number;
  performance: TaskPerformance[];
  fallbackAssignee: { id: number; name: string } | null;
  onboardId: number;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Pull the employee list for the dropdown. We only fetch when the picker is
  // open so we don't waste a request for every task open.
  const peopleQ = useQuery({
    queryKey: ["users", "employee"],
    queryFn: () => users.list("employee"),
    enabled: pickerOpen,
  });

  const assign = useMutation({
    mutationFn: (userId: number) => onboards.assign(taskId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboard", onboardId] });
      qc.invalidateQueries({ queryKey: ["onboards-for-deal"] });
      toast.success("Исполнитель назначен.");
      setPickerOpen(false);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  const unassign = useMutation({
    mutationFn: (userId: number) => onboards.unassign(taskId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboard", onboardId] });
      qc.invalidateQueries({ queryKey: ["onboards-for-deal"] });
      toast.success("Исполнитель снят.");
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  // Resolve a display object per assignment. Prefer backend-provided
  // `user_detail`, fall back to legacy `assignee` object (mock data), then
  // a synthetic "User #ID" string.
  const items = performance.map((p) => {
    const u = p.user_detail;
    const name = u
      ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
        u.username ||
        u.email ||
        `User #${p.user}`
      : `User #${p.user}`;
    return { id: p.user, name, email: u?.email };
  });
  // When performance is empty but legacy mock assignee exists, show it.
  if (items.length === 0 && fallbackAssignee) {
    items.push({
      id: fallbackAssignee.id,
      name: fallbackAssignee.name,
      email: undefined,
    });
  }

  const assignedIds = new Set(items.map((i) => i.id));
  const availableEmployees =
    peopleQ.data?.filter((u) => !assignedIds.has(u.id)) ?? [];

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <span className="text-[12px] text-ink-4">Не назначен</span>
      )}
      <ul className="flex flex-col gap-1.5">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-2 px-2 h-8 rounded-md bg-canvas border border-hairline group"
          >
            <Avatar name={it.name} size={20} className="text-[10px]" />
            <span className="flex-1 text-[13px] text-ink truncate">
              {it.name}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => unassign.mutate(it.id)}
                disabled={unassign.isPending}
                className="h-5 w-5 grid place-items-center rounded text-ink-4 hover:text-danger hover:bg-tag-red-bg/30 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Снять с задачи"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {!readOnly && (
        <>
          {!pickerOpen ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 h-7 px-2 rounded text-[12px] text-ink-3 hover:text-ink hover:bg-surface-2 border border-dashed border-hairline-strong transition-colors"
            >
              <Plus className="h-3 w-3" />
              Назначить
            </button>
          ) : (
            <div className="rounded-md border border-hairline-strong bg-canvas shadow-card overflow-hidden">
              <div className="px-2 py-1 border-b border-hairline flex items-center justify-between">
                <span className="text-[11px] text-ink-3">Выберите сотрудника</span>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="h-5 w-5 grid place-items-center rounded text-ink-4 hover:text-ink hover:bg-surface-2"
                  title="Закрыть"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {peopleQ.isLoading ? (
                <div className="text-[12px] text-ink-3 px-3 py-3 text-center">
                  Загружаем…
                </div>
              ) : peopleQ.isError ? (
                <div className="text-[12px] text-danger px-3 py-3 text-center">
                  Ошибка загрузки списка
                </div>
              ) : availableEmployees.length === 0 ? (
                <div className="text-[12px] text-ink-4 px-3 py-3 text-center">
                  Все сотрудники уже назначены
                </div>
              ) : (
                <ul className="max-h-[200px] overflow-y-auto scrollbar-thin py-1">
                  {availableEmployees.map((u) => {
                    const name =
                      `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
                      u.username;
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => assign.mutate(u.id)}
                          disabled={assign.isPending}
                          className="w-full flex items-center gap-2 px-2 h-8 text-[13px] text-left hover:bg-surface-2 transition-colors disabled:opacity-50"
                        >
                          <Avatar name={name} size={20} className="text-[10px]" />
                          <span className="flex-1 text-ink truncate">
                            {name}
                          </span>
                          {u.email && (
                            <span className="text-[11px] text-ink-4 truncate max-w-[120px]">
                              {u.email}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mb-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      {children}
    </div>
  );
}

/* ----- Audit log ----- */

function AuditLogList({ logs }: { logs: TaskAuditLog[] }) {
  if (logs.length === 0) return null;

  const sorted = [...logs].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <section>
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2 mb-2">
        <History className="h-3.5 w-3.5" />
        История
      </div>
      <ol className="relative space-y-3 border-l border-hairline pl-4">
        {sorted.map((log) => (
          <AuditLogItem key={log.id} log={log} />
        ))}
      </ol>
    </section>
  );
}

const AUDIT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  updated: Tag,
  approved: ClipboardCheck,
  rejected: XCircle,
  cancelled: X,
  assigned: UserIcon,
  unassigned: UserIcon,
};

const AUDIT_COLOR: Record<string, string> = {
  created: "text-tag-blue-fg bg-tag-blue-bg",
  updated: "text-ink-3 bg-surface-2",
  approved: "text-tag-green-fg bg-tag-green-bg",
  rejected: "text-tag-red-fg bg-tag-red-bg",
  cancelled: "text-ink-3 bg-surface-2",
  assigned: "text-tag-purple-fg bg-tag-purple-bg",
  unassigned: "text-ink-3 bg-surface-2",
};

function AuditLogItem({ log }: { log: TaskAuditLog }) {
  const Icon = AUDIT_ICON[log.action] ?? History;
  const color = AUDIT_COLOR[log.action] ?? "text-ink-3 bg-surface-2";
  const who =
    log.actor_detail
      ? `${log.actor_detail.first_name ?? ""} ${log.actor_detail.last_name ?? ""}`.trim() ||
        log.actor_detail.username ||
        log.actor_detail.email ||
        `User #${log.actor_detail.id}`
      : log.actor != null
      ? `User #${log.actor}`
      : "Система";

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[26px] top-0.5 h-5 w-5 grid place-items-center rounded-full",
          color
        )}
      >
        <Icon className="h-3 w-3" />
      </span>
      <div className="text-[12px]">
        <span className="text-ink font-medium">{auditLabel(log.action as TaskAuditAction)}</span>
        <span className="text-ink-3"> · {who}</span>
      </div>
      {log.message && (
        <p className="text-[12px] text-ink-2 mt-0.5 whitespace-pre-wrap">
          {log.message}
        </p>
      )}
      <time className="block text-[11px] text-ink-4 tabular-nums mt-0.5">
        {formatAuditTime(log.created_at)}
      </time>
    </li>
  );
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
