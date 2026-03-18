"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubmitButton({
  caseId,
  caseStatus,
  submittedAt,
  compact = false,
}: {
  caseId: string;
  caseStatus: string;
  submittedAt?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const locked = caseStatus === "submitted" || (!!submittedAt && caseStatus !== "audit_failed");
  const isResubmit = caseStatus === "audit_failed";

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error ?? `Submit failed (${res.status})`);

      router.refresh(); // pulls new case status + reports
    } catch (e: any) {
      setErr(e?.message ?? "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const whatHappensNext = (
    <div
      className={
        compact
          ? "mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
          : "mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
      }
    >
      <p className={`font-medium ${compact ? "text-xs text-slate-300/90" : "text-sm text-slate-700"}`}>
        What happens next
      </p>
      <p className={`mt-1 ${compact ? "text-xs text-slate-200/80 leading-relaxed" : "text-sm text-slate-600 leading-relaxed"}`}>
        Once you submit your case, our system will process your audit. When your report is ready, we&apos;ll notify you by email and make it available in your dashboard.
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-sm text-gray-600">
          Submit this case to trigger the audit. A report will be generated asynchronously.
        </p>
      )}
      <button
        onClick={submit}
        disabled={busy || locked}
        className="rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-60 bg-amber-500 text-slate-900 hover:bg-amber-400"
      >
        {locked ? "Already submitted" : busy ? "Submitting…" : isResubmit ? "Resubmit for audit" : "Submit for audit"}
      </button>

      {!compact && submittedAt && (
        <div className="text-sm text-gray-600">
          Submitted {new Date(submittedAt).toLocaleString()}
        </div>
      )}

      {!locked && whatHappensNext}

      {err && <p className="text-sm text-red-600">❌ {err}</p>}
    </div>
  );
}
