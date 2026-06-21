"use client";

import Link from "next/link";
import TrackedLink from "@/components/analytics/TrackedLink";
import ProfessionalsShell from "@/components/professionals/ProfessionalsShell";
import PublicTrustArchitectureBlock from "@/components/marketing/PublicTrustArchitectureBlock";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import type { TranslationKey } from "@/lib/i18n/translationKeys";

const CARDS: { href: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  {
    href: "/professionals/apply",
    titleKey: "marketing.professionals.cardApplyTitle",
    descKey: "marketing.professionals.cardApplyDesc",
  },
  {
    href: "/professionals/methodology",
    titleKey: "marketing.professionals.cardMethodologyTitle",
    descKey: "marketing.professionals.cardMethodologyDesc",
  },
  {
    href: "/professionals/scoring-framework",
    titleKey: "marketing.professionals.cardScoringTitle",
    descKey: "marketing.professionals.cardScoringDesc",
  },
  {
    href: "/professionals/evidence-standards",
    titleKey: "marketing.professionals.cardEvidenceTitle",
    descKey: "marketing.professionals.cardEvidenceDesc",
  },
  {
    href: "/professionals/clinical-participation",
    titleKey: "marketing.professionals.cardParticipationTitle",
    descKey: "marketing.professionals.cardParticipationDesc",
  },
  {
    href: "/professionals/legal-documentation",
    titleKey: "marketing.professionals.cardLegalTitle",
    descKey: "marketing.professionals.cardLegalDesc",
  },
  {
    href: "/professionals/auditor-standards",
    titleKey: "marketing.professionals.cardAuditorTitle",
    descKey: "marketing.professionals.cardAuditorDesc",
  },
];

export default function ProfessionalsHub() {
  const { t } = useI18n();

  return (
    <ProfessionalsShell
      currentPath="/professionals"
      title={t("marketing.professionals.pageTitle")}
      intro={t("marketing.professionals.pageIntro")}
    >
      <PublicTrustArchitectureBlock surface="fi" className="mb-8" />
      <div className="mb-8">
        <TrackedLink
          href="/professionals/apply"
          eventName="cta_create_professional_profile_hub"
          className={fiHairauditPrimaryButtonClass("md")}
        >
          {PUBLIC_CTAS.createProfessionalProfile}
        </TrackedLink>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <div key={card.href}>
            <Link
              href={card.href}
              className="group block h-full rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel transition-colors hover:border-border"
            >
              <h2 className="text-lg font-semibold text-foreground transition-colors group-hover:text-amber-300">
                {t(card.titleKey)}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">{t(card.descKey)}</p>
            </Link>
          </div>
        ))}
      </div>
    </ProfessionalsShell>
  );
}
