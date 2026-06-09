"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { auth } from "@/lib/endpoints";

function subscribeHydration(cb: () => void) {
  return useAuthStore.persist.onFinishHydration(cb);
}

function getHydrated() {
  return useAuthStore.persist.hasHydrated();
}

function getServerHydrated() {
  return false;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const access = useAuthStore((s) => s.access);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydrated,
    getServerHydrated
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!access) {
      router.replace("/login");
      return;
    }
    if (!user) {
      auth
        .profile()
        .then(setUser)
        .catch(() => {
          logout();
          router.replace("/login");
        });
    }
  }, [hydrated, access, user, setUser, logout, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-[13px] text-ink-3 anim-fade">Загружаем рабочее пространство…</div>
      </div>
    );
  }

  if (!access) {
    return null;
  }

  return <>{children}</>;
}
