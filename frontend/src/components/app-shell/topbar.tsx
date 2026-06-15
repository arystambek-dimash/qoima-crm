"use client";

import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/auth-store";
import { ChevronDown, LogOut, Settings, User2, Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MobileNav } from "@/components/app-shell/mobile-nav";

export function Topbar({
  title,
  eyebrow,
  actions,
}: {
  title?: React.ReactNode;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const name =
    user && (user.first_name || user.last_name)
      ? `${user.first_name} ${user.last_name}`.trim()
      : user?.username ?? "Пользователь";

  return (
    <header className="sticky top-0 z-20 h-14 bg-canvas/85 backdrop-blur-md border-b border-hairline">
      <div className="h-full px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-6">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <MobileNav />
          <div className="flex flex-col min-w-0 leading-tight">
            {eyebrow && (
              <span className="text-[11px] text-ink-3 truncate">{eyebrow}</span>
            )}
            {title && (
              <h1 className="text-[15px] sm:text-[16px] font-semibold text-ink truncate tracking-tight">
                {title}
              </h1>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions}

          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Уведомления"
            className="hidden sm:inline-flex"
          >
            <Bell className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 pl-1 pr-2 h-8 rounded-md hover:bg-surface-2 transition-colors group">
                <Avatar name={name} size={24} />
                <span className="hidden md:inline-block text-[13px] text-ink">
                  {name}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-ink-3 transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[220px] max-w-[calc(100vw-1.5rem)]">
              <DropdownMenuLabel>Вы вошли как</DropdownMenuLabel>
              <DropdownMenuItem disabled className="opacity-100 cursor-default">
                <div className="flex flex-col leading-tight">
                  <span className="text-ink">{name}</span>
                  <span className="text-[12px] text-ink-3">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/profile")}>
                <User2 className="h-3.5 w-3.5 text-ink-3" />
                Профиль
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/profile")}>
                <Settings className="h-3.5 w-3.5 text-ink-3" />
                Настройки
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-danger data-[highlighted]:text-danger data-[highlighted]:bg-tag-red-bg/40"
                onSelect={() => {
                  logout();
                  router.replace("/login");
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function PrimaryAction({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button variant="primary" size="sm" onClick={onClick}>
      <Plus className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
