import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <table
        className={cn(
          "w-full text-[14px] border-separate border-spacing-0",
          className
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="text-[12px] font-medium text-ink-3">{children}</thead>;
}

export function TR({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "group transition-colors hover:bg-surface [&>td]:border-b [&>td]:border-hairline [&>th]:border-b [&>th]:border-hairline",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TH({
  className,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableHeaderCellElement>) {
  return (
    <th
      className={cn(
        "h-9 px-3 sm:px-4 text-left align-middle font-medium text-ink-3",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TD({
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableDataCellElement>) {
  return (
    <td
      className={cn("h-12 px-3 sm:px-4 align-middle text-ink", className)}
      {...props}
    >
      {children}
    </td>
  );
}
