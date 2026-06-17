"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/app-shell/topbar";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { onboards } from "@/lib/endpoints";
import { useNow } from "@/lib/use-now";
import { formatDate, cn } from "@/lib/utils";
import { ArrowUpRight, CheckCircle2, Plus, Workflow } from "lucide-react";
import { OnboardFormDialog } from "./onboard-form-dialog";

function computeProgress(o: { categories?: { tasks?: { is_active: boolean }[] }[] }): number {
  if (!o.categories) return 0;
  let total = 0;
  let done = 0;
  for (const c of o.categories) {
    for (const t of c.tasks ?? []) {
      total += 1;
      if (!t.is_active) done += 1;
    }
  }
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export default function OnboardsPage() {
  const q = useQuery({ queryKey: ["onboards"], queryFn: onboards.list });
  const rawData = q.data ?? [];
  const now = useNow();

  // Inject derived `progress` so the cards stay simple.
  const data = rawData.map((o) => ({ ...o, progress: computeProgress(o) }));
  const active = data.filter((o) => !o.is_completed);
  const completed = data.filter((o) => o.is_completed);

  return (
    <>
      <Topbar
        eyebrow="Работа"
        title="Онбординг"
        actions={
          <OnboardFormDialog
            trigger={
              <Button variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Новый онбординг
              </Button>
            }
          />
        }
      />
      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-10 max-w-[1280px] mx-auto w-full">
        <header className="mb-8 anim-rise">
          <h1 className="font-display text-[28px] tracking-tight text-ink">
            Онбординг
          </h1>
          <p className="mt-2 text-[14px] text-ink-3">
            Программы и чек-листы для каждого проекта после подписания договора.
          </p>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-8 stagger">
          <Stat label="В работе" value={String(active.length)} />
          <Stat label="Завершено" value={String(completed.length)} />
          <Stat
            label="Средний прогресс"
            value={
              active.length
                ? `${Math.round(
                    active.reduce((a, o) => a + (o.progress ?? 0), 0) /
                      active.length
                  )}%`
                : "—"
            }
          />
        </section>

        <Panel className="mb-6">
          <PanelHeader>
            <PanelTitle>Активные программы</PanelTitle>
            <span className="text-[12px] text-ink-3">
              {active.length} в работе
            </span>
          </PanelHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
            {active.map((o) => (
              <OnboardCard key={o.id} o={o} now={now} />
            ))}
            {active.length === 0 && (
              <div className="col-span-full p-12 text-center">
                <div className="mx-auto h-12 w-12 grid place-items-center bg-surface-2 rounded-lg mb-3">
                  <Workflow className="h-5 w-5 text-ink-3" />
                </div>
                <h3 className="font-display text-[20px] text-ink">
                  Нет активных программ
                </h3>
                <p className="text-[14px] text-ink-3 mt-1">
                  Когда проект начнётся, его план появится здесь.
                </p>
              </div>
            )}
          </div>
        </Panel>

        {completed.length > 0 && (
          <Panel>
            <PanelHeader>
              <PanelTitle>Завершённые</PanelTitle>
              <span className="text-[12px] text-ink-3">
                {completed.length} сданы
              </span>
            </PanelHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
              {completed.map((o) => (
                <OnboardCard key={o.id} o={o} now={now} />
              ))}
            </div>
          </Panel>
        )}
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas border border-hairline rounded-lg px-4 py-3">
      <div className="text-[12px] text-ink-3 mb-1">{label}</div>
      <div className="font-display text-[22px] tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

type OnboardCardProps = {
  o: {
    id: number;
    client_name?: string;
    is_completed: boolean;
    progress?: number;
    term_of_end: string;
    deal: number | null;
  };
  now: number;
};

function OnboardCard({ o, now }: OnboardCardProps) {
  const overdue =
    !o.is_completed && now > 0 && new Date(o.term_of_end).getTime() < now;
  return (
    <Link
      href={`/onboards/${o.id}` as never}
      className="group block bg-canvas border border-hairline rounded-lg p-4 hover:border-hairline-strong hover:shadow-card transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[16px] font-medium text-ink leading-tight">
            {o.client_name ?? (o.deal ? `Проект #${o.deal}` : `Онбординг #${o.id}`)}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
            {o.deal ? <span>Проект #{o.deal}</span> : <span>Отдельный</span>}
            <span>·</span>
            <span className="tabular-nums">
              {formatDate(o.term_of_end, { month: "short", day: "2-digit" })}
            </span>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-ink-4 group-hover:text-accent transition-colors shrink-0" />
      </div>

      <div className="mt-5 space-y-1.5">
        <div className="flex items-center justify-between text-[12px] text-ink-3">
          <span>{o.is_completed ? "Сдан" : "Прогресс"}</span>
          <span className="text-ink-2 tabular-nums">{o.progress ?? 0}%</span>
        </div>
        <div className="h-1.5 bg-surface-3 rounded-full relative overflow-hidden">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all duration-700",
              o.is_completed
                ? "bg-success"
                : overdue
                ? "bg-danger"
                : "bg-accent"
            )}
            style={{ width: `${o.progress ?? 0}%` }}
          />
        </div>
      </div>

      <div className="mt-3">
        {o.is_completed ? (
          <Badge tone="green">
            <CheckCircle2 className="h-2.5 w-2.5" />
            сдан
          </Badge>
        ) : overdue ? (
          <Badge tone="red" dot>
            просрочен
          </Badge>
        ) : (
          <Badge tone="blue" dot>
            в работе
          </Badge>
        )}
      </div>
    </Link>
  );
}
