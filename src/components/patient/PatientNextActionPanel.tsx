"use client";

import Link from "next/link";
import DownloadReport from "@/app/cases/[caseId]/download-report";
import ReportShareButton from "@/components/reports/ReportShareButton";
import PatientProcessingWaitingExperience from "@/components/patient/PatientProcessingWaitingExperience";
import { CONTACT_EMAIL } from "@/lib/constants";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolvePatientReportDeliveryPhase } from "@/lib/patient/patientProcessingView";

export type PatientNextActionVariant = "dashboard" | "case";

export type PatientNextActionPanelProps = {
  /** Case status from DB: draft, submitted, processing, complete, audit_failed */
  status: string;
  caseId: string;
  /** PDF path when status is complete and report has a PDF (optional) */
  pdfPath?: string | null;
  /** Latest completed report row id for server-side PDF download */
  reportId?: string;
  variant?: PatientNextActionVariant;
  /** Masked in UI; used to confirm report-ready email destination during processing */
  notificationEmail?: string | null;
  submittedAt?: string | null;
};

export default function PatientNextActionPanel({
  status,
  caseId,
  pdfPath,
  reportId,
  variant = "case",
  notificationEmail,
  submittedAt,
}: PatientNextActionPanelProps) {
  const { t } = useI18n();
  const deliveryPhase = resolvePatientReportDeliveryPhase({
    caseStatus: status,
    hasReportPdf: Boolean(pdfPath),
  });
  const state =
    deliveryPhase === "audit_failed"
      ? "audit_failed"
      : deliveryPhase === "delivered"
        ? "complete"
        : deliveryPhase === "processing"
          ? "processing"
          : "draft";
  const caseHref = `/cases/${caseId}`;
  const compact = variant === "dashboard";

  // Draft: Complete your audit (Upload photos / Complete questions)
  if (state === "draft") {
    return (
      <div
        className={
          compact
            ? "rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3"
            : "rounded-2xl border border-cyan-300/25 bg-cyan-300/5 p-4 sm:p-5"
        }
      >
        <p className={compact ? "text-xs font-semibold uppercase tracking-wide text-cyan-200/90" : "text-xs font-semibold uppercase tracking-wide text-cyan-200/90"}>
          {t("dashboard.patient.nextAction.eyebrow")}
        </p>
        <p className={compact ? "mt-1 text-sm font-semibold text-white" : "mt-2 text-base font-semibold text-white"}>
          {t("dashboard.patient.nextAction.draftTitle")}
        </p>
        <p className={compact ? "mt-0.5 text-xs text-slate-200/80" : "mt-1 text-sm text-slate-200/80"}>
          {t("dashboard.patient.nextAction.draftSubtitle")}
        </p>
        <div className={compact ? "mt-2 flex flex-wrap gap-2" : "mt-4 flex flex-wrap gap-3"}>
          <Link
            href={`${caseHref}/patient/photos`}
            className={
              compact
                ? "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200"
                : "inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200"
            }
          >
            {t("dashboard.patient.uploadPhotos")}
          </Link>
          <Link
            href={`${caseHref}/patient/questions`}
            className={
              compact
                ? "inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/15"
                : "inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/15"
            }
          >
            {t("dashboard.patient.completeIntake")}
          </Link>
        </div>
      </div>
    );
  }

  // Submitted or processing: premium waiting experience (no partial report surfacing)
  if (state === "processing") {
    return (
      <PatientProcessingWaitingExperience
        caseId={caseId}
        caseStatus={status}
        hasReportPdf={Boolean(pdfPath)}
        notificationEmail={notificationEmail}
        submittedAt={submittedAt}
        variant={variant}
        showReturnLink
      />
    );
  }

  // Complete with PDF: Your report is ready — View Report, Download PDF
  if (state === "complete" && pdfPath) {
    return (
      <div
        className={
          compact
            ? "rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3"
            : "rounded-2xl border border-emerald-300/25 bg-emerald-300/5 p-4 sm:p-5"
        }
      >
        <p className={compact ? "text-xs font-semibold uppercase tracking-wide text-emerald-200/90" : "text-xs font-semibold uppercase tracking-wide text-emerald-200/90"}>
          {t("dashboard.patient.nextAction.eyebrow")}
        </p>
        <p className={compact ? "mt-1 text-sm font-semibold text-white" : "mt-2 text-base font-semibold text-white"}>
          {t("dashboard.patient.nextAction.readyTitle")}
        </p>
        <div className={compact ? "mt-2 flex flex-wrap items-center gap-2" : "mt-4 flex flex-wrap items-center gap-3"}>
          <Link
            href={caseHref}
            className={
              compact
                ? "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200"
                : "inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200"
            }
          >
            {t("dashboard.reports.viewReport")}
          </Link>
          {reportId ? <DownloadReport reportId={reportId} label={t("dashboard.reports.downloadPdf")} /> : null}
          <ReportShareButton caseId={caseId} variant={compact ? "compact" : "default"} />
        </div>
        <p className={compact ? "mt-2 text-xs text-slate-400/90" : "mt-3 text-xs text-slate-400/90"}>
          {t("dashboard.reports.shareHint")}
        </p>
      </div>
    );
  }

  // Complete without PDF: Your audit is complete — View Report only
  if (state === "complete") {
    return (
      <div
        className={
          compact
            ? "rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3"
            : "rounded-2xl border border-emerald-300/25 bg-emerald-300/5 p-4 sm:p-5"
        }
      >
        <p className={compact ? "text-xs font-semibold uppercase tracking-wide text-emerald-200/90" : "text-xs font-semibold uppercase tracking-wide text-emerald-200/90"}>
          {t("dashboard.patient.nextAction.eyebrow")}
        </p>
        <p className={compact ? "mt-1 text-sm font-semibold text-white" : "mt-2 text-base font-semibold text-white"}>
          {t("dashboard.patient.nextAction.completeNoPdfTitle")}
        </p>
        <p className={compact ? "mt-1.5 text-xs text-slate-400/90" : "mt-2 text-xs text-slate-400/90"}>
          {t("dashboard.reports.shareHint")}
        </p>
        <div className={compact ? "mt-2" : "mt-4"}>
          <Link
            href={caseHref}
            className={
              compact
                ? "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200"
                : "inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200"
            }
          >
            {t("dashboard.reports.viewReport")}
          </Link>
        </div>
      </div>
    );
  }

  // Audit failed: We were unable to complete this audit
  if (state === "audit_failed") {
    return (
      <div
        className={
          compact
            ? "rounded-xl border border-amber-300/20 bg-amber-300/5 p-3"
            : "rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4 sm:p-5"
        }
      >
        <p className={compact ? "text-xs font-semibold uppercase tracking-wide text-amber-200/90" : "text-xs font-semibold uppercase tracking-wide text-amber-200/90"}>
          {t("dashboard.patient.nextAction.eyebrow")}
        </p>
        <p className={compact ? "mt-1 text-sm font-semibold text-white" : "mt-2 text-base font-semibold text-white"}>
          {t("dashboard.patient.nextAction.failedTitle")}
        </p>
        <p className={compact ? "mt-0.5 text-xs text-slate-200/80" : "mt-1 text-sm text-slate-200/80"}>
          {t("dashboard.patient.nextAction.failedBody")}
        </p>
        <div className={compact ? "mt-2 flex flex-wrap gap-2" : "mt-4 flex flex-wrap gap-3"}>
          <Link
            href="/dashboard/patient"
            className={
              compact
                ? "inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/15"
                : "inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/15"
            }
          >
            {t("dashboard.patient.nextAction.returnToDashboard")}
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className={
              compact
                ? "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-300 to-cyan-300 hover:from-amber-200 hover:to-cyan-200"
                : "inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-r from-amber-300 to-cyan-300 hover:from-amber-200 hover:to-cyan-200"
            }
          >
            {t("dashboard.patient.nextAction.contactSupport")}
          </a>
        </div>
      </div>
    );
  }

  return null;
}
