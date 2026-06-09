import type { User } from "./types";

/**
 * Backend serializers are inconsistent: `user` may arrive as a primary-key
 * `number` or as a nested `User` object. These helpers normalize that without
 * scattering `typeof === "object"` checks across components.
 */

export function isNestedUser(u: unknown): u is User {
  return typeof u === "object" && u !== null && "id" in u;
}

/** Extract the user id from either form. Returns null when missing. */
export function userIdOf(u: number | User | null | undefined): number | null {
  if (u == null) return null;
  if (typeof u === "number") return u;
  if (isNestedUser(u)) return u.id;
  return null;
}

/** Get the nested User object when available, otherwise null. */
export function nestedUserOf(
  u: number | User | null | undefined
): User | null {
  return isNestedUser(u) ? u : null;
}

/** Pretty display name. Falls back to "Пользователь #ID" when only id known. */
export function userDisplayName(
  u: number | User | null | undefined
): string {
  if (u == null) return "—";
  if (typeof u === "number") return `Пользователь #${u}`;
  if (isNestedUser(u)) {
    const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
    return name || u.username || u.email || `Пользователь #${u.id}`;
  }
  return "—";
}

/** Email if available, empty string otherwise. */
export function userEmail(u: number | User | null | undefined): string {
  return isNestedUser(u) ? u.email ?? "" : "";
}
