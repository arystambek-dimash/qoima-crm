import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative bg-canvas border border-hairline rounded-lg shadow-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-5 h-12 border-b border-hairline",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelTitle({
  className,
  eyebrow,
  children,
}: {
  className?: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {eyebrow && (
        <span className="text-[12px] text-ink-4">{eyebrow}</span>
      )}
      <h3 className="text-[14px] font-semibold text-ink">{children}</h3>
    </div>
  );
}

export function PanelBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function StatCard({
  label,
  value,
  delta,
  caption,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; positive?: boolean };
  caption?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative bg-canvas border border-hairline rounded-lg p-5 flex flex-col gap-3 transition-colors hover:border-hairline-strong",
        accent && "bg-accent-soft border-accent/20"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-ink-3 font-medium">{label}</span>
        {delta && (
          <span
            className={cn(
              "text-[12px] font-medium",
              delta.positive ? "text-success" : "text-danger"
            )}
          >
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
        )}
      </div>
      <div
        className={cn(
          "font-display text-[30px] leading-[1.1] tracking-tight tabular-nums",
          accent ? "text-accent-ink" : "text-ink"
        )}
      >
        {value}
      </div>
      {caption && <div className="text-[12px] text-ink-3">{caption}</div>}
    </div>
  );
}
