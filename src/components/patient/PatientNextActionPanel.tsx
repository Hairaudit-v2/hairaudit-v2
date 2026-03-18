"use client";

import Link from "next/link";
import DownloadReport from "@/app/cases/[caseId]/download-report";
import { CONTACT_EMAIL } from "@/lib/constants";

export type PatientNextActionVariant = "dashboard" | "case";

export type PatientNextActionPanelProps = {
  /** Case status from DB: draft, submitted, processing, complete, audit_failed */
  status: string;
  caseId: string;
  /** PDF path when status is complete and report has a PDF (optional) */
  pdfPath?: string | null;
  variant?: PatientNextActionVariant;
};

function normalizeStatus(status: string): "draft" | "processing" | "complete" | "audit_failed" {
  const s = String(status ?? "draft").toLowerCase();
  if (s === "submitted" || s === "processing") return "processing";
  if (s === "complete") return "complete";
  if (s === "audit_failed") return "audit_failed";
  return "draft";
}

export default function PatientNextActionPanel({
  status,
  caseId,
  pdfPath,
  variant = "case",
}: PatientNextActionPanelProps) {
  const state = normalizeStatus(status);
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
          Next action
        </p>
        <p className={compact ? "mt-1 text-sm font-semibold text-white" : "mt-2 text-base font-semibold text-white"}>
          Complete your audit
        </p>
        <p className={compact ? "mt-0.5 text-xs text-slate-200/80" : "mt-1 text-sm text-slate-200/80"}>
          Upload photos · Complete questions
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
            Upload photos
          </Link>
          <Link
            href={`${caseHref}/patient/questions`}
            className={
              compact
                ? "inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/15"
                : "inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/15"
            }
          >
            Complete Intake Questions
          </Link>
        </div>
      </div>
    );
  }

  // Submitted or processing: Your report is being prepared
  if (state === "processing") {
    return (
      <div
        className={
          compact
            ? "rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3"
            : "rounded-2xl border border-cyan-300/25 bg-cyan-300/5 p-4 sm:p-5"
        }
      >
        <p className={compact ? "text-xs font-semibold uppercase tracking-wide text-cyan-200/90" : "text-xs font-semibold uppercase tracking-wide text-cyan-200/90"}>
          Next action
        </p>
        <p className={compact ? "mt-1 text-sm font-semibold text-white" : "mt-2 text-base font-semibold text-white"}>
          Your report is being prepared
        </p>
        <p className={compact ? "mt-0.5 text-xs text-slate-200/80" : "mt-1 text-sm text-slate-200/80"}>
          We are processing your audit. You will be notified when your report is ready.
        </p>
        <div className={compact ? "mt-2" : "mt-4"}>
          <Link
            href="/dashboard/patient"
            className={
              compact
                ? "text-xs font-medium text-cyan-200 hover:text-cyan-100"
                : "text-sm font-medium text-cyan-200 hover:text-cyan-100"
            }
          >
            Return to dashboard
          </Link>
        </div>
      </div>
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
          Next action
        </p>
        <p className={compact ? "mt-1 text-sm font-semibold text-white" : "mt-2 text-base font-semibold text-white"}>
          Your report is ready
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
            View Report
          </Link>
          <DownloadReport pdfPath={pdfPath} label="Download PDF" />
        </div>
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
          Next action
        </p>
        <p className={compact ? "mt-1 text-sm font-semibold text-white" : "mt-2 text-base font-semibold text-white"}>
          Your audit is complete
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
            View Report
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
          Next action
        </p>
        <p className={compact ? "mt-1 text-sm font-semibold text-white" : "mt-2 text-base font-semibold text-white"}>
          We were unable to complete this audit
        </p>
        <p className={compact ? "mt-0.5 text-xs text-slate-200/80" : "mt-1 text-sm text-slate-200/80"}>
          Please contact support or try resubmitting your case materials.
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
            Return to dashboard
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className={
              compact
                ? "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-300 to-cyan-300 hover:from-amber-200 hover:to-cyan-200"
                : "inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-r from-amber-300 to-cyan-300 hover:from-amber-200 hover:to-cyan-200"
            }
          >
            Contact support
          </a>
        </div>
      </div>
    );
  }

  return null;
}
