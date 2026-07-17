"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Handshake,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { PermissionDenied } from "@/components/permission-gate";
import { Topbar } from "@/components/app-shell/topbar";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { asApiError } from "@/lib/api";
import { sales } from "@/lib/endpoints";
import {
  useHasPermission,
  useIsSuperuser,
  useRole,
} from "@/lib/permissions";
import type { SalesLead } from "@/lib/types";
import { cn, formatCurrency, formatDate, plural } from "@/lib/utils";
import { SalesLeadDialog } from "./sales-lead-dialog";

export default function SalesPage() {
  const role = useRole();
  const isSuperuser = useIsSuperuser();
  const viewPermission = useHasPermission("sales_can_retrieve");
  const createPermission = useHasPermission("sales_can_create");
  const updatePermission = useHasPermission("sales_can_update");
  const deletePermission = useHasPermission("sales_can_delete");
  const allowed =
    isSuperuser || (role === "employee" && viewPermission.granted);
  const canCreate = isSuperuser || createPermission.granted;
  const canUpdate = isSuperuser || updatePermission.granted;
  const canDelete = isSuperuser || deletePermission.granted;
  const [search, setSearch] = useState("");

  const leadsQuery = useQuery({
    queryKey: ["sales-leads"],
    queryFn: sales.list,
    enabled: allowed,
  });

  const leads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);
  const filteredLeads = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("ru");
    if (!term) return leads;
    return leads.filter((lead) =>
      [lead.lead_name, lead.company, lead.comments].some((value) =>
        value.toLocaleLowerCase("ru").includes(term)
      )
    );
  }, [leads, search]);

  const totalAmount = leads.reduce((sum, lead) => sum + Number(lead.amount), 0);
  const averageAmount = leads.length ? totalAmount / leads.length : 0;
  const companiesCount = new Set(
    leads.map((lead) => lead.company.trim().toLocaleLowerCase("ru"))
  ).size;

  if (!isSuperuser && role === "employee" && viewPermission.isLoading) {
    return <Topbar eyebrow="Коммерция" title="Загрузка доступа…" />;
  }

  if (!allowed) {
    return (
      <>
        <Topbar eyebrow="Коммерция" title="Отдел продаж" />
        <PermissionDenied
          title="Доступ к продажам ограничен"
          detail="У вашей учётной записи нет права «sales_can_retrieve». Попросите администратора выдать доступ к просмотру продаж."
        />
      </>
    );
  }

  return (
    <>
      <Topbar
        eyebrow="Коммерция"
        title="Отдел продаж"
        actions={
          canCreate ? (
            <SalesLeadDialog
              trigger={
                <Button variant="primary" size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Добавить лида</span>
                  <span className="sm:hidden">Лид</span>
                </Button>
              }
            />
          ) : undefined
        }
      />

      <main className="flex-1 bg-surface px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.08em] text-tag-blue-fg">
              <span className="h-1.5 w-1.5 rounded-full bg-tag-blue-fg" />
              Входящие возможности
            </div>
            <h2 className="font-display text-[24px] text-ink sm:text-[28px]">
              Потенциальные сделки
            </h2>
            <p className="mt-1 max-w-xl text-[13px] text-ink-3">
              Единый список контактов, компаний и ожидаемых сумм для отдела продаж.
            </p>
          </div>

          <div className="relative w-full sm:w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по лиду или компании"
              className="pl-9"
            />
          </div>
        </div>

        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SalesStat
            icon={Handshake}
            label="Лидов в работе"
            value={String(leads.length)}
            detail={plural(leads.length, "контакт", "контакта", "контактов")}
            accent
          />
          <SalesStat
            icon={TrendingUp}
            label="Потенциальная сумма"
            value={formatCurrency(totalAmount)}
            detail={`Средняя — ${formatCurrency(averageAmount)}`}
          />
          <SalesStat
            icon={Building2}
            label="Компаний"
            value={String(companiesCount)}
            detail="уникальных организаций"
          />
        </section>

        {leadsQuery.isError && (
          <Panel className="mb-5 border-tag-red-bg bg-tag-red-bg/20 p-4">
            <p className="text-[14px] font-medium text-danger">
              Не удалось загрузить лидов
            </p>
            <p className="mt-1 text-[12px] text-ink-3">
              {asApiError(leadsQuery.error).message}
            </p>
          </Panel>
        )}

        <Panel>
          <PanelHeader>
            <PanelTitle>Лиды</PanelTitle>
            <span className="text-[12px] text-ink-3">
              {leadsQuery.isLoading
                ? "Загрузка…"
                : `${filteredLeads.length} ${plural(
                    filteredLeads.length,
                    "запись",
                    "записи",
                    "записей"
                  )}`}
            </span>
          </PanelHeader>

          <Table>
            <THead>
              <TR>
                <TH>Имя лида</TH>
                <TH>Компания</TH>
                <TH className="text-right">Сумма</TH>
                <TH>Комментарии</TH>
                <TH className="w-20" />
              </TR>
            </THead>
            <tbody>
              {filteredLeads.map((lead) => (
                <SalesLeadRow
                  key={lead.id}
                  lead={lead}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                />
              ))}
              {!leadsQuery.isLoading && filteredLeads.length === 0 && (
                <TR>
                  <TD colSpan={5} className="py-14 text-center">
                    <div className="mx-auto flex max-w-xs flex-col items-center">
                      <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-ink-4">
                        <Handshake className="h-4 w-4" />
                      </span>
                      <p className="text-[14px] font-medium text-ink">
                        {search ? "Лиды не найдены" : "Пока нет лидов"}
                      </p>
                      <p className="mt-1 text-[12px] text-ink-3">
                        {search
                          ? "Попробуйте изменить поисковый запрос."
                          : "Добавьте первый контакт для отдела продаж."}
                      </p>
                    </div>
                  </TD>
                </TR>
              )}
            </tbody>
          </Table>
        </Panel>
      </main>
    </>
  );
}

function SalesLeadRow({
  lead,
  canUpdate,
  canDelete,
}: {
  lead: SalesLead;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: () => sales.remove(lead.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-leads"] });
      toast.success("Лид удалён.");
    },
    onError: (error) => toast.error(asApiError(error).message),
  });

  return (
    <TR>
      <TD>
        <div className="min-w-[150px]">
          <div className="font-medium text-ink">{lead.lead_name}</div>
          <div className="mt-0.5 text-[11px] text-ink-4">
            Добавлен {formatDate(lead.created_at)}
          </div>
        </div>
      </TD>
      <TD>
        <div className="flex min-w-[140px] items-center gap-2 text-ink-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-surface-2 text-ink-3">
            <Building2 className="h-3.5 w-3.5" />
          </span>
          <span>{lead.company}</span>
        </div>
      </TD>
      <TD className="min-w-[140px] text-right font-medium tabular-nums">
        {formatCurrency(lead.amount)}
      </TD>
      <TD>
        <div
          className={cn(
            "flex min-w-[220px] max-w-[420px] items-center gap-2 text-[13px]",
            lead.comments ? "text-ink-3" : "text-ink-4"
          )}
          title={lead.comments || undefined}
        >
          <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{lead.comments || "Без комментария"}</span>
        </div>
      </TD>
      <TD>
        {(canUpdate || canDelete) && (
          <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            {canUpdate && (
              <SalesLeadDialog
                initial={lead}
                trigger={
                  <button
                    title="Редактировать"
                    className="grid h-7 w-7 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                }
              />
            )}
            {canDelete && (
              <button
                title="Удалить"
                disabled={removeMutation.isPending}
                onClick={() => {
                  if (confirm(`Удалить лида «${lead.lead_name}»?`)) {
                    removeMutation.mutate();
                  }
                }}
                className="grid h-7 w-7 place-items-center rounded text-ink-3 transition-colors hover:bg-tag-red-bg/30 hover:text-danger disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </TD>
    </TR>
  );
}

function SalesStat({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-hairline bg-canvas p-4 shadow-card",
        accent && "border-accent/20 bg-accent-soft"
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-2 text-ink-3",
          accent && "bg-canvas/70 text-accent-ink"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-ink-3">{label}</div>
        <div
          className={cn(
            "mt-1 truncate font-display text-[22px] tabular-nums text-ink",
            accent && "text-accent-ink"
          )}
          title={value}
        >
          {value}
        </div>
        <div className="mt-1 text-[11px] text-ink-4">{detail}</div>
      </div>
    </div>
  );
}
