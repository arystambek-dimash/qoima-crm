"use client";

import { useAuthStore } from "@/lib/auth-store";
import { useRole, useIsSuperuser } from "@/lib/permissions";
import { Avatar } from "@/components/ui/avatar";
import { Search, ChevronsLeft } from "lucide-react";
import { NavList } from "@/components/app-shell/nav";

/** Account/workspace identity block — shared by the sidebar and mobile drawer. */
export function AccountSwitcher() {
  const user = useAuthStore((s) => s.user);
  const role = useRole();
  const isSuper = useIsSuperuser();

  const name =
    user && (user.first_name || user.last_name)
      ? `${user.first_name} ${user.last_name}`.trim()
      : user?.username ?? "Пользователь";

  return (
    <button className="group w-full flex items-center gap-2.5 px-2 h-9 rounded-md hover:bg-surface-2 transition-colors">
      <Avatar name={name} size={24} />
      <div className="flex-1 min-w-0 flex flex-col items-start leading-tight">
        <span className="text-[13px] text-ink font-medium truncate w-full text-left flex items-center gap-1.5">
          <span className="truncate">{name}</span>
          {isSuper && (
            <span className="text-[9px] font-mono font-medium px-1 py-px rounded bg-tag-purple-bg text-tag-purple-fg uppercase tracking-[0.04em] shrink-0">
              Админ
            </span>
          )}
        </span>
        <span className="text-[11px] text-ink-3 truncate w-full text-left">
          {isSuper
            ? "Суперпользователь"
            : role === "collaborator"
            ? "Кабинет клиента"
            : "Qoima"}
        </span>
      </div>
      <ChevronsLeft className="h-3.5 w-3.5 text-ink-4 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

/** Search trigger — shared by the sidebar and mobile drawer. */
export function SearchTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-full h-9 lg:h-8 px-2 flex items-center gap-2 rounded-md hover:bg-surface-2 transition-colors text-left"
    >
      <Search className="h-3.5 w-3.5 text-ink-4" />
      <span className="text-[13px] text-ink-3 flex-1">Поиск</span>
      <kbd className="hidden lg:inline text-[11px] text-ink-4">⌘K</kbd>
    </button>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-[252px] shrink-0 border-r border-hairline bg-surface sticky top-0 h-screen">
      {/* Workspace switcher */}
      <div className="px-3 pt-3 pb-2">
        <AccountSwitcher />
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <SearchTrigger />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-2 pb-4 overflow-y-auto scrollbar-thin">
        <NavList />
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-hairline">
        <div className="flex items-center justify-between text-[11px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            В сети
          </span>
          <span>v1.0</span>
        </div>
      </div>
    </aside>
  );
}
