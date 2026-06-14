"use client";

import Link from "next/link";
import TrackedLink from "@/components/analytics/TrackedLink";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function FaqConversionFooter() {
  const { t } = useI18n();

  return (
    <div className="mt-12 sm:mt-14 flex flex-col flex-wrap gap-3 sm:flex-row">
      <TrackedLink
        href="/request-review"
        eventName="cta_start_free_audit_faq_footer"
        className="inline-flex min-w-0 items-center justify-center rounded-xl bg-amber-400 px-6 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
      >
        {t("marketing.faqFooter.ctaStartAudit")}
      </TrackedLink>
      <TrackedLink
        href="/demo-report"
        eventName="cta_interactive_demo_faq_footer"
        className="inline-flex min-w-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-medium text-slate-100 transition hover:bg-white/10"
      >
        {t("marketing.faqFooter.ctaInteractiveDemo")}
      </TrackedLink>
      <Link
        href="/methodology"
        className="inline-flex min-w-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-medium text-slate-100 transition hover:bg-white/10"
      >
        {t("marketing.faqFooter.ctaMethodology")}
      </Link>
      <TrackedLink
        href="/professionals"
        eventName="cta_professional_standards_faq_footer"
        className="inline-flex min-w-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-medium text-slate-100 transition hover:bg-white/10"
      >
        {t("marketing.faqFooter.ctaProfessionals")}
      </TrackedLink>
    </div>
  );
}
