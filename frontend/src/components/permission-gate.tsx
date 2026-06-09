"use client";

import Link from "next/link";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export function PermissionDenied({
  title = "У вас нет доступа к этой странице",
  detail,
  cta = "На главную",
  href = "/dashboard",
}: {
  title?: string;
  detail?: string;
  cta?: string;
  href?: string;
}) {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <Panel className="max-w-md w-full p-8 text-center">
        <div className="mx-auto h-10 w-10 grid place-items-center bg-surface-2 rounded-lg mb-4">
          <Lock className="h-4 w-4 text-ink-3" />
        </div>
        <h2 className="font-display text-[22px] text-ink">{title}</h2>
        {detail && (
          <p className="mt-2 text-[14px] text-ink-3">{detail}</p>
        )}
        <div className="mt-6">
          <Link href={href as never}>
            <Button variant="secondary" size="md">
              {cta}
            </Button>
          </Link>
        </div>
      </Panel>
    </main>
  );
}
