"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/app-shell/topbar";
import { Panel, PanelHeader, PanelTitle, PanelBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input, Field } from "@/components/ui/input";
import { auth } from "@/lib/endpoints";
import { useAuthStore } from "@/lib/auth-store";
import { LogOut, Mail, ShieldCheck } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const cachedUser = useAuthStore((s) => s.user);

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: auth.profile,
    initialData: cachedUser ?? undefined,
  });

  const user = profileQ.data ?? cachedUser;

  if (!user)
    return (
      <>
        <Topbar eyebrow="Аккаунт" title="Профиль" />
        <main className="p-12 text-[13px] text-ink-3">Загрузка…</main>
      </>
    );

  const name = `${user.first_name} ${user.last_name}`.trim() || user.username;

  return (
    <>
      <Topbar eyebrow="Аккаунт" title="Профиль" />
      <main className="flex-1 px-6 lg:px-10 py-10 max-w-[960px] mx-auto w-full stagger">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <Avatar name={name} size={72} className="text-[22px]" />
            <div>
              <h1 className="font-display text-[28px] tracking-tight text-ink">
                {name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="purple">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  {user.role}
                </Badge>
                <Badge tone="blue">
                  <Mail className="h-2.5 w-2.5" />
                  {user.email}
                </Badge>
                <Badge tone="gray">@{user.username}</Badge>
              </div>
            </div>
          </div>
          <Button
            variant="danger"
            size="md"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Выйти
          </Button>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>Данные аккаунта</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-4">
              <Field label="Имя">
                <Input value={user.first_name ?? ""} readOnly />
              </Field>
              <Field label="Фамилия">
                <Input value={user.last_name ?? ""} readOnly />
              </Field>
              <Field label="Email">
                <Input value={user.email} readOnly />
              </Field>
              <Field label="Логин">
                <Input value={user.username} readOnly />
              </Field>
              <Field
                label="Telegram ID"
                hint="Send /whoami to the bot and ask an admin to set this value if it is empty."
              >
                <Input value={user.telegram_id ?? ""} readOnly />
              </Field>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Сессии и безопасность</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-3">
              <SecurityRow
                title="Текущее устройство"
                detail="Этот браузер · только что"
                accent
              />
              <SecurityRow
                title="Refresh-токен"
                detail="Обновляется автоматически каждые 10 минут"
              />
              <SecurityRow
                title="Способ входа"
                detail="Email и пароль · JWT (SimpleJWT)"
              />
              <div className="pt-3 border-t border-hairline">
                <Button variant="outline" size="sm">
                  Сменить пароль
                </Button>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </main>
    </>
  );
}

function SecurityRow({
  title,
  detail,
  accent,
}: {
  title: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-hairline pb-3 last:border-0 last:pb-0">
      <div>
        <div className="text-[14px] text-ink font-medium">{title}</div>
        <div className="text-[12px] text-ink-3">{detail}</div>
      </div>
      {accent && (
        <Badge tone="green" dot>
          активна
        </Badge>
      )}
    </div>
  );
}
