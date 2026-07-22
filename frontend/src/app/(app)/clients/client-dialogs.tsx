"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { clients } from "@/lib/endpoints";
import { asApiError } from "@/lib/api";
import type { Client } from "@/lib/types";

const PASSWORD_HINT = "Минимум 8 символов. Передайте пароль клиенту.";

export function CreateClientDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
  }

  const create = useMutation({
    mutationFn: () =>
      clients.create({
        email,
        password,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Клиент создан. Передайте ему email и пароль.");
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  const canSubmit = !!email && password.length >= 8;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent className="max-w-[480px] p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-hairline">
          <DialogHeader
            eyebrow="Клиенты"
            title="Добавить клиента"
            description="Создайте аккаунт и передайте клиенту email и пароль — он сможет войти в кабинет и добавлять задачи."
          />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) create.mutate();
          }}
          className="flex flex-col gap-4 px-6 py-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Имя">
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Айгерим"
                autoFocus
              />
            </Field>
            <Field label="Фамилия">
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Сапарова"
              />
            </Field>
          </div>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@company.kz"
              required
            />
          </Field>
          <Field label="Пароль" hint={PASSWORD_HINT}>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Придумайте пароль"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </Field>
        </form>
        <div className="px-6 py-3 border-t border-hairline flex items-center justify-end gap-2 bg-surface/40">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => setOpen(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={!canSubmit || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Создаём…" : "Создать"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditClientDialog({
  client,
  open,
  onOpenChange,
}: {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState(client.first_name);
  const [lastName, setLastName] = useState(client.last_name);
  const [email, setEmail] = useState(client.email);

  const update = useMutation({
    mutationFn: () =>
      clients.update(client.id, {
        email,
        first_name: firstName,
        last_name: lastName,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Данные клиента обновлены.");
      onOpenChange(false);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-hairline">
          <DialogHeader
            eyebrow="Клиенты"
            title="Редактировать клиента"
            description="Изменения применяются сразу после сохранения."
          />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
          className="flex flex-col gap-4 px-6 py-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Имя">
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Фамилия">
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
        </form>
        <div className="px-6 py-3 border-t border-hairline flex items-center justify-end gap-2 bg-surface/40">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={!email || update.isPending}
            onClick={() => update.mutate()}
          >
            {update.isPending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ToggleActiveDialog({
  client,
  open,
  onOpenChange,
}: {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const deactivating = client.is_active;

  const toggle = useMutation({
    mutationFn: () =>
      deactivating
        ? clients.deactivate(client.id)
        : clients.activate(client.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(
        deactivating
          ? "Клиент деактивирован — вход в кабинет закрыт."
          : "Клиент снова активен и может входить."
      );
      onOpenChange(false);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-hairline">
          <DialogHeader
            eyebrow="Клиенты"
            title={
              deactivating ? "Деактивировать клиента?" : "Активировать клиента?"
            }
            description={
              deactivating
                ? `${client.email} не сможет войти в кабинет. Проекты и задачи останутся на месте — доступ можно вернуть в любой момент.`
                : `${client.email} снова сможет войти в кабинет со своим паролем.`
            }
          />
        </div>
        <div className="px-6 py-3 border-t border-hairline flex items-center justify-end gap-2 bg-surface/40">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant={deactivating ? "danger" : "primary"}
            size="md"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate()}
          >
            {toggle.isPending
              ? "Сохраняем…"
              : deactivating
              ? "Деактивировать"
              : "Активировать"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SetPasswordDialog({
  client,
  open,
  onOpenChange,
}: {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");

  const setPasswordMutation = useMutation({
    mutationFn: () => clients.setPassword(client.id, password),
    onSuccess: () => {
      toast.success("Пароль обновлён. Передайте его клиенту.");
      onOpenChange(false);
      setPassword("");
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  const canSubmit = password.length >= 8;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-hairline">
          <DialogHeader
            eyebrow="Клиенты"
            title="Сменить пароль"
            description={`Новый пароль для ${client.email}. Старый перестанет действовать сразу.`}
          />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) setPasswordMutation.mutate();
          }}
          className="flex flex-col gap-4 px-6 py-5"
        >
          <Field label="Новый пароль" hint={PASSWORD_HINT}>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Придумайте пароль"
              autoComplete="new-password"
              autoFocus
              required
              minLength={8}
            />
          </Field>
        </form>
        <div className="px-6 py-3 border-t border-hairline flex items-center justify-end gap-2 bg-surface/40">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={!canSubmit || setPasswordMutation.isPending}
            onClick={() => setPasswordMutation.mutate()}
          >
            {setPasswordMutation.isPending ? "Сохраняем…" : "Сменить пароль"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
