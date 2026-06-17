import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFmt = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "KZT",
  currencyDisplay: "narrowSymbol", // ₸ instead of "KZT"
  maximumFractionDigits: 0,
});

const decimalFmt = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | string | null | undefined) {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return currencyFmt.format(n);
}

export function formatNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return decimalFmt.format(n);
}

export function formatDate(
  value: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }
) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", opts).format(d);
}

/**
 * Russian pluralization helper. Picks one of three forms depending on the
 * number. Use like: `${n} ${plural(n, "проект", "проекта", "проектов")}`.
 */
export function plural(
  n: number,
  one: string,
  few: string,
  many: string
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function pluralProjects(n: number): string {
  return plural(n, "активный проект", "активных проекта", "активных проектов");
}

const BYTE_UNITS = ["Б", "КБ", "МБ", "ГБ"];

/** Human-friendly byte size: 1024 → "1 КБ". */
export function formatBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "—";
  if (value === 0) return "0 Б";
  let n = value;
  let i = 0;
  while (n >= 1024 && i < BYTE_UNITS.length - 1) {
    n /= 1024;
    i += 1;
  }
  const formatted = n >= 10 || i === 0 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${formatted} ${BYTE_UNITS[i]}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "??";
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}
