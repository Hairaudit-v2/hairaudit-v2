"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
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
    <div className="grid lg:grid-cols-[250px_1fr] gap-8 lg:gap-10">
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold px-2 pb-2">
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
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "text-slate-300 hover:text-white hover:bg-white/5"
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
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{title}</h1>
        <p className="mt-4 text-slate-400 max-w-3xl">{intro}</p>
        <div className="mt-8">{children}</div>
        <p className="mt-10 text-sm text-slate-500">
          {t("marketing.professionals.footerPatient")}{" "}
          <Link href="/how-it-works" className="text-amber-400 hover:text-amber-300 transition-colors">
            {t("marketing.professionals.footerHowItWorks")}
          </Link>
          {" · "}
          <Link href="/signup" className="text-cyan-300 hover:text-cyan-200 transition-colors">
            {t("marketing.professionals.footerCreateProfile")}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
