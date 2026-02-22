import { ClerkProvider } from "@clerk/nextjs";
import { zhCN } from "@clerk/localizations";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { PendingInvitationConsumer } from "@/components/auth/pending-invitation-consumer";
import { AccountRecoveryBanner } from "@/components/user/account-recovery-banner";
import { routing } from "@/i18n/routing";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <ClerkProvider localization={locale === "zh" ? zhCN : undefined}>
      <html lang={locale}>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <NextIntlClientProvider>
            <Providers>
              <AccountRecoveryBanner />
              {children}
            </Providers>
          </NextIntlClientProvider>
          <PendingInvitationConsumer />
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
