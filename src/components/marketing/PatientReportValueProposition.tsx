"use client";

import TrackedLink from "@/components/analytics/TrackedLink";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";

const BULLET_KEYS = [
  "marketing.home.patientReportValue.bullet1",
  "marketing.home.patientReportValue.bullet2",
  "marketing.home.patientReportValue.bullet3",
  "marketing.home.patientReportValue.bullet4",
] as const satisfies readonly TranslationKey[];

const GUIDE_TEASER_BULLET_KEYS = [
  "marketing.home.patientReportValue.guideTeaserBullet1",
  "marketing.home.patientReportValue.guideTeaserBullet2",
  "marketing.home.patientReportValue.guideTeaserBullet3",
  "marketing.home.patientReportValue.guideTeaserBullet4",
] as const satisfies readonly TranslationKey[];

const FEATURE_KEYS: { titleKey: TranslationKey; descKey: TranslationKey }[] = [
  {
    titleKey: "marketing.home.patientReportValue.feature1Title",
    descKey: "marketing.home.patientReportValue.feature1Desc",
  },
  {
    titleKey: "marketing.home.patientReportValue.feature2Title",
    descKey: "marketing.home.patientReportValue.feature2Desc",
  },
  {
    titleKey: "marketing.home.patientReportValue.feature3Title",
    descKey: "marketing.home.patientReportValue.feature3Desc",
  },
  {
    titleKey: "marketing.home.patientReportValue.feature4Title",
    descKey: "marketing.home.patientReportValue.feature4Desc",
  },
];

export default function PatientReportValueProposition() {
  const { t } = useI18n();

  return (
    <section
      className="relative px-4 sm:px-6 py-20 sm:py-24 border-t border-slate-700/60 bg-slate-800/20"
      aria-labelledby="patient-report-value-heading"
    >
      <div className="max-w-5xl mx-auto">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400/90">
          {t("marketing.home.patientReportValue.eyebrow")}
        </p>
        <h2
          id="patient-report-value-heading"
          className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight"
        >
          {t("marketing.home.patientReportValue.headline")}
        </h2>
        <p className="mt-5 text-lg text-slate-300 leading-relaxed max-w-3xl">
          {t("marketing.home.patientReportValue.lead")}
        </p>
        <ul className="mt-8 space-y-3 text-slate-300 max-w-3xl">
          {BULLET_KEYS.map((key) => (
            <li key={key} className="flex items-start gap-3">
              <span className="text-amber-400 mt-0.5 flex-shrink-0" aria-hidden>
                ✓
              </span>
              {t(key)}
            </li>
          ))}
        </ul>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURE_KEYS.map((item) => (
            <div
              key={item.titleKey}
              className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 sm:p-6"
            >
              <h3 className="text-base font-semibold text-white">{t(item.titleKey)}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{t(item.descKey)}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.07] to-slate-900/60 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">
            {t("marketing.home.patientReportValue.guideTeaserEyebrow")}
          </p>
          <h3 className="mt-3 text-xl sm:text-2xl font-bold text-white tracking-tight">
            {t("marketing.home.patientReportValue.guideTeaserTitle")}
          </h3>
          <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
            {t("marketing.home.patientReportValue.guideTeaserLead")}
          </p>
          <ul className="mt-5 space-y-2 text-sm text-slate-300 max-w-2xl">
            {GUIDE_TEASER_BULLET_KEYS.map((key) => (
              <li key={key} className="flex gap-2">
                <span className="text-amber-400/90 shrink-0" aria-hidden>
                  ·
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <TrackedLink
              href="/post-op-hair-protection-guide"
              eventName="cta_post_op_guide_landing_from_home"
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-amber-400/40 bg-amber-500/15 text-amber-100 font-semibold text-sm hover:bg-amber-500/25 transition-colors"
            >
              {t("marketing.home.patientReportValue.guideTeaserCta")}
            </TrackedLink>
          </div>
          <p className="mt-4 text-xs text-slate-500 leading-relaxed max-w-2xl">
            {t("marketing.home.patientReportValue.guideTeaserFootnote")}
          </p>
        </div>
      </div>
    </section>
  );
}
