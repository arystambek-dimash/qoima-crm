/** Centralised Russian labels for project status & payment types. */

import type { Deal, DealStageStatus, User } from "./types";

/** Combine `user_detail.first_name` + `last_name`, fallback to username. */
export function userDisplay(u?: User): string {
  if (!u) return "";
  const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return name || u.username || u.email || "";
}

/** Best-effort client label for a deal row. Returns "" if backend has not
 *  populated user_detail yet — caller can decide what to render instead. */
export function dealClientName(d: Deal): string {
  if (d.client_name) return d.client_name;
  if (d.user_detail) return userDisplay(d.user_detail);
  // backend may inline the User on `user` itself
  if (d.user && typeof d.user === "object") return userDisplay(d.user as User);
  return "";
}

export function projectName(d: Deal): string {
  const name = d.name?.trim();
  if (name) return name;
  return dealClientName(d) || `Проект #${d.id}`;
}

export function dealClientEmail(d: Deal): string {
  if (d.client_email) return d.client_email;
  if (d.user_detail?.email) return d.user_detail.email;
  if (d.user && typeof d.user === "object") return (d.user as User).email ?? "";
  return "";
}

/** True when the deal is active and its deadline has passed. */
export function isDealOverdue(d: Deal, now = Date.now()): boolean {
  if (d.stage !== "active") return false;
  const end = new Date(d.date_end).getTime();
  if (Number.isNaN(end)) return false;
  return end < now;
}


export type DealStageLabel = {
  tone: "blue" | "green" | "red" | "gray" | "yellow";
  label: string;
};

const STAGE_LABELS: Record<string, DealStageLabel> = {
  active: { tone: "blue", label: "В процессе" },
  completed: { tone: "green", label: "Выполнено" },
  cancelled: { tone: "red", label: "Отменено" },
};

export function stageLabel(stage: string): DealStageLabel {
  return STAGE_LABELS[stage] ?? { tone: "gray", label: stage };
}

const PROJECT_STAGE_STATUS_LABELS: Record<DealStageStatus, DealStageLabel> = {
  pending: { tone: "gray", label: "Ожидает" },
  in_progress: { tone: "blue", label: "В процессе" },
  completed: { tone: "green", label: "Выполнено" },
};

export function projectStageStatusLabel(status: DealStageStatus): DealStageLabel {
  return PROJECT_STAGE_STATUS_LABELS[status] ?? { tone: "gray", label: status };
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  cash: "наличные",
  card: "карта",
  loan: "в рассрочку",
};

export function paymentTypeLabel(t: string): string {
  return PAYMENT_TYPE_LABELS[t] ?? t;
}
