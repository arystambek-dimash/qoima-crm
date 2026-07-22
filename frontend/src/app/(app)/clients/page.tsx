"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/app-shell/topbar";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Table, THead, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PermissionDenied } from "@/components/permission-gate";
import { clients } from "@/lib/endpoints";
import { asApiError } from "@/lib/api";
import { useHasPermission } from "@/lib/permissions";
import { cn, plural } from "@/lib/utils";
import type { Client } from "@/lib/types";
import {
  AlertTriangle,
  Contact,
  KeyRound,
  Pencil,
  Plus,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  CreateClientDialog,
  EditClientDialog,
  SetPasswordDialog,
  ToggleActiveDialog,
} from "./client-dialogs";

export default function ClientsPage() {
  const access = useHasPermission("clients_can_retrieve");
  const canCreate = useHasPermission("clients_can_create");
  const q = useQuery({
    queryKey: ["clients"],
    queryFn: clients.list,
    enabled: access.granted,
  });

  if (!access.granted && !access.isLoading) {
    return (
      <>
        <Topbar eyebrow="Компания" title="Клиенты" />
        <PermissionDenied
          title="Нет доступа"
          detail="Просмотр клиентов доступен сотрудникам с правом «Клиенты · просмотр»."
        />
      </>
    );
  }

  const createButton = (size: "sm" | "md") =>
    canCreate.granted ? (
      <CreateClientDialog
        trigger={
          <Button variant="primary" size={size}>
            <Plus className="h-3.5 w-3.5" />
            Добавить клиента
          </Button>
        }
      />
    ) : undefined;

  return (
    <>
      <Topbar eyebrow="Компания" title="Клиенты" actions={createButton("sm")} />
      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-10 max-w-[1280px] mx-auto w-full">
        <header className="mb-8 anim-rise">
          <h1 className="font-display text-[28px] tracking-tight text-ink">
            Клиенты
          </h1>
          <p className="mt-2 text-[14px] text-ink-3">
            Аккаунты клиентов с доступом в кабинет: создайте аккаунт, передайте
            email и пароль — клиент сможет добавлять задачи в своих проектах.
          </p>
        </header>

        {q.isLoading && (
          <Panel className="p-10 text-center text-[13px] text-ink-4 anim-fade">
            Загружаем список…
          </Panel>
        )}

        {q.isError && (
          <Panel className="p-6 anim-fade">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 grid place-items-center bg-tag-red-bg text-tag-red-fg rounded-md">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] text-ink font-medium">
                  Не удалось загрузить клиентов
                </h3>
                <p className="text-[13px] text-ink-3 mt-1">
                  {asApiError(q.error).message}
                </p>
                <p className="text-[12px] font-mono text-ink-4 mt-3">
                  GET /api/clients/
                </p>
              </div>
            </div>
          </Panel>
        )}

        {q.data && q.data.length === 0 && (
          <Panel className="p-14 text-center anim-fade">
            <div className="mx-auto h-12 w-12 grid place-items-center bg-surface-2 rounded-lg mb-4">
              <Contact className="h-5 w-5 text-ink-3" />
            </div>
            <h3 className="font-display text-[20px] text-ink">
              Клиентов ещё нет
            </h3>
            <p className="text-[14px] text-ink-3 mt-1 mb-5">
              Создайте первый аккаунт и передайте его клиенту.
            </p>
            {createButton("md")}
          </Panel>
        )}

        {q.data && q.data.length > 0 && (
          <Panel className="anim-fade">
            <PanelHeader>
              <PanelTitle>Список</PanelTitle>
              <span className="text-[12px] text-ink-3">
                {q.data.length}{" "}
                {plural(q.data.length, "клиент", "клиента", "клиентов")}
              </span>
            </PanelHeader>
            <Table>
              <THead>
                <TR>
                  <TH>Клиент</TH>
                  <TH className="hidden md:table-cell">Проекты</TH>
                  <TH>Статус</TH>
                  <TH className="w-28 text-right">Действия</TH>
                </TR>
              </THead>
              <tbody>
                {q.data.map((c) => (
                  <ClientRow key={c.id} client={c} />
                ))}
              </tbody>
            </Table>
          </Panel>
        )}
      </main>
    </>
  );
}

function ClientRow({ client }: { client: Client }) {
  const canUpdate = useHasPermission("clients_can_update");
  const canDeactivate = useHasPermission("clients_can_delete");
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const name =
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    client.email;

  return (
    <TR className={cn(!client.is_active && "opacity-60")}>
      <TD>
        <div className="flex items-center gap-3">
          <Avatar name={name} size={32} />
          <div className="flex flex-col leading-tight">
            <span className="text-ink font-medium">{name}</span>
            <span className="text-[12px] text-ink-3">{client.email}</span>
          </div>
        </div>
      </TD>
      <TD className="hidden md:table-cell">
        {client.projects.length === 0 ? (
          <span className="text-[12px] text-ink-4">Нет проектов</span>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {client.projects.map((p) => (
              <Badge key={p.id} tone="neutral">
                {p.name}
              </Badge>
            ))}
          </div>
        )}
      </TD>
      <TD>
        {client.is_active ? (
          <Badge tone="green">Активен</Badge>
        ) : (
          <Badge tone="red">Деактивирован</Badge>
        )}
      </TD>
      <TD className="text-right">
        <div className="inline-flex items-center gap-1">
          {canUpdate.granted && (
            <>
              <button
                type="button"
                title="Редактировать"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center justify-center h-7 w-7 rounded text-ink-4 hover:text-ink hover:bg-surface-2 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Сменить пароль"
                onClick={() => setPasswordOpen(true)}
                className="inline-flex items-center justify-center h-7 w-7 rounded text-ink-4 hover:text-ink hover:bg-surface-2 transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {canDeactivate.granted && (
            <button
              type="button"
              title={client.is_active ? "Деактивировать" : "Активировать"}
              onClick={() => setToggleOpen(true)}
              className={cn(
                "inline-flex items-center justify-center h-7 w-7 rounded transition-colors",
                client.is_active
                  ? "text-ink-4 hover:text-danger hover:bg-tag-red-bg/40"
                  : "text-ink-4 hover:text-ink hover:bg-surface-2"
              )}
            >
              {client.is_active ? (
                <UserX className="h-3.5 w-3.5" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {!canUpdate.granted && !canDeactivate.granted && (
            <span className="text-[12px] text-ink-4">—</span>
          )}
        </div>
      </TD>
      {editOpen && (
        <EditClientDialog
          client={client}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {passwordOpen && (
        <SetPasswordDialog
          client={client}
          open={passwordOpen}
          onOpenChange={setPasswordOpen}
        />
      )}
      {toggleOpen && (
        <ToggleActiveDialog
          client={client}
          open={toggleOpen}
          onOpenChange={setToggleOpen}
        />
      )}
    </TR>
  );
}
