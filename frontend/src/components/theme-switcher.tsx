"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { useThemeStore, type Theme } from "@/lib/theme-store";

const OPTIONS: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
  { value: "system", label: "Системная", icon: Monitor },
];

// Tiny "is this mounted on the client" subscription so we can render an inert
// shell during SSR and the first paint, then swap to the real selection without
// a hydration mismatch warning.
const emptyUnsubscribe = () => () => {};
const trueSnapshot = () => true;
const falseSnapshot = () => false;

function useMounted() {
  return useSyncExternalStore(emptyUnsubscribe, trueSnapshot, falseSnapshot);
}

export function ThemeSwitcher() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const mounted = useMounted();

  return (
    <div
      role="radiogroup"
      aria-label="Цветовая тема"
      className="flex bg-surface-2 border border-hairline rounded-md p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "h-7 w-7 grid place-items-center rounded transition-colors",
              active
                ? "bg-canvas text-ink shadow-sm"
                : "text-ink-3 hover:text-ink"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
