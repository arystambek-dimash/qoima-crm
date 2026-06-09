"use client";

import { useAuthStore } from "./auth-store";
import { useQuery } from "@tanstack/react-query";
import { employees } from "./endpoints";
import type {
  Employee,
  EmployeePermissionField,
  User,
} from "./types";

export type Role = "collaborator" | "employee" | "anonymous";

/** Returns the role of the currently signed-in user. */
export function useRole(): Role {
  const user = useAuthStore((s) => s.user);
  if (!user) return "anonymous";
  return user.role;
}

export function useCurrentUser(): User | null {
  return useAuthStore((s) => s.user);
}

/**
 * Resolves the Employee record for the currently signed-in user (if any).
 * Collaborators have no Employee row, so this returns null for them.
 * Falls back to the full /employees/ list since the backend has no dedicated
 * "me" endpoint for employees yet.
 */
export function useCurrentEmployee(): {
  employee: Employee | null;
  isLoading: boolean;
} {
  const user = useAuthStore((s) => s.user);
  const q = useQuery({
    queryKey: ["employees"],
    queryFn: employees.list,
    enabled: !!user && user.role === "employee",
  });
  if (!user || user.role !== "employee") {
    return { employee: null, isLoading: false };
  }
  const employee =
    q.data?.find((e) => {
      const id =
        typeof e.user === "number"
          ? e.user
          : e.user && typeof e.user === "object"
          ? e.user.id
          : null;
      return id === user.id;
    }) ?? null;
  return { employee, isLoading: q.isLoading };
}

/** Django-style admin override: superusers and staff bypass permission flags. */
export function useIsSuperuser(): boolean {
  const user = useAuthStore((s) => s.user);
  return Boolean(user?.is_superuser || user?.is_staff);
}

/**
 * Whether the current user has a given employee permission flag.
 * - Superusers / staff always return true (Django convention).
 * - Collaborators always return false (the flag system doesn't apply).
 * - Employees: true if their Employee row has the flag set.
 * - Anonymous: false.
 */
export function useHasPermission(field: EmployeePermissionField): {
  granted: boolean;
  isLoading: boolean;
} {
  const role = useRole();
  const isSuper = useIsSuperuser();
  const { employee, isLoading } = useCurrentEmployee();
  if (isSuper) return { granted: true, isLoading: false };
  if (role !== "employee") return { granted: false, isLoading: false };
  return { granted: Boolean(employee?.[field]), isLoading };
}
