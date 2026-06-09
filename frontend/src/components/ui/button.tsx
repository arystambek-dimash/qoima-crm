"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-1.5 font-sans font-medium transition-all duration-150 ease-out disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas",
  {
    variants: {
      variant: {
        primary:
          "bg-ink text-canvas hover:bg-ink-2 shadow-[0_1px_0_0_rgba(0,0,0,0.04),0_1px_2px_0_rgba(0,0,0,0.06)]",
        accent:
          "bg-accent text-white hover:bg-accent-ink",
        secondary:
          "bg-canvas text-ink border border-hairline-strong hover:bg-surface hover:border-ink-5 shadow-[0_1px_0_0_rgba(0,0,0,0.02)]",
        ghost: "bg-transparent text-ink-2 hover:text-ink hover:bg-surface-2",
        outline:
          "bg-transparent text-ink-2 border border-hairline-strong hover:bg-surface hover:text-ink",
        danger:
          "bg-canvas text-danger border border-tag-red-bg hover:bg-tag-red-bg/40",
      },
      size: {
        sm: "h-7 px-2.5 text-[13px]",
        md: "h-8 px-3 text-[13px]",
        lg: "h-10 px-4 text-[14px]",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, asChild, ...props }, ref) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(button({ variant, size }), className)}
        {...props}
      />
    );
  }
);
