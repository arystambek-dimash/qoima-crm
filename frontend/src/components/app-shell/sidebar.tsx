"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { useRole, useCurrentEmployee, useIsSuperuser } from "@/lib/permissions";
import { Avatar } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Receipt,
  TrendingUp,
  User2,
  Search,
  ChevronsLeft,
} from "lucide-react";
import type { EmployeePermissionField } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Show only when the current user is one of these roles. */
  roles?: ("collaborator" | "employee")[];
  /** For employees, show only when they have this permission. */
  requires?: EmployeePermissionField;
};

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Рабочее пространство",
    items: [{ href: "/dashboard", label: "Главная", icon: LayoutDashboard }],
  },
  {
    label: "Работа",
    items: [
      // Everyone with an account can see deals: employees see all (or whatever
      // their permissions allow), collaborators see only their own orders.
      { href: "/deals", label: "Заказы", icon: Briefcase },
    ],
  },
  {
    label: "Компания",
    items: [
      {
        href: "/employees",
        label: "Сотрудники",
        icon: Users,
        roles: ["employee"],
      },
      {
        href: "/incomes",
        label: "Доходы",
        icon: TrendingUp,
        roles: ["employee"],
        requires: "accounting_can_retrieve",
      },
      {
        href: "/spendings",
        label: "Расходы",
        icon: Receipt,
        roles: ["employee"],
        requires: "accounting_can_retrieve",
      },
    ],
  },
  {
    label: "Аккаунт",
    items: [{ href: "/profile", label: "Профиль", icon: User2 }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const role = useRole();
  const { employee } = useCurrentEmployee();
  const isSuper = useIsSuperuser();

  const name =
    user && (user.first_name || user.last_name)
      ? `${user.first_name} ${user.last_name}`.trim()
      : user?.username ?? "Пользователь";

  function isVisible(item: NavItem): boolean {
    // Django superusers and staff see everything
    if (isSuper) return true;
    if (item.roles && !item.roles.includes(role as "employee" | "collaborator")) {
      return false;
    }
    if (item.requires) {
      // Admin-equivalent (employees_can_create) sees everything
      if (employee?.employees_can_create) return true;
      return Boolean(employee?.[item.requires]);
    }
    return true;
  }

  return (
    <aside className="hidden lg:flex flex-col w-[252px] shrink-0 border-r border-hairline bg-surface sticky top-0 h-screen">
      {/* Workspace switcher */}
      <div className="px-3 pt-3 pb-2">
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
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <button className="group w-full h-8 px-2 flex items-center gap-2 rounded-md hover:bg-surface-2 transition-colors text-left">
          <Search className="h-3.5 w-3.5 text-ink-4" />
          <span className="text-[13px] text-ink-3 flex-1">Поиск</span>
          <kbd className="text-[11px] text-ink-4">⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-2 pb-4 overflow-y-auto scrollbar-thin">
        {NAV.map((section) => {
          const visible = section.items.filter(isVisible);
          if (visible.length === 0) return null;
          return (
            <div key={section.label} className="mb-4">
              <h6 className="px-2 mb-1 text-[11px] font-medium text-ink-3 tracking-[0.02em] uppercase">
                {section.label}
              </h6>
              <ul className="flex flex-col gap-px">
                {visible.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href as never}
                        className={cn(
                          "group flex items-center gap-2 h-7 px-2 rounded-md text-[14px] transition-colors",
                          active
                            ? "bg-surface-3 text-ink font-medium"
                            : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-ink" : "text-ink-3"
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
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
