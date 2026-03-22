"use client";

import { useMemo, useState } from "react";
import { formatTemplate } from "@/lib/i18n/formatTemplate";
import { useI18n } from "@/components/i18n/I18nProvider";

type ReportRow = {
  id: string;
  version: number;
  created_at: string;
  pdf_path: string | null;
  summary?: unknown;
  status?: string;
};

function scoreClass(score?: number) {
  if (typeof score !== "number") return "border-slate-400/30 bg-slate-400/10 text-slate-200";
  if (score >= 85) return "border-emerald-300/40 bg-emerald-300/15 text-emerald-100";
  if (score >= 70) return "border-lime-300/40 bg-lime-300/15 text-lime-100";
  if (score >= 55) return "border-amber-300/40 bg-amber-300/15 text-amber-100";
  return "border-rose-300/40 bg-rose-300/15 text-rose-100";
}

export default function VersionHistoryDrawer({ reports }: { reports: ReportRow[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const history = useMemo(() => (Array.isArray(reports) ? reports : []), [reports]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition-all hover:-translate-y-0.5 hover:bg-white/10"
      >
        {t("reports.actions.openVersionHistory")}
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          <button
            aria-label={t("reports.actions.closeDrawerBackdrop")}
            className="absolute inset-0 bg-slate-950/70"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-white/10 bg-slate-950/95 p-6 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{t("reports.actions.versionHistoryTitle")}</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
              >
                {t("reports.actions.close")}
              </button>
            </div>

            {history.length === 0 ? (
              <p className="text-sm text-slate-300/80">{t("reports.actions.noVersionsYet")}</p>
            ) : (
              <div className="space-y-3 overflow-y-auto pb-6">
                {history.map((report, idx) => {
                  const summary = (report.summary ?? {}) as { score?: number };
                  const score = typeof summary.score === "number" ? summary.score : undefined;
                  const isLatest = idx === 0;
                  const processing = !report.pdf_path && report.status !== "failed";

                  const scorePillLabel =
                    typeof score === "number"
                      ? formatTemplate(t("reports.status.scoreWithValue"), { score })
                      : processing
                        ? t("dashboard.reports.statusProcessing")
                        : t("reports.status.pending");

                  return (
                    <div
                      key={report.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-medium text-white">
                          {isLatest
                            ? t("reports.actions.latestReport")
                            : formatTemplate(t("reports.actions.reportVersion"), { version: String(report.version) })}
                        </p>
                        <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${scoreClass(score)}`}>
                          {scorePillLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{new Date(report.created_at).toLocaleString()}</p>

                      <div className="mt-3 flex gap-2">
                        {report.pdf_path ? (
                          <a
                            href={`/api/reports/${encodeURIComponent(report.id)}/download`}
                            className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100"
                          >
                            {t("reports.actions.download")}
                          </a>
                        ) : (
                          <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100 opacity-50">
                            {t("reports.actions.download")}
                          </span>
                        )}
                        {report.pdf_path ? (
                          <a
                            href={`/api/reports/${encodeURIComponent(report.id)}/download`}
                            className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200"
                          >
                            {t("reports.actions.view")}
                          </a>
                        ) : (
                          <span className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 opacity-50">
                            {t("reports.actions.view")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
