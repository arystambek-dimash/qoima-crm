"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import * as React from "react";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;
export const DropdownMenuRadioGroup = DM.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "end",
  collisionPadding = 8,
  ...props
}: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 min-w-[200px] max-w-[calc(100vw-1rem)] bg-canvas border border-hairline-strong rounded-lg p-1 text-[14px] text-ink shadow-pop",
          "data-[state=open]:anim-fade",
          className
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        "flex items-center gap-2 px-2.5 h-8 cursor-pointer rounded-md outline-none transition-colors",
        "data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink",
        "data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator(
  props: React.ComponentProps<typeof DM.Separator>
) {
  return <DM.Separator className="my-1 h-px bg-hairline mx-1" {...props} />;
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DM.Label>) {
  return (
    <DM.Label
      className={cn("px-2.5 py-1.5 text-[12px] text-ink-3", className)}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DM.RadioItem>) {
  return (
    <DM.RadioItem
      className={cn(
        "flex items-center gap-2 pl-7 pr-2.5 h-8 cursor-pointer outline-none rounded-md relative",
        "data-[highlighted]:bg-surface-2",
        className
      )}
      {...props}
    >
      <DM.ItemIndicator className="absolute left-2">
        <Check className="h-3.5 w-3.5 text-accent" />
      </DM.ItemIndicator>
      {children}
    </DM.RadioItem>
  );
}
