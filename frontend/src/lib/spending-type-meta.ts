/**
 * Visual metadata for spending categories. Backend stores `type` as free text,
 * so this is a presentation-only mapping. Unknown types fall back to a
 * neutral icon and a stable hash-based colour so they still look intentional.
 */

export interface TypeMeta {
  key: string;
  label: string;
  icon: string;
  /** Hex colour for the dot / accent next to the icon. */
  color: string;
  /** Tag tone for the badge variant. */
  tone:
    | "blue"
    | "purple"
    | "orange"
    | "red"
    | "green"
    | "gray"
    | "brown"
    | "yellow"
    | "pink";
}

const KNOWN: Record<string, TypeMeta> = {
  infrastructure: {
    key: "infrastructure",
    label: "Инфраструктура",
    icon: "🖥️",
    color: "#2383E2",
    tone: "blue",
  },
  tooling: {
    key: "tooling",
    label: "Инструменты",
    icon: "🛠️",
    color: "#7C5CC4",
    tone: "purple",
  },
  office: {
    key: "office",
    label: "Офис",
    icon: "☕",
    color: "#E08A3A",
    tone: "orange",
  },
  travel: {
    key: "travel",
    label: "Командировки",
    icon: "✈️",
    color: "#D8473A",
    tone: "red",
  },
  payroll: {
    key: "payroll",
    label: "Зарплаты",
    icon: "💸",
    color: "#3D9C47",
    tone: "green",
  },
  legal: {
    key: "legal",
    label: "Юридическое",
    icon: "⚖️",
    color: "#9B9A94",
    tone: "gray",
  },
  marketing: {
    key: "marketing",
    label: "Маркетинг",
    icon: "📣",
    color: "#C95A8B",
    tone: "pink",
  },
  hardware: {
    key: "hardware",
    label: "Оборудование",
    icon: "🖱️",
    color: "#A87A55",
    tone: "brown",
  },
  food: {
    key: "food",
    label: "Питание",
    icon: "🍽️",
    color: "#C5A23E",
    tone: "yellow",
  },
};

const FALLBACK_TONES: TypeMeta["tone"][] = [
  "blue",
  "purple",
  "orange",
  "green",
  "pink",
  "brown",
  "yellow",
];
const FALLBACK_COLORS = [
  "#2383E2",
  "#7C5CC4",
  "#E08A3A",
  "#3D9C47",
  "#C95A8B",
  "#A87A55",
  "#C5A23E",
];

/** Deterministic but pleasant tone for arbitrary user-typed categories. */
function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export function typeMetaForSpending(raw: string): TypeMeta {
  const key = raw.trim().toLowerCase();
  if (!key) return KNOWN.infrastructure;
  if (KNOWN[key]) return KNOWN[key];
  const idx = hashIndex(key, FALLBACK_TONES.length);
  return {
    key,
    label: raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1),
    icon: "🏷️",
    color: FALLBACK_COLORS[idx],
    tone: FALLBACK_TONES[idx],
  };
}

export const KNOWN_TYPE_KEYS = Object.keys(KNOWN);

export function allKnownTypes(): TypeMeta[] {
  return Object.values(KNOWN);
}

/* --------------- recently used (localStorage) --------------- */

const STORAGE_KEY = "qoima.spending.recent-types";
const MAX_RECENT = 8;

export function loadRecentTypes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function rememberType(type: string): void {
  if (typeof window === "undefined") return;
  const t = type.trim();
  if (!t) return;
  const current = loadRecentTypes().filter(
    (x) => x.toLowerCase() !== t.toLowerCase()
  );
  current.unshift(t);
  const next = current.slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}
