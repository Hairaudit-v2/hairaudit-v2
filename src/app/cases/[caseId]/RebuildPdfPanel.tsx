"use client";

import { useState } from "react";

export default function RebuildPdfPanel({
  caseId,
  reportId,
  latestReportVersion,
  hasPdfPath,
}: {
  caseId: string;
  reportId?: string;
  latestReportVersion?: number;
  hasPdfPath?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRebuild = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auditor/rebuild-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, reportId: reportId ?? undefined }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Rebuild failed");
      setSuccess(
        `PDF rebuilt and saved${latestReportVersion != null ? ` (v${latestReportVersion})` : ""}. Download should work now.`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Rebuild failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Report PDF</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {hasPdfPath
              ? "Regenerate the PDF from existing report data if download fails or the stored file is missing."
              : "No PDF path on record — rebuild from existing report data."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRebuild}
          disabled={submitting}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-950 bg-sky-300 hover:bg-sky-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Rebuilding…" : "Rebuild PDF"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="mt-2 text-sm text-emerald-300">{success}</p> : null}
    </div>
  );
}
