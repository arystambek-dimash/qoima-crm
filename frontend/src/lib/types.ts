export type UserRole = "collaborator" | "employee";
export type DealPaymentType = "cash" | "card" | "loan";

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  /** Optional — present once backend adds it to /api/users/profile/. */
  is_superuser?: boolean;
  is_staff?: boolean;
}

/* -------------------- Employees -------------------- */

export const EMPLOYEE_PERMISSION_FIELDS = [
  "tasks_can_edit",
  "tasks_can_delete",
  "tasks_can_create",
  "accounting_can_retrieve",
  "accounting_can_create",
  "accounting_can_update",
  "accounting_can_delete",
  "deals_can_create",
  "deals_can_delete",
  "deals_can_update",
  "employees_can_delete",
  "employees_can_create",
  "employees_can_update",
] as const;

export type EmployeePermissionField = (typeof EMPLOYEE_PERMISSION_FIELDS)[number];

export type EmployeePermissions = Record<EmployeePermissionField, boolean>;

export interface Employee extends EmployeePermissions {
  id: number;
  /**
   * Depending on backend serializer, `user` arrives either as the FK id
   * (number) or as a nested User object. Use the `employeeUserId()` /
   * `employeeUserDisplay()` helpers to extract either safely.
   */
  user: number | User;
  role: string;
  salary: string;
}

export interface EmployeeDetail extends Employee {
  user_detail?: User;
}

/* -------------------- Deals -------------------- */

export interface Deal {
  id: number;
  /** Either the FK id or the full nested User (depends on backend serializer). */
  user: number | User | null;
  stage: string;
  date_start: string;
  date_end: string;
  deal_amount: string;
  payment_type: DealPaymentType;
  is_active: boolean;
  payment_completed: boolean;

  /**
   * Optional fields that arrive once backend opts in:
   *   - `user_detail` — nested User (DealSerializer should add
   *     `user_detail = UserSerializer(source="user", read_only=True)`).
   *   - `paid_to_date` / `remaining` — annotated Sum of related payments.
   */
  user_detail?: User;
  paid_to_date?: string;
  remaining?: string;

  /** Derived from `user_detail` if backend gave it. */
  client_name?: string;
  client_email?: string;
}

export interface DealCreate {
  stage: string;
  date_start?: string;
  date_end: string;
  deal_amount: string;
  payment_type: DealPaymentType;
}

export interface DealFile {
  id: number;
  deal: number;
  file_name: string;
  file: string;
  description: string | null;
}

export interface DealFileCreate {
  file_name: string;
  file: string;
  description?: string;
}

export interface DealPayment {
  id: number;
  deal: number;
  amount: string;
  payment_date: string;
  delayed: boolean;
}

export interface DealPaymentCreate {
  amount: string;
  payment_date?: string;
  delayed?: boolean;
}

/* -------------------- Onboards / Tasks -------------------- */

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskPerformance {
  id: number;
  task: number;
  user: number;
  /** Present when backend includes nested user. */
  user_detail?: User;
}

export interface OnboardTask {
  id: number;
  category: number;
  name: string;
  type: string;
  is_active: boolean;
  description: string;
  date_start: string;
  date_end: string;
  performance?: TaskPerformance[];

  // Frontend-only fields for now (backend will add these later).
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: { id: number; name: string } | null;
}

export interface OnboardTaskCreate {
  category: number;
  name: string;
  type: string;
  description: string;
  date_start: string;
  date_end: string;
  is_active?: boolean;
}

export interface TaskCategory {
  id: number;
  name: string;
  onboard: number | null;
  tasks?: OnboardTask[];
}

export interface TaskCategoryCreate {
  name: string;
  onboard: number;
}

export interface Onboard {
  id: number;
  deal: number | null;
  is_completed: boolean;
  term_of_end: string;
  /** Optional — present once backend adds `name` field to the model. */
  name?: string;
  categories?: TaskCategory[];

  // Derived on the client
  client_name?: string;
  progress?: number;
}

export interface OnboardCreate {
  deal?: number | null;
  term_of_end: string;
  is_completed?: boolean;
  name?: string;
}

export interface OnboardUpdate {
  deal?: number | null;
  term_of_end?: string;
  is_completed?: boolean;
  name?: string;
}

/* -------------------- Users -------------------- */

export interface UserCreate {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
}

/* -------------------- Incomes -------------------- */

export interface Income {
  id: number;
  name: string;
  type: string;
  amount: string;
  /**
   * Backend convention: keeping the field name consistent with Spending
   * (`date_spend` ↔ `date_earned`). If you go with a different name on the
   * server, update this single place.
   */
  date_earned: string;
  note: string | null;
}

export interface IncomeByType {
  type: string;
  count: number;
  total_amount: string;
}

export interface IncomeByDate {
  date_earned: string;
  count: number;
  total_amount: string;
}

export interface IncomeAnalytics {
  total: {
    count: number;
    total_amount: string | null;
    date_from: string | null;
    date_to: string | null;
  };
  by_date: IncomeByDate[];
  by_type: IncomeByType[];
  meta: {
    date_from: string | null;
    date_to: string | null;
  };
}

export interface IncomeFilters {
  from_date?: string;
  to_date?: string;
  type?: string;
}

export interface IncomeCreate {
  name: string;
  type: string;
  amount: string;
  note?: string;
}

/* -------------------- Spendings -------------------- */

export interface Spending {
  id: number;
  name: string;
  type: string;
  amount: string;
  date_spend: string;
  note: string | null;
}

export interface SpendingByType {
  type: string;
  count: number;
  total_amount: string;
}

export interface SpendingByDate {
  date_spend: string;
  count: number;
  total_amount: string;
}

export interface SpendingAnalytics {
  total: {
    count: number;
    total_amount: string | null;
    date_from: string | null;
    date_to: string | null;
  };
  by_date: SpendingByDate[];
  by_type: SpendingByType[];
  meta: {
    date_from: string | null;
    date_to: string | null;
  };
}

export interface SpendingFilters {
  from_date?: string;
  to_date?: string;
  type?: string;
}

export interface SpendingCreate {
  name: string;
  type: string;
  amount: string;
  note?: string;
}

/* -------------------- Dashboard analytics -------------------- */

export type DashboardPeriod = "week" | "month" | "year" | "all" | "custom";
export type DashboardGroupBy = "day" | "week" | "month" | "year";

export interface DashboardFilters {
  period?: DashboardPeriod;
  group_by?: DashboardGroupBy;
  from_date?: string;
  to_date?: string;
}

export interface DashboardAmountSummary {
  income_count: number;
  income_total: string;
  spending_count: number;
  spending_total: string;
  net_total: string;
}

export interface DashboardFinancePoint {
  date: string;
  income_count: number;
  income_total: string;
  spending_count: number;
  spending_total: string;
  net_total: string;
}

export interface DashboardByTypeRow {
  type: string;
  count: number;
  total_amount: string;
}

export interface DashboardFinance {
  summary: DashboardAmountSummary;
  all_time: DashboardAmountSummary;
  series: DashboardFinancePoint[];
  by_type: {
    incomes: DashboardByTypeRow[];
    spendings: DashboardByTypeRow[];
  };
}

export interface DashboardTasksSummary {
  total: number;
  active: number;
  inactive: number;
  overdue: number;
}

export interface DashboardTasksByType extends DashboardTasksSummary {
  type: string;
}

export interface DashboardTasksByDate extends DashboardTasksSummary {
  date: string;
}

export interface DashboardTasks {
  summary: DashboardTasksSummary;
  by_type: DashboardTasksByType[];
  by_date_term: DashboardTasksByDate[];
}

export interface DashboardAnalytics {
  meta: {
    period: DashboardPeriod;
    group_by: DashboardGroupBy;
    date_from: string;
    date_to: string;
  };
  finance: DashboardFinance;
  tasks: DashboardTasks;
}

/* -------------------- Auth -------------------- */

export interface JWTPair {
  access: string;
  refresh: string;
}

export interface ApiError {
  detail?: string;
  [key: string]: unknown;
}
