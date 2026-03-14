import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { logAuthEnvHealthOnce } from "@/lib/auth/validateAuthEnv";
import RecoveryHashRouter from "@/components/RecoveryHashRouter";
import MainContentTarget from "@/components/a11y/MainContentTarget";
import BetaBanner from "@/components/BetaBanner";
import type { Metadata } from "next";
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
    <html lang="en">
      <body className="min-h-screen">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <BetaBanner />
        <MainContentTarget />
        <RecoveryHashRouter />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
