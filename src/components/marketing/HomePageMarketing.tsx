"use client";

import Link from "next/link";
import nextDynamic from "next/dynamic";
import TrackedLink from "@/components/analytics/TrackedLink";
import CertifiedClinicsSection from "@/components/home/CertifiedClinicsSection";
import PatientReportValueProposition from "@/components/marketing/PatientReportValueProposition";
import { useI18n } from "@/components/i18n/I18nProvider";
import { StepIcons } from "@/components/ui/StepIcons";
import type { TranslationKey } from "@/lib/i18n/translationKeys";

const GlobalHairIntelligenceSection = nextDynamic(
  () => import("@/components/ecosystem/GlobalHairIntelligenceSection").then((m) => m.default),
  { ssr: true }
);

function stepEyebrow(t: (key: TranslationKey) => string, n: number) {
  return t("marketing.shared.stepEyebrow").replace(/\{\{n\}\}/g, String(n));
}

export default function HomePageMarketing() {
  const { t } = useI18n();

  const howSteps = [
    {
      titleKey: "marketing.home.howStep1Title" as const,
      descKey: "marketing.home.howStep1Desc" as const,
      icon: StepIcons.submit,
    },
    {
      titleKey: "marketing.home.howStep2Title" as const,
      descKey: "marketing.home.howStep2Desc" as const,
      icon: StepIcons.review,
    },
    {
      titleKey: "marketing.home.howStep3Title" as const,
      descKey: "marketing.home.howStep3Desc" as const,
      icon: StepIcons.report,
    },
  ] as const;

  const whatYouGet = [
    { titleKey: "marketing.home.wygScoreTitle" as const, descKey: "marketing.home.wygScoreDesc" as const },
    { titleKey: "marketing.home.wygDonorTitle" as const, descKey: "marketing.home.wygDonorDesc" as const },
    { titleKey: "marketing.home.wygDensityTitle" as const, descKey: "marketing.home.wygDensityDesc" as const },
    { titleKey: "marketing.home.wygTechniqueTitle" as const, descKey: "marketing.home.wygTechniqueDesc" as const },
    { titleKey: "marketing.home.wygRecoTitle" as const, descKey: "marketing.home.wygRecoDesc" as const },
  ] as const;

  const whoForKeys = [
    "marketing.home.whoFor1",
    "marketing.home.whoFor2",
    "marketing.home.whoFor3",
    "marketing.home.whoFor4",
  ] as const satisfies readonly TranslationKey[];

  const sampleTeaserLiKeys = [
    "marketing.home.sampleTeaserLi1",
    "marketing.home.sampleTeaserLi2",
    "marketing.home.sampleTeaserLi3",
    "marketing.home.sampleTeaserLi4",
  ] as const satisfies readonly TranslationKey[];

  return (
    <main id="main-content" className="relative flex-1">
      <section className="relative px-4 sm:px-6 pt-16 sm:pt-20 pb-20 sm:pb-28 lg:pt-24 lg:pb-32">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08]">
            {t("marketing.home.heroTitle")}
          </h1>
          <p className="mt-6 text-xl text-slate-300 max-w-xl mx-auto leading-relaxed">
            {t("marketing.home.heroLead")}
          </p>
          <p className="mt-4 text-slate-400 max-w-lg mx-auto">{t("marketing.home.heroSupporting")}</p>
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <TrackedLink
              href="/request-review"
              eventName="cta_start_audit_hero"
              className="inline-flex items-center justify-center px-10 py-4 rounded-2xl bg-amber-500 text-slate-900 font-semibold text-lg hover:bg-amber-400 transition-colors border border-amber-400/50 shadow-lg shadow-amber-500/20"
            >
              {t("marketing.home.ctaStartAudit")}
            </TrackedLink>
            <Link
              href="/demo-report"
              className="inline-flex items-center justify-center px-8 py-4 rounded-2xl border-2 border-slate-500 text-slate-200 font-medium hover:border-amber-500/50 hover:text-amber-400 transition-colors"
            >
              {t("marketing.home.ctaSampleReport")}
            </Link>
          </div>
          <p className="mt-8 text-sm text-slate-500">{t("marketing.home.heroFootnote")}</p>
        </div>
      </section>

      <section className="relative px-4 sm:px-6 py-20 sm:py-24 border-t border-slate-700/60">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {t("marketing.home.howItWorksTitle")}
          </h2>
          <div className="mt-12 grid sm:grid-cols-3 gap-8 sm:gap-6">
            {howSteps.map((step, index) => (
              <div
                key={step.titleKey}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-6 flex flex-col items-center text-center"
              >
                <span className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                  {step.icon}
                </span>
                <p className="mt-4 text-sm font-semibold text-amber-400/90 uppercase tracking-wider">
                  {stepEyebrow(t, index + 1)}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{t(step.titleKey)}</h3>
                <p className="mt-3 text-slate-400 text-sm leading-relaxed">{t(step.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PatientReportValueProposition />

      <GlobalHairIntelligenceSection
        variant="hairaudit"
        heading={t("marketing.home.ecosystemHeading")}
        description={t("marketing.home.ecosystemDescription")}
        size="hero"
        theme="light"
      />

      <CertifiedClinicsSection />

      <section className="relative px-4 sm:px-6 py-20 sm:py-24 bg-slate-800/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {t("marketing.home.whatYouGetTitle")}
          </h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {whatYouGet.map((item) => (
              <div
                key={item.titleKey}
                className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 sm:p-6"
              >
                <h3 className="text-base font-semibold text-white">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{t(item.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-4 sm:px-6 py-20 sm:py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {t("marketing.home.sampleTeaserTitle")}
          </h2>
          <p className="mt-5 text-slate-300 leading-relaxed text-lg">{t("marketing.home.sampleTeaserLead")}</p>
          <ul className="mt-8 space-y-3 text-slate-300">
            {sampleTeaserLiKeys.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <span className="text-amber-400 mt-0.5" aria-hidden>
                  ✓
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <TrackedLink
              href="/demo-report"
              eventName="cta_view_sample_report_teaser"
              className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors border border-amber-400/50"
            >
              {t("marketing.home.ctaFullSampleReport")}
            </TrackedLink>
          </div>
        </div>
      </section>

      <section className="relative px-4 sm:px-6 py-20 sm:py-24 bg-slate-800/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {t("marketing.home.whyMattersTitle")}
          </h2>
          <div className="mt-6 space-y-4 text-slate-300 leading-relaxed text-lg">
            <p>{t("marketing.home.whyMattersP1")}</p>
            <p className="text-slate-200 font-medium">{t("marketing.home.whyMattersP2")}</p>
          </div>
        </div>
      </section>

      <section className="relative px-4 sm:px-6 py-20 sm:py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {t("marketing.home.whoForTitle")}
          </h2>
          <ul className="mt-10 space-y-4">
            {whoForKeys.map((key) => (
              <li
                key={key}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-slate-300"
              >
                <span className="text-amber-400 mt-0.5 flex-shrink-0" aria-hidden>
                  •
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative px-4 sm:px-6 py-16 sm:py-20 bg-slate-800/30">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {t("marketing.home.privacyTitle")}
          </h2>
          <p className="mt-4 text-slate-400 leading-relaxed">{t("marketing.home.privacyBody")}</p>
        </div>
      </section>

      <section className="relative px-4 sm:px-6 py-24 sm:py-28 border-t border-slate-700/60">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {t("marketing.home.finalCtaTitle")}
          </h2>
          <p className="mt-5 text-xl text-slate-300">{t("marketing.home.finalCtaSubtitle")}</p>
          <div className="mt-10">
            <TrackedLink
              href="/request-review"
              eventName="cta_start_audit_final"
              className="inline-flex items-center justify-center px-10 py-4 rounded-2xl bg-amber-500 text-slate-900 font-semibold text-lg hover:bg-amber-400 transition-colors border border-amber-400/50 shadow-lg shadow-amber-500/20"
            >
              {t("marketing.home.ctaStartAudit")}
            </TrackedLink>
          </div>
        </div>
      </section>
    </main>
  );
}
