"use client";

import { Toaster } from "sonner";
import { useEffectiveTheme } from "@/lib/theme-store";

export function ThemeToaster() {
  const mode = useEffectiveTheme();
  return (
    <Toaster
      theme={mode}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-canvas !border !border-hairline-strong !text-ink !rounded-md !shadow-pop !font-sans",
          title: "!text-[13px] !tracking-tight",
          description: "!text-[12px] !text-ink-3",
        },
      }}
    />
  );
}
