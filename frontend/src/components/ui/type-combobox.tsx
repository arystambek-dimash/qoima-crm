"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  allKnownTypes,
  loadRecentTypes,
  typeMetaForSpending,
  type TypeMeta,
} from "@/lib/spending-type-meta";

interface Option {
  meta: TypeMeta;
  /** "preset" or "recent" (user-typed earlier and remembered). */
  source: "preset" | "recent";
}

interface TypeComboboxProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  id?: string;
  invalid?: boolean;
}

export function TypeCombobox({
  value,
  onChange,
  placeholder = "Выберите или введите категорию",
  id,
  invalid,
}: TypeComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Bumping this token re-reads `recent` from localStorage on each open
  // without putting `open` directly into a useMemo dep list (lint-friendly).
  const [recentToken, setRecentToken] = React.useState(0);

  const allOptions: Option[] = React.useMemo(() => {
    const presets: Option[] = allKnownTypes().map((m) => ({
      meta: m,
      source: "preset",
    }));
    const recent = loadRecentTypes()
      .filter(
        (r) =>
          !presets.some((p) => p.meta.key.toLowerCase() === r.toLowerCase())
      )
      .map<Option>((r) => ({ meta: typeMetaForSpending(r), source: "recent" }));
    return [...presets, ...recent];
    // recentToken is intentionally part of the deps to force a re-read of
    // localStorage every time the popover opens — eslint flags it as unused
    // because the value is not referenced inside the memo body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentToken]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter(
      (o) =>
        o.meta.key.toLowerCase().includes(q) ||
        o.meta.label.toLowerCase().includes(q)
    );
  }, [allOptions, query]);

  const queryIsNovel = React.useMemo(() => {
    if (!query.trim()) return false;
    return !allOptions.some(
      (o) => o.meta.key.toLowerCase() === query.trim().toLowerCase()
    );
  }, [allOptions, query]);

  // Active row count: filtered + 1 "Create" pseudo-row when applicable.
  const rowCount = filtered.length + (queryIsNovel ? 1 : 0);
  // Clamp inline — no effect / setState in render needed.
  const clampedActive =
    rowCount === 0 ? 0 : Math.min(activeIdx, rowCount - 1);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Refresh recent list and focus the search input
      setRecentToken((t) => t + 1);
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery("");
      setActiveIdx(0);
    }
  }

  function commit(next: string) {
    onChange(next.trim());
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (rowCount === 0 ? 0 : (i + 1) % rowCount));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) =>
        rowCount === 0 ? 0 : (i - 1 + rowCount) % rowCount
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (clampedActive < filtered.length) {
        commit(filtered[clampedActive].meta.key);
      } else if (queryIsNovel) {
        commit(query.trim());
      }
    }
  }

  const selectedMeta = value ? typeMetaForSpending(value) : null;

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          data-invalid={invalid ? "true" : undefined}
          className={cn(
            "h-9 w-full bg-canvas border border-hairline-strong rounded-md px-3 text-[14px] text-ink hover:border-ink-5 outline-none transition-all flex items-center gap-2",
            "focus:border-accent focus:shadow-[0_0_0_3px_rgba(35,131,226,0.18)]",
            "data-[invalid=true]:border-danger"
          )}
        >
          {selectedMeta ? (
            <>
              <span className="text-[15px] leading-none" aria-hidden>
                {selectedMeta.icon}
              </span>
              <span className="flex-1 text-left truncate">
                {selectedMeta.label}
              </span>
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: selectedMeta.color }}
              />
            </>
          ) : (
            <span className="flex-1 text-left text-ink-4 truncate">
              {placeholder}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-ink-4 shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-[240px] sm:min-w-[260px] max-w-[calc(100vw-1rem)] bg-canvas border border-hairline-strong rounded-lg shadow-pop data-[state=open]:anim-fade overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="px-2 pt-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Найти или создать категорию…"
              className="w-full h-8 bg-surface border border-hairline rounded px-2.5 text-[13px] text-ink placeholder:text-ink-4 outline-none focus:border-accent"
            />
          </div>
          <ul
            role="listbox"
            className="max-h-[260px] overflow-y-auto scrollbar-thin p-1 mt-1"
          >
            {filtered.length === 0 && !queryIsNovel && (
              <li className="px-3 py-6 text-center text-[13px] text-ink-4">
                Ничего не найдено
              </li>
            )}
            {filtered.map((opt, idx) => {
              const isActive = idx === clampedActive;
              const isSelected =
                value.toLowerCase() === opt.meta.key.toLowerCase();
              return (
                <li key={opt.meta.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => commit(opt.meta.key)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 h-8 rounded text-[13px] text-left transition-colors",
                      isActive ? "bg-surface-2" : "hover:bg-surface-2",
                      "text-ink-2"
                    )}
                  >
                    <span className="text-[15px] leading-none" aria-hidden>
                      {opt.meta.icon}
                    </span>
                    <span className="flex-1 truncate text-ink">
                      {opt.meta.label}
                    </span>
                    {opt.source === "recent" && (
                      <span className="text-[10px] text-ink-4 px-1.5 py-0.5 bg-surface-3 rounded">
                        недавно
                      </span>
                    )}
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
            {queryIsNovel && (
              <li>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIdx(filtered.length)}
                  onClick={() => commit(query.trim())}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 h-8 rounded text-[13px] text-left transition-colors mt-0.5 border-t border-hairline",
                    clampedActive === filtered.length
                      ? "bg-accent-soft"
                      : "hover:bg-surface-2"
                  )}
                >
                  <Plus className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="text-ink-3">Создать</span>
                  <span className="text-ink font-medium truncate">
                    &ldquo;{query.trim()}&rdquo;
                  </span>
                </button>
              </li>
            )}
          </ul>
          <div className="border-t border-hairline px-2.5 py-1.5 hidden sm:flex flex-wrap items-center gap-3 text-[11px] text-ink-4 bg-surface/40">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-px text-[10px] bg-canvas border border-hairline rounded font-mono">
                ↑↓
              </kbd>
              Навигация
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-px text-[10px] bg-canvas border border-hairline rounded font-mono">
                ↵
              </kbd>
              Выбрать
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <kbd className="px-1 py-px text-[10px] bg-canvas border border-hairline rounded font-mono">
                esc
              </kbd>
              Закрыть
            </span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
