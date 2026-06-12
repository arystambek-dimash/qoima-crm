"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { asApiError } from "@/lib/api";
import { auth } from "@/lib/endpoints";

const requestSchema = z.object({
  email: z.string().email("Введите корректный email."),
});

const confirmSchema = z
  .object({
    email: z.string().email("Введите корректный email."),
    code: z.string().regex(/^\d{6}$/, "Введите 6-значный код."),
    password: z.string().min(6, "Минимум 6 символов."),
    confirmPassword: z.string().min(1, "Повторите пароль."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Пароли не совпадают.",
  });

type Step = "request" | "confirm";
type FieldErrors = Partial<
  Record<"email" | "code" | "password" | "confirmPassword", string>
>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function requestCode(nextEmail: string) {
    const parsed = requestSchema.safeParse({ email: nextEmail });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const result = await auth.requestPasswordReset(parsed.data.email);
      setEmail(parsed.data.email);
      setStep("confirm");
      toast.success(result.detail);
    } catch (err) {
      toast.error(asApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestCode(email);
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = confirmSchema.safeParse({
      email,
      code,
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const result = await auth.confirmPasswordReset({
        email: parsed.data.email,
        code: parsed.data.code,
        password: parsed.data.password,
      });
      toast.success(result.detail);
      router.replace("/login");
    } catch (err) {
      toast.error(asApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas relative">
      <div className="absolute inset-0 bg-dots opacity-60 pointer-events-none" />

      <header className="relative h-14 px-6 lg:px-10 flex items-center justify-between border-b border-hairline">
        <Logo />
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <Link
            href="/login"
            className="text-[13px] text-ink-3 hover:text-ink transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Вход
          </Link>
        </div>
      </header>

      <main className="relative flex-1 grid place-items-center px-6 py-12">
        <div className="w-full max-w-[420px] anim-rise">
          <header className="mb-8">
            <h1 className="font-display text-[32px] tracking-tight text-ink">
              Восстановление пароля
            </h1>
            <p className="mt-3 text-[15px] text-ink-3">
              Одноразовый код придёт в Telegram, который привязан к CRM.
            </p>
          </header>

          {step === "request" ? (
            <form onSubmit={handleRequest} className="flex flex-col gap-4">
              <Field label="Email" hint={errors.email}>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  aria-invalid={!!errors.email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>

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
                    Отправляем…
                  </>
                ) : (
                  <>
                    Отправить код
                    <Send className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="flex flex-col gap-4">
              <Field label="Email" hint={errors.email}>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  aria-invalid={!!errors.email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label="Код из Telegram" hint={errors.code}>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  aria-invalid={!!errors.code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </Field>
              <Field label="Новый пароль" hint={errors.password}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  aria-invalid={!!errors.password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Field label="Повторите пароль" hint={errors.confirmPassword}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  aria-invalid={!!errors.confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>

              <div className="flex items-center justify-between -mt-1">
                <button
                  type="button"
                  disabled={submitting}
                  className="text-[13px] text-ink-3 hover:text-ink transition-colors disabled:opacity-40"
                  onClick={() => {
                    setStep("request");
                    setErrors({});
                  }}
                >
                  Изменить email
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  className="text-[13px] text-accent hover:text-accent-ink transition-colors disabled:opacity-40"
                  onClick={() => requestCode(email)}
                >
                  Отправить ещё раз
                </button>
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
                    Сохраняем…
                  </>
                ) : (
                  <>
                    Сменить пароль
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </main>

      <footer className="relative px-6 lg:px-10 py-4 text-[12px] text-ink-4 flex items-center justify-between border-t border-hairline">
        <span>© Qoima · 2026</span>
        <Link className="hover:text-ink-2 transition-colors" href="/login">
          Вернуться ко входу
        </Link>
      </footer>
    </div>
  );
}

function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path[0] as keyof FieldErrors | undefined;

    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
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
