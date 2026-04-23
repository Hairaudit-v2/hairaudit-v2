"use client";

import Link from "next/link";
import TrackedLink from "@/components/analytics/TrackedLink";
import { useI18n } from "@/components/i18n/I18nProvider";

/**
 * Homepage hero: client for locale + CTA analytics, still SSR’d into the static `/` HTML shell.
 */
export default function HomePageHero() {
  const { t } = useI18n();

  return (
    <section className="relative px-4 sm:px-6 pt-16 sm:pt-20 pb-20 sm:pb-28 lg:pt-24 lg:pb-32">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08]">
          {t("marketing.home.heroTitle")}
        </h1>
        <p className="mt-6 text-xl text-slate-300 max-w-xl mx-auto leading-relaxed">{t("marketing.home.heroLead")}</p>
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
            prefetch
          >
            {t("marketing.home.ctaSampleReport")}
          </Link>
        </div>

        <p className="mt-8 text-sm text-slate-500">{t("marketing.home.heroFootnote")}</p>
        <p className="mt-6 text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
          <span>{t("marketing.home.seoAudienceIntro")}</span>{" "}
          <Link
            href="/clinics"
            className="text-amber-400/90 hover:text-amber-300 underline underline-offset-2 font-medium"
            prefetch
          >
            {t("marketing.home.seoAudienceClinicsLink")}
          </Link>
          {" · "}
          <Link
            href="/professionals"
            className="text-amber-400/90 hover:text-amber-300 underline underline-offset-2 font-medium"
            prefetch
          >
            {t("marketing.home.seoAudienceProfessionalsLink")}
          </Link>
        </p>
      </div>
    </section>
  );
}
