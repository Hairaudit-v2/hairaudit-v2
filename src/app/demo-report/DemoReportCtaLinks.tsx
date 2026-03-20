"use client";

import TrackedLink from "@/components/analytics/TrackedLink";
import { useI18n } from "@/components/i18n/I18nProvider";
import { trackCta } from "@/lib/analytics/trackCta";

export default function DemoReportCtaLinks() {
  const { t } = useI18n();

  return (
    <>
      <a
        href="/api/print/demo-report"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackCta("cta_view_demo_report_html", { href: "/api/print/demo-report" })}
        className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02]"
      >
        {t("reports.chrome.viewSampleNewTab")}
      </a>
      <TrackedLink
        href="/api/reports/demo-pdf"
        eventName="cta_download_demo_pdf"
        className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:border-white/35 hover:bg-white/10"
      >
        {t("reports.chrome.downloadSamplePdf")}
      </TrackedLink>
    </>
  );
}
