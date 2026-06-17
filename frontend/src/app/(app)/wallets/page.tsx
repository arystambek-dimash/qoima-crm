"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Topbar } from "@/components/app-shell/topbar";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TR, TH, TD } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { wallets } from "@/lib/endpoints";
import { asApiError } from "@/lib/api";
import {
  useHasPermission,
  useIsSuperuser,
} from "@/lib/permissions";
import { formatCurrency, cn, plural } from "@/lib/utils";
import { walletActionMeta } from "@/lib/wallet-labels";
import { userDisplayName } from "@/lib/user-helpers";
import { WalletFormDialog } from "./wallet-form-dialog";
import type { Wallet, WalletLog } from "@/lib/types";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  History,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Wallet as WalletIcon,
} from "lucide-react";

const MASKED_AMOUNT = "******";

function formatProtectedCurrency(
  value: number | string | null | undefined,
  canView: boolean | undefined
) {
  return canView ? formatCurrency(value) : MASKED_AMOUNT;
}

function numericAmount(value: number | string | null | undefined) {
  if (value == null || value === "") return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

export default function WalletsPage() {
  const isSuper = useIsSuperuser();
  const canCreate = useHasPermission("wallets_can_create");
  const canUpdate = useHasPermission("wallets_can_update");
  const canDelete = useHasPermission("wallets_can_delete");

  const canCreateWallet = isSuper || canCreate.granted;
  const canUpdateWallet = isSuper || canUpdate.granted;
  const canDeleteWallet = isSuper || canDelete.granted;

  const [search, setSearch] = useState("");

  const listQ = useQuery({
    queryKey: ["wallets"],
    queryFn: wallets.list,
  });
  const currentQ = useQuery({
    queryKey: ["wallets-current"],
    queryFn: wallets.current,
  });
  const logsQ = useQuery({
    queryKey: ["wallets-logs"],
    queryFn: wallets.logs,
  });

  const allWallets = useMemo(() => listQ.data ?? [], [listQ.data]);
  const allLogs = useMemo(() => logsQ.data ?? [], [logsQ.data]);
  const recentLogs = useMemo(() => allLogs.slice(0, 20), [allLogs]);
  const canViewBalances =
    currentQ.data?.can_view_balance ?? allWallets.some((w) => w.can_view_balance);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allWallets;
    return allWallets.filter((w) => w.name.toLowerCase().includes(q));
  }, [allWallets, search]);

  const totalBalance = useMemo(
    () => allWallets.reduce((acc, w) => acc + numericAmount(w.balance), 0),
    [allWallets]
  );

  const monthlyDelta = useMemo(() => {
    if (!canViewBalances || allLogs.length === 0) return 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return allLogs
      .filter((log) => new Date(log.created_at) >= cutoff)
      .reduce((acc, log) => acc + numericAmount(log.amount_delta), 0);
  }, [allLogs, canViewBalances]);

  const monthlyDeltaCaption = !canViewBalances
    ? MASKED_AMOUNT
    : monthlyDelta === 0
    ? "За 30 дней без движения"
    : monthlyDelta > 0
    ? `+${formatCurrency(monthlyDelta)} за 30 дней`
    : `${formatCurrency(monthlyDelta)} за 30 дней`;

  return (
    <>
      <Topbar
        eyebrow="Финансы"
        title="Кошелёк компании"
        actions={
          canCreateWallet ? (
            <WalletFormDialog
              trigger={
                <Button variant="primary" size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  Новый кошелёк
                </Button>
              }
            />
          ) : undefined
        }
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-10 max-w-[1280px] mx-auto w-full">
        <header className="mb-8 anim-rise">
          <h1 className="font-display text-[28px] tracking-tight text-ink">
            Кошелёк компании
          </h1>
          <p className="mt-2 text-[14px] text-ink-3">
            Все средства компании — каждое движение фиксируется автоматически:
            доходы пополняют, расходы списывают.
          </p>
        </header>

        {/* Current wallet hero + summary */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6 stagger">
          <CurrentWalletCard wallet={currentQ.data} />
          <SummaryCard
            label="Кошельков"
            value={String(allWallets.length)}
            caption={`${plural(allWallets.length, "счёт", "счёта", "счетов")} компании`}
            icon={<WalletIcon className="h-3.5 w-3.5" />}
          />
          <SummaryCard
            label="Итого по всем счетам"
            value={formatProtectedCurrency(totalBalance, canViewBalances)}
            caption={monthlyDeltaCaption}
            captionPositive={canViewBalances && monthlyDelta > 0}
            captionNegative={canViewBalances && monthlyDelta < 0}
          />
        </section>

        {listQ.isError && (
          <Panel className="p-6 anim-fade mb-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 grid place-items-center bg-tag-red-bg text-tag-red-fg rounded-md">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] text-ink font-medium">
                  Не удалось загрузить список кошельков
                </h3>
                <p className="text-[13px] text-ink-3 mt-1">
                  {asApiError(listQ.error).message}
                </p>
                <p className="text-[12px] font-mono text-ink-4 mt-3">
                  GET /api/wallets/
                </p>
              </div>
            </div>
          </Panel>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
          {/* Wallets list */}
          <Panel className="anim-fade">
            <PanelHeader className="flex-wrap gap-2">
              <PanelTitle>Все кошельки</PanelTitle>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-4" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Найти…"
                  className="h-7 pl-7 text-[12px] w-[120px] sm:w-[180px]"
                />
              </div>
            </PanelHeader>
            <Table>
              <THead>
                <TR>
                  <TH>Название</TH>
                  <TH className="hidden sm:table-cell">Статус</TH>
                  <TH className="text-right">Остаток</TH>
                  <TH className="w-24"></TH>
                </TR>
              </THead>
              <tbody>
                {listQ.isLoading && (
                  <TR>
                    <TD colSpan={4} className="text-center text-ink-4 py-10">
                      Загружаем…
                    </TD>
                  </TR>
                )}
                {!listQ.isLoading && filtered.length === 0 && (
                  <TR>
                    <TD colSpan={4} className="text-center text-ink-4 py-12">
                      {allWallets.length === 0
                        ? "Кошельков пока нет."
                        : "По запросу ничего не нашлось."}
                    </TD>
                  </TR>
                )}
                {filtered.map((w) => (
                  <WalletRow
                    key={w.id}
                    wallet={w}
                    canEdit={canUpdateWallet}
                    canDelete={canDeleteWallet}
                  />
                ))}
              </tbody>
            </Table>
          </Panel>

          {/* Recent logs */}
          <Panel className="anim-fade">
            <PanelHeader>
              <PanelTitle eyebrow="Журнал">Последние операции</PanelTitle>
              <span className="text-[12px] text-ink-3 inline-flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                {allLogs.length} {plural(allLogs.length, "запись", "записи", "записей")}
              </span>
            </PanelHeader>
            <PanelBody className="p-0">
              {logsQ.isLoading && (
                <div className="px-5 py-10 text-center text-[13px] text-ink-4">
                  Загружаем…
                </div>
              )}
              {!logsQ.isLoading && recentLogs.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto h-10 w-10 grid place-items-center bg-surface-2 rounded-md mb-3">
                    <History className="h-4 w-4 text-ink-3" />
                  </div>
                  <p className="text-[13px] text-ink-3">
                    Здесь появятся все движения по кошелькам.
                  </p>
                </div>
              )}
              <ul className="divide-y divide-[var(--color-hairline)] max-h-none sm:max-h-[640px] sm:overflow-y-auto scrollbar-thin">
                {recentLogs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </ul>
            </PanelBody>
          </Panel>
        </div>
      </main>
    </>
  );
}

/* ----- pieces ----- */

function CurrentWalletCard({ wallet }: { wallet: Wallet | undefined }) {
  if (!wallet) {
    return (
      <div className="bg-canvas border border-hairline rounded-lg p-5 flex flex-col gap-3">
        <span className="text-[12px] text-ink-3 font-medium">
          Основной кошелёк
        </span>
        <span className="text-[13px] text-ink-4">Загружаем…</span>
      </div>
    );
  }
  return (
    <div className="bg-accent-soft border border-accent/20 rounded-lg p-5 flex flex-col gap-3 relative overflow-hidden">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/10 pointer-events-none" />
      <div className="flex items-center justify-between relative">
        <span className="text-[12px] text-accent-ink font-medium inline-flex items-center gap-1.5">
          <Star className="h-3 w-3 fill-current" />
          Основной кошелёк
        </span>
        <Badge tone="blue">{wallet.name}</Badge>
      </div>
      <div className="font-display text-[26px] sm:text-[34px] leading-[1.05] tracking-tight tabular-nums text-accent-ink relative break-words">
        {formatProtectedCurrency(wallet.balance, wallet.can_view_balance)}
      </div>
      <div className="text-[12px] text-accent-ink/80 relative">
        Обновлён {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(wallet.updated_at))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  caption,
  icon,
  captionPositive,
  captionNegative,
}: {
  label: string;
  value: string;
  caption?: string;
  icon?: React.ReactNode;
  captionPositive?: boolean;
  captionNegative?: boolean;
}) {
  return (
    <div className="bg-canvas border border-hairline rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-ink-3 font-medium">{label}</span>
        {icon && (
          <span className="text-ink-4">
            {icon}
          </span>
        )}
      </div>
      <div className="font-display text-[22px] sm:text-[28px] leading-[1.1] tracking-tight tabular-nums text-ink break-words">
        {value}
      </div>
      {caption && (
        <div
          className={cn(
            "text-[12px]",
            captionPositive
              ? "text-success"
              : captionNegative
              ? "text-danger"
              : "text-ink-3"
          )}
        >
          {caption}
        </div>
      )}
    </div>
  );
}

function WalletRow({
  wallet,
  canEdit,
  canDelete,
}: {
  wallet: Wallet;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => wallets.remove(wallet.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallets-current"] });
      qc.invalidateQueries({ queryKey: ["wallets-logs"] });
      toast.success("Кошелёк удалён.");
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  const hasActions = canEdit || canDelete;

  return (
    <TR>
      <TD>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 grid place-items-center bg-surface-2 rounded-md text-ink-3">
            <WalletIcon className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-ink font-medium">{wallet.name}</span>
            <span className="text-[11px] text-ink-4 font-mono">
              ID {String(wallet.id).padStart(4, "0")}
            </span>
          </div>
        </div>
      </TD>
      <TD className="hidden sm:table-cell">
        <div className="flex items-center gap-1.5">
          {wallet.is_default && (
            <Badge tone="blue">
              <Star className="h-2.5 w-2.5 fill-current" />
              основной
            </Badge>
          )}
          {wallet.is_active ? (
            <Badge tone="green" dot>
              активен
            </Badge>
          ) : (
            <Badge tone="gray" dot>
              отключён
            </Badge>
          )}
        </div>
      </TD>
      <TD className="text-right font-medium tabular-nums">
        {formatProtectedCurrency(wallet.balance, wallet.can_view_balance)}
      </TD>
      <TD>
        {hasActions && (
          <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <WalletFormDialog
                initial={wallet}
                trigger={
                  <button
                    title="Редактировать"
                    className="h-7 w-7 grid place-items-center rounded text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                }
              />
            )}
            {canDelete && !wallet.is_default && (
              <button
                title="Удалить"
                onClick={() => {
                  if (confirm(`Удалить «${wallet.name}»?`)) del.mutate();
                }}
                disabled={del.isPending}
                className="h-7 w-7 grid place-items-center rounded text-ink-3 hover:text-danger hover:bg-tag-red-bg/30 transition-colors"
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

function LogRow({ log }: { log: WalletLog }) {
  const meta = walletActionMeta(log.action);
  const canViewBalance = log.can_view_balance;
  const delta = canViewBalance ? numericAmount(log.amount_delta) : 0;
  const isPositive = Number.isFinite(delta) && delta > 0;
  const isNegative = Number.isFinite(delta) && delta < 0;
  const actorName = log.actor_detail
    ? userDisplayName(log.actor_detail)
    : log.actor != null
    ? `Пользователь #${log.actor}`
    : "Система";

  return (
    <li className="px-5 py-3 flex items-start gap-3 hover:bg-surface transition-colors min-w-0">
      <div
        className={cn(
          "h-8 w-8 grid place-items-center rounded-md shrink-0",
          isPositive
            ? "bg-tag-green-bg text-tag-green-fg"
            : isNegative
            ? "bg-tag-red-bg text-tag-red-fg"
            : "bg-surface-2 text-ink-3"
        )}
      >
        {isPositive ? (
          <ArrowUpRight className="h-4 w-4" />
        ) : isNegative ? (
          <ArrowDownRight className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0 leading-tight">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {log.wallet_name && (
            <span className="text-[12px] text-ink-3">· {log.wallet_name}</span>
          )}
        </div>
        {log.description && (
          <p className="mt-1 text-[12px] text-ink-3 truncate">
            {log.description}
          </p>
        )}
        <div className="mt-1 text-[11px] text-ink-4 flex items-center gap-1.5">
          <Avatar name={actorName} size={16} className="text-[8px]" />
          <span>{actorName}</span>
          <span>·</span>
          <span>
            {new Intl.DateTimeFormat("ru-RU", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(log.created_at))}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "text-right tabular-nums font-medium text-[13px] sm:whitespace-nowrap shrink-0",
          isPositive ? "text-success" : isNegative ? "text-danger" : "text-ink-3"
        )}
      >
        {canViewBalance && isPositive ? "+" : ""}
        {formatProtectedCurrency(delta, canViewBalance)}
        <div className="text-[10px] text-ink-4 font-normal">
          → {formatProtectedCurrency(log.balance_after, canViewBalance)}
        </div>
      </div>
    </li>
  );
}
