"use client";

import * as D from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import * as React from "react";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm data-[state=open]:anim-fade" />
      <D.Content
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 bg-canvas border border-hairline-strong rounded-xl p-6 shadow-pop data-[state=open]:anim-rise",
          className
        )}
        {...props}
      >
        {children}
        <D.Close className="absolute right-4 top-4 h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

export function DialogHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1">
      {eyebrow && (
        <span className="text-[12px] text-ink-3">{eyebrow}</span>
      )}
      <D.Title asChild>
        <h2 className="font-display text-[22px] tracking-tight text-ink">
          {title}
        </h2>
      </D.Title>
      {description && (
        <D.Description asChild>
          <p className="text-[14px] text-ink-3">{description}</p>
        </D.Description>
      )}
    </header>
  );
}
