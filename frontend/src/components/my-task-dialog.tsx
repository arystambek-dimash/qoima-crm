"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { asApiError } from "@/lib/api";
import { deals, onboards } from "@/lib/endpoints";
import { projectStageStatusLabel } from "@/lib/deal-labels";
import { userDisplayName } from "@/lib/user-helpers";
import { cn, formatDate, plural } from "@/lib/utils";
import { ArrowUpRight, CalendarClock, User as UserIcon } from "lucide-react";
import type {
  DashboardMyTaskItem,
  DealStageStatus,
  TaskStatus,
} from "@/lib/types";

const STAGE_STATUS_OPTIONS: { value: DealStageStatus; label: string }[] = [
  { value: "pending", label: "Ожидает" },
  { value: "in_progress", label: "В процессе" },
  { value: "completed", label: "Выполнено" },
];

const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "К выполнению" },
  { value: "in_progress", label: "В работе" },
  { value: "in_review", label: "На проверке" },
  { value: "done", label: "Готово" },
  { value: "cancelled", label: "Отменено" },
];

function dueLabel(daysLeft: number) {
  if (daysLeft < 0) {
    const days = Math.abs(daysLeft);
    return `просрочено на ${days} ${plural(days, "день", "дня", "дней")}`;
  }
  if (daysLeft === 0) return "срок сегодня";
  if (daysLeft === 1) return "срок завтра";
  return `через ${daysLeft} ${plural(daysLeft, "день", "дня", "дней")}`;
}

/**
 * Dialog for a row of the dashboard "Мои задачи" widget.
 *
 * Tasks born from a project sub-stage edit the stage itself (backend syncs the
 * task), everything else edits the task status directly.
 */
export function MyTaskDialog({
  task,
  open,
  onOpenChange,
}: {
  task: DashboardMyTaskItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {task && <MyTaskDialogBody task={task} />}
    </Dialog>
  );
}

function MyTaskDialogBody({ task }: { task: DashboardMyTaskItem }) {
  const qc = useQueryClient();
  const isStageTask = Boolean(task.deal_stage && task.deal);

  // Fresh stage data (responsible, due date, current status) from the deal.
  const dealQ = useQuery({
    queryKey: ["deal", task.deal],
    queryFn: () => deals.retrieve(task.deal!),
    enabled: !!task.deal,
  });
  const stage = isStageTask
    ? dealQ.data?.stages?.find((s) => s.id === task.deal_stage)
    : undefined;

  const stageStatus: DealStageStatus =
    stage?.status ?? (task.deal_stage_status || "pending");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["dashboard-my-tasks"] });
    qc.invalidateQueries({ queryKey: ["deals"] });
    if (task.deal) qc.invalidateQueries({ queryKey: ["deal", task.deal] });
    if (task.onboard) qc.invalidateQueries({ queryKey: ["onboard", task.onboard] });
  }

  const updateStage = useMutation({
    mutationFn: (status: DealStageStatus) =>
      deals.updateStage(task.deal!, task.deal_stage!, { status }),
    onSuccess: () => {
      invalidate();
      toast.success("Статус этапа обновлён.");
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  const updateTask = useMutation({
    mutationFn: (status: TaskStatus) =>
      onboards.updateTask(task.id, { status }),
    onSuccess: () => {
      invalidate();
      toast.success("Статус задачи обновлён.");
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  const pending = updateStage.isPending || updateTask.isPending;
  const projectTitle =
    task.deal_name || task.onboard_name || task.category_name || "Без проекта";
  const stageMeta = projectStageStatusLabel(stageStatus);
  const overdue = task.days_left < 0;

  return (
    <DialogContent className="max-w-[480px]">
      <DialogHeader
        eyebrow={
          isStageTask
            ? task.parent_stage_name
              ? `${projectTitle} · ${task.parent_stage_name}`
              : `${projectTitle} · Этап`
            : `${projectTitle} · Задача`
        }
        title={isStageTask ? task.deal_stage_name || task.name : task.name}
        description={
          isStageTask
            ? "Подэтап проекта. Смена статуса обновит карту этапов проекта."
            : "Назначенная вам задача."
        }
      />

      <div className="space-y-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-2">
          {isStageTask ? (
            <Badge tone={stageMeta.tone} dot>
              {stageMeta.label}
            </Badge>
          ) : (
            <Badge tone="gray" dot>
              {TASK_STATUS_OPTIONS.find((o) => o.value === task.status)?.label ??
                task.status}
            </Badge>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 tabular-nums",
              overdue ? "text-danger font-medium" : "text-ink-3"
            )}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDate(stage?.due_date ?? task.date_end)} · {dueLabel(task.days_left)}
          </span>
        </div>

        {isStageTask && (
          <div className="flex items-center gap-1.5 text-ink-3">
            <UserIcon className="h-3.5 w-3.5" />
            {stage?.responsible_detail
              ? userDisplayName(stage.responsible_detail)
              : dealQ.isLoading
              ? "Загружаем…"
              : "Ответственный не назначен"}
          </div>
        )}

        <div>
          <div className="text-[12px] text-ink-3 mb-1.5">
            {isStageTask ? "Статус этапа" : "Статус задачи"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {isStageTask
              ? STAGE_STATUS_OPTIONS.map((o) => (
                  <StatusChip
                    key={o.value}
                    label={o.label}
                    active={stageStatus === o.value}
                    disabled={pending}
                    onClick={() => {
                      if (stageStatus !== o.value) updateStage.mutate(o.value);
                    }}
                  />
                ))
              : TASK_STATUS_OPTIONS.map((o) => (
                  <StatusChip
                    key={o.value}
                    label={o.label}
                    active={task.status === o.value}
                    disabled={pending}
                    onClick={() => {
                      if (task.status !== o.value) updateTask.mutate(o.value);
                    }}
                  />
                ))}
          </div>
        </div>

        {isStageTask && (stage || dealQ.data) && (
          <StageSiblingsHint
            total={dealQ.data?.stages?.length ?? 0}
            completed={
              dealQ.data?.stages?.filter((s) => s.status === "completed")
                .length ?? 0
            }
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-hairline">
        {task.deal ? (
          <Link href={`/projects/${task.deal}` as never}>
            <Button variant="outline" size="md">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Открыть проект
            </Button>
          </Link>
        ) : (
          <span />
        )}
        <span className="text-[12px] text-ink-4">
          {pending ? "Сохраняем…" : ""}
        </span>
      </div>
    </DialogContent>
  );
}

function StatusChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center h-8 px-3 rounded-full text-[13px] border transition-colors disabled:opacity-50",
        active
          ? "bg-accent-soft border-accent/40 text-accent-ink font-medium"
          : "bg-canvas border-hairline-strong text-ink-2 hover:border-ink-5 hover:bg-surface-2"
      )}
    >
      {label}
    </button>
  );
}

function StageSiblingsHint({
  total,
  completed,
}: {
  total: number;
  completed: number;
}) {
  if (total === 0) return null;
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="rounded-md border border-hairline bg-surface/70 px-3 py-2.5">
      <div className="flex items-center justify-between text-[12px] mb-1.5">
        <span className="text-ink-3">
          Прогресс проекта · {completed} из {total}{" "}
          {plural(total, "этапа", "этапов", "этапов")}
        </span>
        <span className="text-ink-2 tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
