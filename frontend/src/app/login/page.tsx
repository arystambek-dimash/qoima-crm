"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { auth } from "@/lib/endpoints";
import { useAuthStore } from "@/lib/auth-store";
import { asApiError } from "@/lib/api";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ThemeSwitcher } from "@/components/theme-switcher";

const schema = z.object({
  email: z.string().email("Введите корректный email."),
  password: z.string().min(1, "Введите пароль."),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const access = useAuthStore((s) => s.access);

  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (access) router.replace("/dashboard");
  }, [access, router]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const tokens = await auth.loginViaEmail(values.email, values.password);
      setTokens(tokens);
      try {
        const profile = await auth.profile();
        setUser(profile);
      } catch {
        // continue — guard will retry profile fetch
      }
      router.replace("/dashboard");
    } catch (err) {
      toast.error(asApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas relative">
      <div className="absolute inset-0 bg-dots opacity-60 pointer-events-none" />

      {/* Top bar */}
      <header className="relative h-14 px-4 sm:px-6 lg:px-10 flex items-center justify-between border-b border-hairline">
        <Logo />
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <a
            href="#"
            className="text-[13px] text-ink-3 hover:text-ink transition-colors"
          >
            Нужна помощь?
          </a>
        </div>
      </header>

      <main className="relative flex-1 grid place-items-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-[400px] anim-rise">
          <header className="mb-8">
            <h1 className="font-display text-[26px] sm:text-[32px] tracking-tight text-ink">
              С возвращением.
            </h1>
            <p className="mt-3 text-[15px] text-ink-3">
              Войдите в Qoima, чтобы продолжить работу.
            </p>
          </header>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <Field label="Email" hint={errors.email?.message}>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
            </Field>
            <Field label="Пароль" hint={errors.password?.message}>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Введите пароль"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
            </Field>

            <div className="flex items-center justify-between -mt-1">
              <label className="flex items-center gap-2 py-1 text-[13px] text-ink-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="appearance-none h-3.5 w-3.5 border border-hairline-strong bg-canvas rounded checked:bg-accent checked:border-accent relative cursor-pointer"
                />
                Запомнить меня
              </label>
              <Link
                href="/forgot-password"
                className="text-[13px] text-accent hover:text-accent-ink transition-colors"
              >
                Забыли пароль?
              </Link>
            </div>

            <Button
              variant="primary"
              size="lg"
              type="submit"
              disabled={submitting}
              className="w-full mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Вход…
                </>
              ) : (
                <>
                  Войти
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-[13px] text-ink-3 mt-4">
              Нет учётной записи?{" "}
              <a className="text-accent hover:text-accent-ink" href="#">
                Обратитесь к администратору
              </a>
            </p>
          </form>
        </div>
      </main>

      <footer className="relative px-4 sm:px-6 lg:px-10 py-4 text-[12px] text-ink-4 flex flex-wrap gap-y-2 items-center justify-between border-t border-hairline">
        <span>© Qoima · 2026</span>
        <div className="flex items-center gap-4">
          <a className="hover:text-ink-2 transition-colors" href="#">
            Конфиденциальность
          </a>
          <a className="hover:text-ink-2 transition-colors" href="#">
            Условия
          </a>
        </div>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-7 w-7 grid place-items-center rounded-md bg-ink text-canvas">
        <span className="font-display text-[16px] leading-none">Q</span>
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-ink">
        Qoima
      </span>
    </div>
  );
}
