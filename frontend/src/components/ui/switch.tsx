"use client";

import * as RSwitch from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof RSwitch.Root>) {
  return (
    <RSwitch.Root
      className={cn(
        "peer relative inline-flex h-[18px] w-[30px] shrink-0 cursor-pointer items-center rounded-full bg-ink-5 transition-colors",
        "data-[state=checked]:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RSwitch.Thumb
        className="pointer-events-none block h-[14px] w-[14px] translate-x-[2px] rounded-full bg-canvas shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform data-[state=checked]:translate-x-[14px]"
      />
    </RSwitch.Root>
  );
}
