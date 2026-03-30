import "./globals.css";
import GoogleTagManager from "@/components/analytics/GoogleTagManager";
import ClientAnalytics from "@/components/analytics/ClientAnalytics";
import AuthAttributionRecorder from "@/components/analytics/AuthAttributionRecorder";
import { logAuthEnvHealthOnce } from "@/lib/auth/validateAuthEnv";
import RecoveryHashRouter from "@/components/RecoveryHashRouter";
import MainContentTarget from "@/components/a11y/MainContentTarget";
import BetaBanner from "@/components/BetaBanner";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import I18nHtmlLang from "@/components/i18n/I18nHtmlLang";
import SkipLinkI18n from "@/components/i18n/SkipLinkI18n";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SITE_URL } from "@/lib/constants";

const metadataBaseUrl =
  (process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? SITE_URL).replace(
    /\/+$/,
    ""
  );

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: {
    default: "HairAudit",
    template: "%s",
  },
  description:
    "Independent, evidence-based hair transplant review for patients and professionals.",
  openGraph: {
    type: "website",
    siteName: "HairAudit",
    title: "HairAudit",
    description:
      "Independent, evidence-based hair transplant review for patients and professionals.",
    url: "/",
    images: [
      {
        url: "/hairaudit-logo.svg",
        alt: "HairAudit",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HairAudit",
    description:
      "Independent, evidence-based hair transplant review for patients and professionals.",
    images: ["/hairaudit-logo.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  logAuthEnvHealthOnce();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <GoogleTagManager />
        <I18nProvider>
          <I18nHtmlLang />
          <SkipLinkI18n />
          <BetaBanner />
          <MainContentTarget />
          <RecoveryHashRouter />
          <Suspense fallback={null}>
            <AuthAttributionRecorder />
          </Suspense>
          {children}
          <ClientAnalytics />
        </I18nProvider>
      </body>
    </html>
  );
}
