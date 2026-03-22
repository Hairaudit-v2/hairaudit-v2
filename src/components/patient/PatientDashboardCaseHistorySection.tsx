"use client";

import Link from "next/link";
import CreateCaseButton from "@/app/dashboard/create-case-button";
import { useI18n } from "@/components/i18n/I18nProvider";
import PatientNextActionPanel from "@/components/patient/PatientNextActionPanel";
import DeleteDraftCaseButton from "@/app/dashboard/patient/DeleteDraftCaseButton";

export type PatientCaseRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  submitted_at: string | null;
};

function resolveStatusLabel(
  status: string,
  isReportReady: boolean,
  t: (key: string) => string
): string {
  if (isReportReady) return t("dashboard.reports.statusReportReady");
  const s = status.toLowerCase();
  if (s === "complete") return t("dashboard.reports.statusComplete");
  if (s === "submitted" || s === "processing") return t("dashboard.reports.statusProcessing");
  if (s === "audit_failed") return t("dashboard.reports.statusAuditFailed");
  if (s === "draft") return t("dashboard.reports.statusDraft");
  return status;
}

export default function PatientDashboardCaseHistorySection({
  cases,
  pdfByCase,
  reportIdByCase,
}: {
  cases: PatientCaseRow[] | null | undefined;
  pdfByCase: Record<string, string>;
  reportIdByCase: Record<string, string>;
}) {
  const { t } = useI18n();
  const list = cases ?? [];

  return (
    <section className="relative mt-10 overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("dashboard.patient.caseHistory.title")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-200/70">{t("dashboard.patient.caseHistory.subtitle")}</p>
        </div>
        <CreateCaseButton variant="premium" />
      </div>

      {list.length === 0 ? (
        <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur">
          <p className="mb-4 text-slate-200/80">{t("dashboard.patient.caseHistory.empty")}</p>
          <div className="inline-flex">
            <CreateCaseButton variant="premium" />
          </div>
        </div>
      ) : (
        <ul className="relative mt-5 space-y-3">
          {list.map((c) => {
            const status = String(c.status ?? "draft");
            const canDeleteDraft = status === "draft" && !c.submitted_at;
            const pdfPath = pdfByCase[c.id];
            const reportId = reportIdByCase[c.id];
            const isReportReady = status === "complete" && Boolean(pdfPath);
            const isProcessing = status === "submitted" || status === "processing";

            const statusLabel = resolveStatusLabel(status, isReportReady, t);

            const pill =
              isReportReady
                ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
                : status === "complete"
                  ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                  : isProcessing
                    ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
                    : status === "audit_failed"
                      ? "border-rose-300/20 bg-rose-300/10 text-rose-200"
                      : "border-white/10 bg-white/5 text-slate-200/80";

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
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${pill}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="mt-4">
                      <PatientNextActionPanel
                        status={status}
                        caseId={c.id}
                        pdfPath={pdfPath}
                        reportId={reportId}
                        variant="dashboard"
                      />
                    </div>
                  </div>

                  {canDeleteDraft && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                      <DeleteDraftCaseButton caseId={c.id} caseTitle={c.title} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
