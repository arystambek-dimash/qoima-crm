"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    const { access } = useAuthStore.getState();
    router.replace(access ? "/dashboard" : "/login");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="text-[13px] text-ink-3">Загрузка…</div>
    </div>
  );
}
