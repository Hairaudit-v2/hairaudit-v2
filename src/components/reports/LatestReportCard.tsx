"use client";

import { formatTemplate } from "@/lib/i18n/formatTemplate";
import { useI18n } from "@/components/i18n/I18nProvider";
import ReportShareButton from "./ReportShareButton";

type LatestReport = {
  id: string;
  version: number;
  created_at: string;
  pdf_path: string | null;
  summary?: unknown;
  status?: string;
};

function scoreChip(score?: number) {
  if (typeof score !== "number") return "border-slate-400/30 bg-slate-400/10 text-slate-200";
  if (score >= 85) return "border-emerald-300/40 bg-emerald-300/15 text-emerald-100";
  if (score >= 70) return "border-lime-300/40 bg-lime-300/15 text-lime-100";
  if (score >= 55) return "border-amber-300/40 bg-amber-300/15 text-amber-100";
  return "border-rose-300/40 bg-rose-300/15 text-rose-100";
}

type Props = { report: LatestReport | null; caseId?: string | null; displayScore?: number | null };

export default function LatestReportCard({ report, caseId, displayScore }: Props) {
  const { t } = useI18n();
  const pdfHref = report?.pdf_path ? `/api/reports/${encodeURIComponent(report.id)}/download` : null;

  if (!report) {
    return <p className="text-sm text-slate-300/80">{t("reports.actions.noReportYet")}</p>;
  }

  const summary = (report.summary ?? {}) as { score?: number };
  const rawScore = typeof summary.score === "number" ? summary.score : undefined;
  const score = typeof displayScore === "number" ? displayScore : rawScore;
  const processing = !report.pdf_path && report.status !== "failed";

  const scorePillLabel =
    typeof score === "number"
      ? formatTemplate(t("reports.status.scoreWithValue"), { score })
      : processing
        ? t("dashboard.reports.statusProcessing")
        : t("reports.status.pending");

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium text-white">
          {formatTemplate(t("reports.actions.latestReportVersion"), { version: String(report.version) })}
        </p>
        <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${scoreChip(score)}`}>{scorePillLabel}</span>
      </div>
      <p className="text-xs text-slate-400">{new Date(report.created_at).toLocaleString()}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pdfHref ? (
          <a
            href={pdfHref}
            className="rounded-md border border-cyan-300/30 bg-cyan-300/15 px-3 py-1.5 text-xs font-medium text-cyan-100"
          >
            {t("reports.actions.downloadPdf")}
          </a>
        ) : (
          <span className="rounded-md border border-cyan-300/30 bg-cyan-300/15 px-3 py-1.5 text-xs font-medium text-cyan-100 opacity-50">
            {t("reports.actions.downloadPdf")}
          </span>
        )}
        {pdfHref ? (
          <a
            href={pdfHref}
            className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100"
          >
            {t("reports.actions.viewReport")}
          </a>
        ) : (
          <span className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 opacity-50">
            {t("reports.actions.viewReport")}
          </span>
        )}
        <ReportShareButton caseId={caseId} variant="compact" />
      </div>
      <p className="mt-2 text-xs text-slate-400/80">{t("reports.actions.useHintContext")}</p>
    </div>
  );
}
