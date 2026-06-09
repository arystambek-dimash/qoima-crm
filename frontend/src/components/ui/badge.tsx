import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Notion-style soft tags: low contrast, rounded, readable
const badge = cva(
  "inline-flex items-center gap-1 px-2 h-[22px] text-[12px] rounded-md whitespace-nowrap font-medium leading-none",
  {
    variants: {
      tone: {
        gray: "bg-tag-gray-bg text-tag-gray-fg",
        brown: "bg-tag-brown-bg text-tag-brown-fg",
        orange: "bg-tag-orange-bg text-tag-orange-fg",
        yellow: "bg-tag-yellow-bg text-tag-yellow-fg",
        green: "bg-tag-green-bg text-tag-green-fg",
        blue: "bg-tag-blue-bg text-tag-blue-fg",
        purple: "bg-tag-purple-bg text-tag-purple-fg",
        pink: "bg-tag-pink-bg text-tag-pink-fg",
        red: "bg-tag-red-bg text-tag-red-fg",
        outline: "bg-transparent text-ink-3 border border-hairline-strong",

        // Aliases mapped to closest Notion tag
        neutral: "bg-tag-gray-bg text-tag-gray-fg",
        success: "bg-tag-green-bg text-tag-green-fg",
        warn: "bg-tag-yellow-bg text-tag-yellow-fg",
        danger: "bg-tag-red-bg text-tag-red-fg",
        info: "bg-tag-blue-bg text-tag-blue-fg",
        acid: "bg-tag-blue-bg text-tag-blue-fg",
      },
    },
    defaultVariants: { tone: "gray" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {
  dot?: boolean;
}

const DOT_COLORS: Record<string, string> = {
  gray: "#9b9a94",
  brown: "#a87a55",
  orange: "#e08a3a",
  yellow: "#c5a23e",
  green: "#3d9c47",
  blue: "#2383e2",
  purple: "#7c5cc4",
  pink: "#c95a8b",
  red: "#d8473a",
  neutral: "#9b9a94",
  success: "#3d9c47",
  warn: "#c5a23e",
  danger: "#d8473a",
  info: "#2383e2",
  acid: "#2383e2",
  outline: "#9b9a94",
};

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badge({ tone }), className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: DOT_COLORS[tone ?? "gray"] }}
        />
      )}
      {children}
    </span>
  );
}
