import type {
  OnboardTask,
  TaskApprovalStatus,
  TaskAuditAction,
  TaskPriority,
  TaskStatus,
} from "./types";

export const TASK_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "К выполнению" },
  { key: "in_progress", label: "В работе" },
  { key: "in_review", label: "На проверке" },
  { key: "done", label: "Готово" },
];

export function resolveStatus(t: OnboardTask): TaskStatus {
  if (t.status) return t.status;
  // Fallback for backend rows without a status field
  return t.is_active ? "todo" : "done";
}

export function resolvePriority(t: OnboardTask): TaskPriority {
  return t.priority ?? "medium";
}

export const STATUS_TONE: Record<
  TaskStatus,
  "gray" | "blue" | "purple" | "green"
> = {
  todo: "gray",
  in_progress: "blue",
  in_review: "purple",
  done: "green",
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "#9b9a94",
  in_progress: "#2383e2",
  in_review: "#7c5cc4",
  done: "#3d9c47",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

export const PRIORITY_TONE: Record<TaskPriority, "gray" | "yellow" | "orange" | "red"> = {
  low: "gray",
  medium: "yellow",
  high: "orange",
  urgent: "red",
};

/**
 * Issue type → emoji + tone. Matches Jira's "Story / Task / Bug / Epic" idea
 * but keeps backend's free-form `type` string. Recognizes common categories;
 * unknown types render as a neutral "task" icon.
 */
export function typeMeta(type: string): {
  emoji: string;
  label: string;
  tone: "blue" | "green" | "purple" | "orange" | "gray" | "red";
} {
  const k = type.toLowerCase();
  if (["research", "discovery"].includes(k))
    return { emoji: "🔍", label: type, tone: "purple" };
  if (["deliverable", "design"].includes(k))
    return { emoji: "✦", label: type, tone: "blue" };
  if (["infra", "data", "integration"].includes(k))
    return { emoji: "⚙", label: type, tone: "gray" };
  if (k === "qa" || k === "review" || k === "compliance")
    return { emoji: "✓", label: type, tone: "green" };
  if (k === "training" || k === "rollout")
    return { emoji: "▸", label: type, tone: "orange" };
  return { emoji: "•", label: type, tone: "gray" };
}

/**
 * Build a Jira-like issue key. We don't have a real project key from the
 * backend yet, so synthesize one from category id + task id.
 */
export function ticketKey(t: OnboardTask): string {
  return `QOI-${String(t.id).padStart(3, "0")}`;
}

/* -------------------- Approval status -------------------- */

export const APPROVAL_LABEL: Record<TaskApprovalStatus, string> = {
  pending: "Ожидает одобрения",
  approved: "Одобрено",
  rejected: "Отклонено",
  cancelled: "Отменено",
};

export const APPROVAL_SHORT: Record<TaskApprovalStatus, string> = {
  pending: "ожидает",
  approved: "одобрено",
  rejected: "отклонено",
  cancelled: "отменено",
};

export const APPROVAL_TONE: Record<
  TaskApprovalStatus,
  "yellow" | "green" | "red" | "gray"
> = {
  pending: "yellow",
  approved: "green",
  rejected: "red",
  cancelled: "gray",
};

export function resolveApprovalStatus(
  t: OnboardTask
): TaskApprovalStatus | null {
  return t.approval_status ?? null;
}

/* -------------------- Audit log -------------------- */

export const AUDIT_LABEL: Record<string, string> = {
  created: "Создана",
  updated: "Обновлена",
  approved: "Одобрена",
  rejected: "Отклонена",
  cancelled: "Отменена",
  assigned: "Назначен исполнитель",
  unassigned: "Снят исполнитель",
};

export function auditLabel(action: TaskAuditAction): string {
  return AUDIT_LABEL[action] ?? action;
}
