"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED } from "@/lib/patient/patientPhotoImageLimitedOverride";
import { caseSubmitSurfaceOpen } from "@/lib/patient/caseSubmitStatus";

type Props = {
  caseId: string;
  caseStatus: string;
  submittedAt: string | null;
  reportId?: string;
  latestReportVersion?: number;
  hasPdfPath?: boolean;
  isAuditFailed: boolean;
  canImageLimitedRegenerate: boolean;
  photosMissing: boolean;
  missingPhotoLabels: string[];
};

export default function AuditorAuditExecutionCenter({
  caseId,
  caseStatus,
  submittedAt,
  reportId,
  latestReportVersion,
  hasPdfPath,
  isAuditFailed,
  canImageLimitedRegenerate,
  photosMissing,
  missingPhotoLabels,
}: Props) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImageLimitedConfirm, setShowImageLimitedConfirm] = useState(false);

  const submitOpen = caseSubmitSurfaceOpen({ status: caseStatus, submitted_at: submittedAt });

  async function queueRerun(
    action: string,
    reason: string,
    label: string,
    notes?: string | null
  ) {
    setBusyAction(label);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auditor/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, action, reason, notes: notes ?? null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.ok) throw new Error(json.error ?? "Action failed");
      setSuccess(`${label} queued.`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyAction(null);
      setShowImageLimitedConfirm(false);
    }
  }

  async function rebuildPdf() {
    setBusyAction("rebuild_pdf");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auditor/rebuild-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, reportId: reportId ?? undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.ok) throw new Error(json.error ?? "Rebuild failed");
      setSuccess(
        `PDF rebuilt${latestReportVersion != null ? ` (v${latestReportVersion})` : ""}.`
      );
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Rebuild failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function runAudit() {
    setBusyAction("run_audit");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Submit failed");
      setSuccess("Audit run queued.");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function markForReview() {
    setBusyAction("mark_review");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auditor/cases/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, action: "mark_needs_manual_review", reason: "" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.ok) throw new Error(json.error ?? "Action failed");
      setSuccess("Marked for manual review.");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  }

  const btnBase =
    "rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section className="rounded-2xl border-2 border-amber-400/25 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-lg shadow-amber-950/20">
      <header>
        <h2 className="text-lg font-semibold text-white">AUDIT EXECUTION</h2>
        <p className="mt-1 text-sm text-slate-400">
          Run, regenerate, or recover audits from one place — no hunting across the page.
        </p>
      </header>

      <div className="mt-4 flex flex-wrap gap-3">
        {submitOpen ? (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void runAudit()}
            className={`${btnBase} text-slate-950 bg-emerald-300 hover:bg-emerald-200`}
          >
            {busyAction === "run_audit" ? "Starting…" : isAuditFailed ? "Retry Failed Audit" : "Run Audit"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() =>
              void queueRerun("regenerate_ai_audit", "auditor_review_request", "Regenerate Audit", null)
            }
            className={`${btnBase} text-slate-950 bg-amber-300 hover:bg-amber-200`}
          >
            {busyAction === "Regenerate Audit" ? "Queueing…" : "Regenerate Audit"}
          </button>
        )}

        {isAuditFailed && submitOpen === false ? (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() =>
              void queueRerun("regenerate_ai_audit", "failed_previous_run", "Retry Failed Audit", null)
            }
            className={`${btnBase} text-slate-950 bg-rose-300 hover:bg-rose-200`}
          >
            {busyAction === "Retry Failed Audit" ? "Retrying…" : "Retry Failed Audit"}
          </button>
        ) : null}

        {photosMissing ? (
          !showImageLimitedConfirm ? (
            <button
              type="button"
              disabled={busyAction !== null || !canImageLimitedRegenerate}
              onClick={() => setShowImageLimitedConfirm(true)}
              className={`${btnBase} text-slate-950 bg-orange-300 hover:bg-orange-200`}
              title={
                !canImageLimitedRegenerate
                  ? "Requires patient images or clinical intelligence on file"
                  : undefined
              }
            >
              Regenerate Image Limited
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-950/30 px-3 py-2">
              <span className="text-xs text-amber-100">Confirm image-limited run?</span>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  void queueRerun(
                    "regenerate_ai_audit",
                    AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED,
                    "Regenerate Image Limited",
                    "Auditor-confirmed image-limited regeneration"
                  )
                }
                className={`${btnBase} text-slate-950 bg-orange-300 hover:bg-orange-200`}
              >
                {busyAction === "Regenerate Image Limited" ? "Queueing…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setShowImageLimitedConfirm(false)}
                className={`${btnBase} text-slate-200 border border-white/15 hover:bg-white/5`}
              >
                Cancel
              </button>
            </div>
          )
        ) : null}

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => void rebuildPdf()}
          className={`${btnBase} text-slate-950 bg-sky-300 hover:bg-sky-200`}
        >
          {busyAction === "rebuild_pdf" ? "Rebuilding…" : "Rebuild PDF"}
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => void markForReview()}
          className={`${btnBase} text-violet-100 border border-violet-400/40 bg-violet-950/40 hover:bg-violet-900/50`}
        >
          {busyAction === "mark_review" ? "Updating…" : "Mark For Review"}
        </button>
      </div>

      {photosMissing && missingPhotoLabels.length > 0 ? (
        <p className="mt-3 text-xs text-amber-200/80">
          Missing views: {missingPhotoLabels.join(", ")}
        </p>
      ) : null}

      {!hasPdfPath ? (
        <p className="mt-2 text-xs text-slate-400">No PDF on record — rebuild after audit completes.</p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-300">{success}</p> : null}
    </section>
  );
}
