import { api } from "./api";
import type {
  DashboardAnalytics,
  DashboardFilters,
  Deal,
  DealCreate,
  DealFile,
  DealFileCreate,
  DealPayment,
  DealPaymentCreate,
  Employee,
  Income,
  IncomeAnalytics,
  IncomeCreate,
  IncomeFilters,
  JWTPair,
  Onboard,
  OnboardCreate,
  OnboardUpdate,
  OnboardTask,
  OnboardTaskCreate,
  PasswordResetConfirm,
  Spending,
  SpendingAnalytics,
  SpendingCreate,
  SpendingFilters,
  TaskCategory,
  TaskCategoryCreate,
  User,
  UserCreate,
  UserUpdate,
  UserRole,
  Wallet,
  WalletCreate,
  WalletLog,
} from "./types";

/* ---------------- Auth ---------------- */

export const auth = {
  loginViaEmail: (email: string, password: string) =>
    api
      .post<JWTPair>("/users/login-via-email/", { email, password })
      .then((r) => r.data),
  loginViaUsername: (username: string, password: string) =>
    api
      .post<JWTPair>("/users/login-via-username/", { username, password })
      .then((r) => r.data),
  refresh: (refresh: string) =>
    api
      .post<{ access: string }>("/users/token/refresh/", { refresh })
      .then((r) => r.data),
  profile: () => api.get<User>("/users/profile/").then((r) => r.data),
  requestPasswordReset: (email: string) =>
    api
      .post<{ detail: string }>("/users/password-reset/request/", { email })
      .then((r) => r.data),
  confirmPasswordReset: (payload: PasswordResetConfirm) =>
    api
      .post<{ detail: string }>("/users/password-reset/confirm/", payload)
      .then((r) => r.data),
};

/* ---------------- Users (admin-side) ---------------- */

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results;
}

export const users = {
  list: (role?: UserRole) =>
    api
      .get<User[] | { results: User[] }>("/users/", {
        params: role ? { role } : undefined,
      })
      .then((r) => unwrapList(r.data)),
  create: (payload: UserCreate) =>
    api.post<User>("/users/", payload).then((r) => r.data),
  update: (id: number, payload: UserUpdate) =>
    api.patch<User>(`/users/${id}/`, payload).then((r) => r.data),
};

/* ---------------- Employees ---------------- */

export const employees = {
  list: () => api.get<Employee[]>("/employees/").then((r) => r.data),
  retrieve: (id: number) =>
    api.get<Employee>(`/employees/${id}/`).then((r) => r.data),
  create: (payload: Partial<Employee> & { user: number }) =>
    api.post<Employee>("/employees/", payload).then((r) => r.data),
  update: (id: number, payload: Partial<Employee>) =>
    api.patch<Employee>(`/employees/${id}/`, payload).then((r) => r.data),
};

/* ---------------- Deals ---------------- */

// Alias so existing call sites keep working without churn.
const unwrap = unwrapList;

export const deals = {
  list: () =>
    api
      .get<Deal[] | { results: Deal[] }>("/deals/")
      .then((r) => unwrap(r.data)),

  /**
   * Backend currently has no `?user=` filter (DjangoFilterBackend without
   * filterset_fields). Until that lands, fetch all and filter on the client.
   */
  listForUser: (userId: number) =>
    api
      .get<Deal[] | { results: Deal[] }>("/deals/")
      .then((r) =>
        unwrap(r.data).filter((d) => {
          const id =
            typeof d.user === "number"
              ? d.user
              : d.user && typeof d.user === "object"
              ? d.user.id
              : null;
          return id === userId;
        })
      ),

  retrieve: (id: number) =>
    api.get<Deal>(`/deals/${id}/`).then((r) => r.data),

  create: (payload: DealCreate) =>
    api.post<Deal>("/deals/", payload).then((r) => r.data),

  update: (id: number, payload: Partial<DealCreate>) =>
    api.patch<Deal>(`/deals/${id}/`, payload).then((r) => r.data),

  remove: (id: number) =>
    api.delete<void>(`/deals/${id}/`).then((r) => r.data),

  /* Files & payments — only POST/DELETE exposed on backend, no GET list. */
  addFile: (dealId: number, payload: DealFileCreate) =>
    api
      .post<DealFile>(`/deals/${dealId}/files/`, payload)
      .then((r) => r.data),
  removeFile: (dealId: number, fileId: number) =>
    api
      .delete<void>(`/deals/${dealId}/files/${fileId}/`)
      .then((r) => r.data),

  addPayment: (dealId: number, payload: DealPaymentCreate) =>
    api
      .post<DealPayment>(`/deals/${dealId}/payments/`, payload)
      .then((r) => r.data),
  removePayment: (dealId: number, paymentId: number) =>
    api
      .delete<void>(`/deals/${dealId}/payments/${paymentId}/`)
      .then((r) => r.data),
};

/* ---------------- Onboards ---------------- */

export const onboards = {
  list: () =>
    api
      .get<Onboard[] | { results: Onboard[] }>("/onboards/")
      .then((r) => unwrap(r.data)),

  retrieve: (id: number) =>
    api.get<Onboard>(`/onboards/${id}/`).then((r) => r.data),

  /** Onboards attached to a specific deal (one deal can have several). */
  forDeal: async (dealId: number): Promise<Onboard[]> => {
    const all = await onboards.list();
    return all.filter((o) => o.deal === dealId);
  },

  create: (payload: OnboardCreate) =>
    api.post<Onboard>("/onboards/", payload).then((r) => r.data),
  update: (id: number, payload: OnboardUpdate) =>
    api.patch<Onboard>(`/onboards/${id}/`, payload).then((r) => r.data),
  remove: (id: number) =>
    api.delete<void>(`/onboards/${id}/`).then((r) => r.data),

  /* Categories */
  categoriesList: () =>
    api
      .get<TaskCategory[] | { results: TaskCategory[] }>(
        "/onboards/categories/"
      )
      .then((r) => unwrap(r.data)),
  createCategory: (payload: TaskCategoryCreate) =>
    api
      .post<TaskCategory>("/onboards/categories/", payload)
      .then((r) => r.data),
  updateCategory: (id: number, payload: Partial<TaskCategoryCreate>) =>
    api
      .patch<TaskCategory>(`/onboards/categories/${id}/`, payload)
      .then((r) => r.data),
  removeCategory: (id: number) =>
    api
      .delete<void>(`/onboards/categories/${id}/`)
      .then((r) => r.data),

  /* Tasks */
  tasksList: () =>
    api
      .get<OnboardTask[] | { results: OnboardTask[] }>("/onboards/tasks/")
      .then((r) => unwrap(r.data)),
  createTask: (payload: OnboardTaskCreate) =>
    api.post<OnboardTask>("/onboards/tasks/", payload).then((r) => r.data),
  updateTask: (id: number, payload: Partial<OnboardTaskCreate>) =>
    api
      .patch<OnboardTask>(`/onboards/tasks/${id}/`, payload)
      .then((r) => r.data),
  removeTask: (id: number) =>
    api.delete<void>(`/onboards/tasks/${id}/`).then((r) => r.data),

  /* TaskPerformance — assignees on a task */
  assign: (taskId: number, userId: number) =>
    api
      .post<OnboardTask>(`/onboards/tasks/${taskId}/assign/`, { user: userId })
      .then((r) => r.data),
  unassign: (taskId: number, userId: number) =>
    api
      .delete<void>(`/onboards/tasks/${taskId}/unassign/${userId}/`)
      .then((r) => r.data),
};

/* ---------------- Spendings ---------------- */

function spendingsParams(filters?: SpendingFilters) {
  const params: Record<string, string> = {};
  if (filters?.from_date) params.from_date = filters.from_date;
  if (filters?.to_date) params.to_date = filters.to_date;
  if (filters?.type) params.type = filters.type;
  return params;
}

export const spendings = {
  list: (filters?: SpendingFilters) =>
    api
      .get<Spending[] | { results: Spending[] }>("/spendings/", {
        params: spendingsParams(filters),
      })
      .then((r) => unwrap(r.data)),
  retrieve: (id: number) =>
    api.get<Spending>(`/spendings/${id}/`).then((r) => r.data),
  create: (payload: SpendingCreate) =>
    api.post<Spending>("/spendings/", payload).then((r) => r.data),
  update: (id: number, payload: Partial<SpendingCreate>) =>
    api.patch<Spending>(`/spendings/${id}/`, payload).then((r) => r.data),
  remove: (id: number) =>
    api.delete<void>(`/spendings/${id}/`).then((r) => r.data),
  analytics: (filters?: SpendingFilters) =>
    api
      .get<SpendingAnalytics>("/spendings/analytics/", {
        params: spendingsParams(filters),
      })
      .then((r) => r.data),
};

/* ---------------- Incomes ----------------
 *
 * Mirrors the Spending API. Until the backend implements `/api/incomes/`,
 * these calls will return 404 — frontend will surface that as a normal
 * "loading failed" state. Drop-in once the endpoint exists.
 */

function incomesParams(filters?: IncomeFilters) {
  const params: Record<string, string> = {};
  if (filters?.from_date) params.from_date = filters.from_date;
  if (filters?.to_date) params.to_date = filters.to_date;
  if (filters?.type) params.type = filters.type;
  return params;
}

export const incomes = {
  list: (filters?: IncomeFilters) =>
    api
      .get<Income[] | { results: Income[] }>("/incomes/", {
        params: incomesParams(filters),
      })
      .then((r) => unwrap(r.data)),
  retrieve: (id: number) =>
    api.get<Income>(`/incomes/${id}/`).then((r) => r.data),
  create: (payload: IncomeCreate) =>
    api.post<Income>("/incomes/", payload).then((r) => r.data),
  update: (id: number, payload: Partial<IncomeCreate>) =>
    api.patch<Income>(`/incomes/${id}/`, payload).then((r) => r.data),
  remove: (id: number) =>
    api.delete<void>(`/incomes/${id}/`).then((r) => r.data),
  analytics: (filters?: IncomeFilters) =>
    api
      .get<IncomeAnalytics>("/incomes/analytics/", {
        params: incomesParams(filters),
      })
      .then((r) => r.data),
};

/* ---------------- Dashboard ----------------
 *
 * Single fat endpoint covering finance (incomes vs spendings) and tasks for
 * a configurable time window. Returns a uniformly bucketed series the chart
 * can render without further bucketing on the client.
 */

function dashboardParams(filters?: DashboardFilters) {
  const params: Record<string, string> = {};
  if (filters?.period) params.period = filters.period;
  if (filters?.group_by) params.group_by = filters.group_by;
  if (filters?.from_date) params.from_date = filters.from_date;
  if (filters?.to_date) params.to_date = filters.to_date;
  return params;
}

export const dashboard = {
  analytics: (filters?: DashboardFilters) =>
    api
      .get<DashboardAnalytics>("/dashboard/analytics/", {
        params: dashboardParams(filters),
      })
      .then((r) => r.data),
};

/* ---------------- Wallets ----------------
 *
 * Read-only for any authenticated user; mutating actions are gated by the
 * wallets_can_create / wallets_can_update / wallets_can_delete permissions
 * (or superuser/staff). Income/Spending create/update/delete cascade into
 * wallet balance + WalletLog entries on the backend automatically.
 */

export const wallets = {
  list: () =>
    api
      .get<Wallet[] | { results: Wallet[] }>("/wallets/")
      .then((r) => unwrap(r.data)),
  current: () =>
    api.get<Wallet>("/wallets/current/").then((r) => r.data),
  retrieve: (id: number) =>
    api.get<Wallet>(`/wallets/${id}/`).then((r) => r.data),
  create: (payload: WalletCreate) =>
    api.post<Wallet>("/wallets/", payload).then((r) => r.data),
  update: (id: number, payload: Partial<WalletCreate>) =>
    api.patch<Wallet>(`/wallets/${id}/`, payload).then((r) => r.data),
  remove: (id: number) =>
    api.delete<void>(`/wallets/${id}/`).then((r) => r.data),
  logs: () =>
    api
      .get<WalletLog[] | { results: WalletLog[] }>("/wallets/logs/")
      .then((r) => unwrap(r.data)),
};
