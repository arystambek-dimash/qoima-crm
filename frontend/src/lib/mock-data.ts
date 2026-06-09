/**
 * Spending category suggestions for the form. Backend stores `type` as a
 * free-form CharField so users can also enter custom values.
 *
 * Note: all other previously-mocked data (deals, onboards, tasks, payments,
 * files) has been removed — the frontend now uses live API endpoints.
 */
export const SPENDING_TYPES = [
  "infrastructure",
  "tooling",
  "office",
  "travel",
  "payroll",
  "legal",
];

export const DEAL_STAGES = [
  { key: "active", label: "Активные" },
  { key: "completed", label: "Выполненные" },
  { key: "cancelled", label: "Отменённые" },
] as const;
