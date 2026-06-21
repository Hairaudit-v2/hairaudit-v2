"use client";

import Link from "next/link";
import TrackedLink from "@/components/analytics/TrackedLink";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import type { TranslationKey } from "@/lib/i18n/translationKeys";

const NAV_ITEMS: { href: string; labelKey: TranslationKey }[] = [
  { href: "/professionals", labelKey: "marketing.professionals.navOverview" },
  { href: "/professionals/apply", labelKey: "marketing.professionals.navCreateProfile" },
  { href: "/professionals/methodology", labelKey: "marketing.professionals.navMethodology" },
  { href: "/professionals/scoring-framework", labelKey: "marketing.professionals.navScoring" },
  { href: "/professionals/evidence-standards", labelKey: "marketing.professionals.navEvidence" },
  { href: "/professionals/clinical-participation", labelKey: "marketing.professionals.navParticipation" },
  { href: "/professionals/legal-documentation", labelKey: "marketing.professionals.navLegal" },
  { href: "/professionals/auditor-standards", labelKey: "marketing.professionals.navAuditor" },
];

export default function ProfessionalsShell({
  currentPath,
  title,
  intro,
  children,
}: {
  currentPath: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const { t } = useI18n();

  const links = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    [t]
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[250px_1fr] lg:gap-10">
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-2xl border border-border/50 bg-card/70 p-4 shadow-fi-panel">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("marketing.professionals.sidebarSection")}
          </p>
          <nav className="space-y-1">
            {links.map((item) => {
              const active = item.href === currentPath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "border border-amber-500/30 bg-amber-500/15 text-amber-300"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-muted-foreground">{intro}</p>
        <div className="mt-8">{children}</div>
        <p className="mt-10 text-sm text-muted-foreground">
          {t("marketing.professionals.footerPatient")}{" "}
          <Link
            href="/how-it-works"
            className="font-medium text-amber-400 transition-colors hover:text-amber-300"
          >
            {t("marketing.professionals.footerHowItWorks")}
          </Link>
          {" · "}
          <TrackedLink
            href="/signup"
            eventName="cta_professional_shell_footer_signup"
            className="font-medium text-cyan-300 transition-colors hover:text-cyan-200"
          >
            {t("marketing.professionals.footerCreateProfile")}
          </TrackedLink>
          .
        </p>
      </div>
    </div>
  );
}

export function ProfessionalsPrimaryCta({
  eventName = "cta_create_professional_profile_professionals",
}: {
  eventName?: string;
}) {
  return (
    <TrackedLink
      href="/professionals/apply"
      eventName={eventName}
      className={fiHairauditPrimaryButtonClass("md")}
    >
      {PUBLIC_CTAS.createProfessionalProfile}
    </TrackedLink>
  );
}
