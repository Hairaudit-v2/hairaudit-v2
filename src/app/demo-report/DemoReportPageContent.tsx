"use client";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TrackedLink from "@/components/analytics/TrackedLink";
import DemoReportCtaLinks from "./DemoReportCtaLinks";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function DemoReportPageContent() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_88%_55%,rgba(56,189,248,0.06),transparent)]" />
      </div>

      <SiteHeader />

      <main className="relative flex-1">
        <section className="px-4 sm:px-6 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
              {t("reports.chrome.demo.badge")}
            </p>
            <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
              {t("reports.chrome.demo.title")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">{t("reports.chrome.demo.lead")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <DemoReportCtaLinks />
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-12">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-2xl border border-white/12 bg-white/[0.03] overflow-hidden backdrop-blur">
              <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t("reports.chrome.demo.previewLabel")}
                </span>
                <div className="flex gap-2">
                  <a
                    href="/api/print/demo-report"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                  >
                    {t("reports.chrome.demo.openNewTab")}
                  </a>
                  <a
                    href="/api/reports/demo-pdf"
                    className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                  >
                    {t("reports.actions.downloadPdf")}
                  </a>
                </div>
              </div>
              <iframe
                title={t("reports.chrome.demo.iframeTitle")}
                src="/api/print/demo-report"
                className="w-full h-[720px] sm:h-[840px] bg-white border-0"
              />
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-gradient-to-r from-amber-400/10 via-slate-900/80 to-cyan-400/10 p-8 text-center shadow-2xl shadow-black/30 sm:text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">{t("reports.chrome.demo.nextStepsEyebrow")}</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {t("reports.chrome.demo.nextStepsTitle")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-slate-200 sm:mx-0">{t("reports.chrome.demo.nextStepsBody")}</p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">
              <TrackedLink
                href="/request-review"
                eventName="cta_start_free_audit_demo_page"
                className="inline-flex min-w-0 items-center justify-center rounded-xl bg-amber-400 px-6 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
              >
                {t("marketing.sampleReport.footerCtaStartAudit")}
              </TrackedLink>
              <TrackedLink
                href="/sample-report"
                eventName="cta_sample_report_overview_demo_footer"
                className="inline-flex min-w-0 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {t("marketing.sampleReport.footerCtaInteractiveDemo")}
              </TrackedLink>
              <TrackedLink
                href="/api/reports/demo-pdf"
                eventName="cta_download_demo_pdf_demo_footer"
                className="inline-flex min-w-0 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-6 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
              >
                {t("reports.actions.downloadPdf")}
              </TrackedLink>
              <TrackedLink
                href="/professionals"
                eventName="cta_professional_standards_demo_footer"
                className="inline-flex min-w-0 items-center justify-center rounded-xl border border-white/15 bg-transparent px-4 py-3 text-center text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline sm:border-0 sm:px-2"
              >
                {t("marketing.sampleReport.footerProfessionalLink")}
              </TrackedLink>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
