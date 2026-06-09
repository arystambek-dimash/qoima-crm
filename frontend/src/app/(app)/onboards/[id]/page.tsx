"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/app-shell/topbar";
import { Panel, PanelHeader, PanelTitle, PanelBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { onboards } from "@/lib/endpoints";
import { formatDate, cn, plural } from "@/lib/utils";
import { ArrowLeft, Plus } from "lucide-react";
import { AddTaskDialog } from "@/app/(app)/deals/[id]/task-dialog";
import { TasksBoard } from "@/components/tasks-board";

export default function OnboardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const onboardId = Number(id);

  // Single GET fetches the full nested representation:
  // onboard → categories[] → tasks[] → performance[]
  const onboardQ = useQuery({
    queryKey: ["onboard", onboardId],
    queryFn: () => onboards.retrieve(onboardId),
  });

  const o = onboardQ.data;
  const cats = o?.categories ?? [];
  const tasks = cats.flatMap((c) => c.tasks ?? []);

  const [addOpen, setAddOpen] = useState(false);
  const [addCategoryId, setAddCategoryId] = useState<number | undefined>(
    undefined
  );
  function openAdd(categoryId?: number) {
    setAddCategoryId(categoryId);
    setAddOpen(true);
  }

  if (!o && onboardQ.isLoading)
    return <Topbar eyebrow="Работа" title="Загрузка…" />;
  if (!o)
    return (
      <>
        <Topbar eyebrow="Работа" title="Не найдено" />
        <main className="p-12 max-w-[1080px] mx-auto">
          <Link href="/onboards" className="text-ink-3 hover:text-accent">
            Назад
          </Link>
        </main>
      </>
    );

  const total = tasks.length;
  const done = tasks.filter((t) => !t.is_active).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <Topbar
        eyebrow="Работа"
        title={o.client_name ?? (o.deal ? `Заказ #${o.deal}` : `Онбординг #${o.id}`)}
        actions={
          <Button variant="primary" size="sm" onClick={() => openAdd()}>
            <Plus className="h-3.5 w-3.5" />
            Задача
          </Button>
        }
      />
      <AddTaskDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onboardId={onboardId}
        categories={cats}
        defaultCategoryId={addCategoryId}
      />
      <main className="flex-1 px-6 lg:px-10 py-10 max-w-[1280px] mx-auto w-full stagger">
        <Link
          href="/onboards"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-accent transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Onboarding
        </Link>

        <header className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            {o.is_completed ? (
              <Badge tone="green">сдан</Badge>
            ) : (
              <Badge tone="blue" dot>
                in flight
              </Badge>
            )}
            <span className="text-[13px] text-ink-3 tabular-nums">
              Target {formatDate(o.term_of_end)}
            </span>
            {o.deal && (
              <Link
                href={`/deals/${o.deal}` as never}
                className="text-[13px] text-accent hover:text-accent-ink transition-colors"
              >
                Заказ #{o.deal} →
              </Link>
            )}
          </div>
          <h1 className="font-display text-[28px] tracking-tight text-ink text-balance">
            {o.client_name ?? (o.deal ? `Заказ #${o.deal}` : `Онбординг #${o.id}`)}
          </h1>
        </header>

        <section className="grid grid-cols-3 gap-3 mb-6">
          <Stat k="Задач" v={String(total)} />
          <Stat k="Готово" v={String(done)} />
          <Stat k="Прогресс" v={`${pct}%`} accent />
        </section>

        <Panel className="mb-8">
          <PanelBody>
            <div className="flex items-center justify-between mb-2 text-[13px]">
              <span className="text-ink-2 font-medium">Общий прогресс</span>
              <span className="text-ink-3 tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 bg-surface-3 rounded-full relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Категории и задачи</PanelTitle>
            <span className="text-[12px] text-ink-3">
              {cats.length}{" "}
              {plural(cats.length, "категория", "категории", "категорий")} ·{" "}
              {tasks.length}{" "}
              {plural(tasks.length, "задача", "задачи", "задач")}
            </span>
          </PanelHeader>
          <PanelBody>
            <TasksBoard
              onboardId={onboardId}
              categories={cats}
              onAddCard={(categoryId) => openAdd(categoryId)}
            />
          </PanelBody>
        </Panel>
      </main>
    </>
  );
}

function Stat({
  k,
  v,
  accent,
}: {
  k: string;
  v: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-canvas border border-hairline rounded-lg px-5 py-3",
        accent && "bg-accent-soft border-accent/20"
      )}
    >
      <div className="text-[12px] text-ink-3 mb-1">{k}</div>
      <div
        className={cn(
          "font-display text-[22px] tabular-nums",
          accent ? "text-accent-ink" : "text-ink"
        )}
      >
        {v}
      </div>
    </div>
  );
}
