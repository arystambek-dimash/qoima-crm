"use client";

import * as D from "@radix-ui/react-dialog";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import {
  AccountSwitcher,
  SearchTrigger,
} from "@/components/app-shell/sidebar";
import { NavList } from "@/components/app-shell/nav";
import { ThemeSwitcher } from "@/components/theme-switcher";

/**
 * Mobile navigation: a hamburger button (hidden on lg+) that opens a slide-in
 * drawer reusing the same nav links, account block and search as the desktop
 * sidebar. The desktop <Sidebar> stays `hidden lg:flex`.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Close the drawer whenever the route changes (e.g. after tapping a link or
  // via back/forward). This is React's "adjust state during render" pattern —
  // preferred over a setState-in-effect — so the drawer never lingers on the
  // new page.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger asChild>
        <button
          aria-label="Меню"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>
      </D.Trigger>

      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm data-[state=open]:anim-fade lg:hidden" />
        <D.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-surface border-r border-hairline shadow-pop focus:outline-none data-[state=open]:anim-slide-in lg:hidden"
        >
          <D.Title className="sr-only">Навигация</D.Title>
          <D.Description className="sr-only">
            Основное меню приложения
          </D.Description>

          {/* Account + close */}
          <div className="px-3 pt-3 pb-2 flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <AccountSwitcher />
            </div>
            <D.Close
              aria-label="Закрыть"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
            >
              <X className="h-5 w-5" />
            </D.Close>
          </div>

          {/* Search */}
          <div className="px-3 pb-2">
            <SearchTrigger />
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 pt-2 pb-4 overflow-y-auto scrollbar-thin">
            <NavList onNavigate={() => setOpen(false)} />
          </nav>

          {/* Footer: theme control (lives in the topbar on desktop) */}
          <div className="px-3 py-3 border-t border-hairline flex items-center justify-between gap-2">
            <span className="text-[12px] text-ink-3">Тема</span>
            <ThemeSwitcher />
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
