"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { caseSubmitSurfaceOpen } from "@/lib/patient/caseSubmitStatus";

type Props = {
  caseId: string;
  caseStatus: string;
  submittedAt: string | null;
  statusLabel: string;
  clinicalDataPresent: boolean;
  imagesSortedLabel: string;
  pdfUploaded: boolean;
  readyToRun: boolean;
};

export default function AuditorStickyActionBar({
  caseId,
  caseStatus,
  submittedAt,
  statusLabel,
  clinicalDataPresent,
  imagesSortedLabel,
  pdfUploaded,
  readyToRun,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitOpen = caseSubmitSurfaceOpen({ status: caseStatus, submitted_at: submittedAt });
  const isAuditFailed = caseStatus === "audit_failed";

  async function runAudit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Submit failed");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auditor/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          action: "regenerate_ai_audit",
          reason: isAuditFailed ? "failed_previous_run" : "auditor_review_request",
          notes: null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.ok) throw new Error(json.error ?? "Rerun failed");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed bottom-0 right-0 z-40 hidden lg:block lg:left-[max(0px,calc((100vw-1200px)/2))] lg:max-w-[1200px]"
      aria-label="Case action bar"
    >
      <div className="border-t border-white/10 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur-md sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Case status</p>
            <p className="text-sm font-semibold text-white">{statusLabel}</p>
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
              <div>
                <span className="text-slate-500">Clinical data: </span>
                <span className={clinicalDataPresent ? "text-emerald-300" : "text-amber-300"}>
                  {clinicalDataPresent ? "Present ✓" : "Missing"}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Images sorted: </span>
                <span>{imagesSortedLabel}</span>
              </div>
              <div>
                <span className="text-slate-500">PDF: </span>
                <span className={pdfUploaded ? "text-emerald-300" : "text-slate-400"}>
                  {pdfUploaded ? "Uploaded ✓" : "None"}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Ready to run: </span>
                <span className={readyToRun ? "text-emerald-300 font-semibold" : "text-amber-300"}>
                  {readyToRun ? "YES" : "NO"}
                </span>
              </div>
            </dl>
            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          </div>
          <button
            type="button"
            disabled={busy || (!submitOpen && !readyToRun)}
            onClick={() => void (submitOpen ? runAudit() : regenerate())}
            className="shrink-0 rounded-xl px-6 py-3 text-sm font-bold text-slate-950 bg-emerald-300 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Starting…" : submitOpen ? "RUN AUDIT" : "REGENERATE AUDIT"}
          </button>
        </div>
      </div>
    </div>
  );
}
