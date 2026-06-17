"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useRole, useCurrentEmployee, useIsSuperuser } from "@/lib/permissions";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Receipt,
  TrendingUp,
  User2,
  Wallet as WalletIcon,
  CalendarCheck,
} from "lucide-react";
import type { EmployeePermissionField } from "@/lib/types";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Show only when the current user is one of these roles. */
  roles?: ("collaborator" | "employee")[];
  /** For employees, show only when they have this permission. */
  requires?: EmployeePermissionField;
};

export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Рабочее пространство",
    items: [{ href: "/dashboard", label: "Главная", icon: LayoutDashboard }],
  },
  {
    label: "Работа",
    items: [
      // Everyone with an account can see projects: employees see all (or whatever
      // their permissions allow), collaborators see only their own projects.
      { href: "/projects", label: "Проекты", icon: Briefcase },
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
      {
        href: "/monthly-obligations",
        label: "Обязательные",
        icon: CalendarCheck,
        roles: ["employee"],
        requires: "accounting_can_retrieve",
      },
      {
        href: "/wallets",
        label: "Кошелёк",
        icon: WalletIcon,
        roles: ["employee"],
      },
    ],
  },
  {
    label: "Аккаунт",
    items: [{ href: "/profile", label: "Профиль", icon: User2 }],
  },
];

/** Returns a predicate that decides whether a nav item is visible to the
 *  current user, honoring superuser/role/permission rules. */
export function useNavVisibility(): (item: NavItem) => boolean {
  const role = useRole();
  const { employee } = useCurrentEmployee();
  const isSuper = useIsSuperuser();

  return function isVisible(item: NavItem): boolean {
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
  };
}

/** The grouped navigation links, shared between the desktop sidebar and the
 *  mobile drawer. Pass `onNavigate` to close the drawer after a tap. */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isVisible = useNavVisibility();

  return (
    <>
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
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-2.5 h-9 px-2 rounded-md text-[14px] transition-colors lg:h-7 lg:gap-2",
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
    </>
  );
}
