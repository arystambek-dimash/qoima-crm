"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-9 w-full bg-canvas border border-hairline-strong rounded-md px-3 text-[14px] text-ink placeholder:text-ink-4 outline-none transition-all",
        "hover:border-ink-5",
        "focus:border-accent focus:shadow-[0_0_0_3px_rgba(35,131,226,0.18)]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full bg-canvas border border-hairline-strong rounded-md px-3 py-2 text-[14px] text-ink placeholder:text-ink-4 outline-none transition-all resize-y",
        "hover:border-ink-5",
        "focus:border-accent focus:shadow-[0_0_0_3px_rgba(35,131,226,0.18)]",
        className
      )}
      {...props}
    />
  );
});

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-[12px] font-medium text-ink-2 mb-1.5",
        className
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="mt-1.5 text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}
