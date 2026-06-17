/**
 * Visual metadata for income categories. Mirrors `spending-type-meta.ts`.
 * Unknown types fall back to a deterministic colour so the UI still looks
 * intentional.
 */

export interface IncomeTypeMeta {
  key: string;
  label: string;
  icon: string;
  color: string;
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

const KNOWN: Record<string, IncomeTypeMeta> = {
  deal_payment: {
    key: "deal_payment",
    label: "Оплата по проекту",
    icon: "📄",
    color: "#2383E2",
    tone: "blue",
  },
  consulting: {
    key: "consulting",
    label: "Консультации",
    icon: "💼",
    color: "#7C5CC4",
    tone: "purple",
  },
  product: {
    key: "product",
    label: "Продукт",
    icon: "📦",
    color: "#3D9C47",
    tone: "green",
  },
  rent: {
    key: "rent",
    label: "Аренда",
    icon: "🏠",
    color: "#E08A3A",
    tone: "orange",
  },
  refund: {
    key: "refund",
    label: "Возврат",
    icon: "↩️",
    color: "#9B9A94",
    tone: "gray",
  },
  ad_revenue: {
    key: "ad_revenue",
    label: "Реклама",
    icon: "📣",
    color: "#C95A8B",
    tone: "pink",
  },
  investment: {
    key: "investment",
    label: "Инвестиции",
    icon: "📈",
    color: "#C5A23E",
    tone: "yellow",
  },
  other: {
    key: "other",
    label: "Прочее",
    icon: "🏷️",
    color: "#A87A55",
    tone: "brown",
  },
};

const FALLBACK_TONES: IncomeTypeMeta["tone"][] = [
  "green",
  "blue",
  "purple",
  "orange",
  "pink",
  "brown",
  "yellow",
];
const FALLBACK_COLORS = [
  "#3D9C47",
  "#2383E2",
  "#7C5CC4",
  "#E08A3A",
  "#C95A8B",
  "#A87A55",
  "#C5A23E",
];

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export function typeMetaForIncome(raw: string): IncomeTypeMeta {
  const key = raw.trim().toLowerCase();
  if (!key) return KNOWN.other;
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

export const INCOME_TYPES = Object.keys(KNOWN);

export function allKnownIncomeTypes(): IncomeTypeMeta[] {
  return Object.values(KNOWN);
}
