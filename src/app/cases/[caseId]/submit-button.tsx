"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubmitButton({
  caseId,
  caseStatus,
  submittedAt,
}: {
  caseId: string;
  caseStatus: string;
  submittedAt?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const locked = caseStatus === "submitted" || !!submittedAt;

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

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Submit this case to trigger the audit. A report will be generated asynchronously.
      </p>
      <button
        onClick={submit}
        disabled={busy || locked}
        className="rounded-lg px-4 py-2.5 font-medium transition-opacity disabled:opacity-60 disabled:cursor-not-allowed bg-amber-500 text-slate-900 hover:bg-amber-400"
      >
        {locked ? "Already submitted" : busy ? "Submitting…" : "Submit for audit"}
      </button>

      {submittedAt && (
        <div className="text-sm text-gray-600">
          Submitted {new Date(submittedAt).toLocaleString()}
        </div>
      )}

      {err && <p className="text-sm text-red-600">❌ {err}</p>}
    </div>
  );
}
