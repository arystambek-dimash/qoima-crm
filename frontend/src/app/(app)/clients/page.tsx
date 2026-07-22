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
import { plural } from "@/lib/utils";
import type { Client } from "@/lib/types";
import { AlertTriangle, Contact, KeyRound, Pencil, Plus } from "lucide-react";
import {
  CreateClientDialog,
  EditClientDialog,
  SetPasswordDialog,
} from "./client-dialogs";

export default function ClientsPage() {
  const access = useHasPermission("employees_can_create");
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
          title="Только для администратора"
          detail="Управление аккаунтами клиентов доступно администраторам Qoima."
        />
      </>
    );
  }

  return (
    <>
      <Topbar
        eyebrow="Компания"
        title="Клиенты"
        actions={
          <CreateClientDialog
            trigger={
              <Button variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Добавить клиента
              </Button>
            }
          />
        }
      />
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
            <CreateClientDialog
              trigger={
                <Button variant="primary" size="md">
                  <Plus className="h-3.5 w-3.5" />
                  Добавить клиента
                </Button>
              }
            />
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
                  <TH className="w-24 text-right">Действия</TH>
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
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const name =
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    client.email;

  return (
    <TR>
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
      <TD className="text-right">
        <div className="inline-flex items-center gap-1">
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
    </TR>
  );
}
