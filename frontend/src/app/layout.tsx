import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeScript } from "@/components/theme-script";
import { ThemeToaster } from "@/components/theme-toaster";

export const metadata: Metadata = {
  title: "Qoima — CRM",
  description:
    "Qoima CRM: проекты, сотрудники, задачи и финансы в одной рабочей среде.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ru"
      data-theme="light"
      suppressHydrationWarning
      className="h-full"
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full bg-canvas text-ink">
        <Providers>{children}</Providers>
        <ThemeToaster />
      </body>
    </html>
  );
}
