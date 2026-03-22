"use client";

import Link from "next/link";
import DownloadReport from "@/app/cases/[caseId]/download-report";
import ReportShareButton from "@/components/reports/ReportShareButton";
import { useI18n } from "@/components/i18n/I18nProvider";

export type PatientReportCaseRow = {
  id: string;
  title: string | null;
  created_at: string;
};

export default function PatientReportsCompletedCaseList({
  cases,
  pdfByCase,
  reportIdByCase,
}: {
  cases: PatientReportCaseRow[];
  pdfByCase: Record<string, string>;
  reportIdByCase: Record<string, string>;
}) {
  const { t } = useI18n();

  return (
    <ul className="relative mt-6 space-y-3">
      {cases.map((c) => {
        const pdfPath = pdfByCase[c.id];
        const reportId = reportIdByCase[c.id];
        const isReportReady = Boolean(pdfPath);

        return (
          <li key={c.id}>
            <div className="group relative rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur transition-all hover:border-white/15 hover:bg-white/8">
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/cases/${c.id}`}
                      className="text-sm font-semibold text-white transition-colors hover:text-cyan-200 sm:text-base"
                    >
                      {c.title ?? t("dashboard.reports.patientAuditFallback")}
                    </Link>
                    <div className="mt-1 text-xs text-slate-200/70">
                      {t("dashboard.reports.createdLabel")} {new Date(c.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={
                      isReportReady
                        ? "shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-100"
                        : "shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-200"
                    }
                  >
                    {isReportReady ? t("dashboard.reports.statusReportReady") : t("dashboard.reports.statusComplete")}
                  </span>
                </div>

                {isReportReady && (
                  <>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/cases/${c.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:from-cyan-200 hover:to-emerald-200"
                      >
                        {t("dashboard.reports.viewReport")}
                      </Link>
                      {reportId ? (
                        <DownloadReport reportId={reportId} label={t("dashboard.reports.downloadPdf")} />
                      ) : null}
                      <ReportShareButton caseId={c.id} variant="default" />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400/90">{t("dashboard.reports.shareHint")}</p>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
