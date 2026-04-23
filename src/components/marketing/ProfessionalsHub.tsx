"use client";

import Link from "next/link";
import ProfessionalsShell from "@/components/professionals/ProfessionalsShell";
import { useI18n } from "@/components/i18n/I18nProvider";
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CARDS.map((card) => (
          <div key={card.href}>
            <Link
              href={card.href}
              className="group block rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-white/20 transition-colors h-full"
            >
              <h2 className="text-lg font-semibold text-white group-hover:text-amber-300 transition-colors">
                {t(card.titleKey)}
              </h2>
              <p className="mt-3 text-sm text-slate-400">{t(card.descKey)}</p>
            </Link>
          </div>
        ))}
      </div>
    </ProfessionalsShell>
  );
}
