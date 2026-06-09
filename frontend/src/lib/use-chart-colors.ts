"use client";

import { useEffectiveTheme } from "./theme-store";

export interface ChartColors {
  accent: string;
  accentSoft: string;
  ink: string;
  ink3: string;
  ink4: string;
  hairline: string;
  hairlineStrong: string;
  canvas: string;
  surface: string;
  surface3: string;
}

const LIGHT: ChartColors = {
  accent: "#2383E2",
  accentSoft: "#E7F1FB",
  ink: "#37352F",
  ink3: "#787671",
  ink4: "#9B9A94",
  hairline: "#ECECEA",
  hairlineStrong: "#E2E1DE",
  canvas: "#FFFFFF",
  surface: "#FBFBFA",
  surface3: "#EFEEEC",
};

const DARK: ChartColors = {
  accent: "#4EA4EE",
  accentSoft: "#1F3551",
  ink: "#E6E3DC",
  ink3: "#989590",
  ink4: "#6F6D68",
  hairline: "#2A2A2A",
  hairlineStrong: "#373737",
  canvas: "#191919",
  surface: "#202020",
  surface3: "#2F2F2F",
};

/**
 * Returns a stable color object for the current theme.
 * Both LIGHT and DARK are module-level constants → identity is stable across
 * renders that don't switch themes, which keeps Recharts effects from
 * triggering re-render loops on prop comparison.
 */
export function useChartColors(): ChartColors {
  const theme = useEffectiveTheme();
  return theme === "dark" ? DARK : LIGHT;
}
