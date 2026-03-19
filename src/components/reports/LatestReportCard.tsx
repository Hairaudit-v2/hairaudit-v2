"use client";

import { useState } from "react";
import ReportShareButton from "./ReportShareButton";
import { REPORT_USE_HINT_CONTEXT } from "@/lib/reportSharingCopy";

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
  const [busy, setBusy] = useState(false);

  async function openPdf() {
    if (!report?.pdf_path) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/signed-url?path=${encodeURIComponent(report.pdf_path)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) throw new Error(json?.error ?? "Could not open report");
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert((error as Error)?.message ?? "Could not open report");
    } finally {
      setBusy(false);
    }
  }

  if (!report) {
    return <p className="text-sm text-slate-300/80">No report yet. Run audit to generate one.</p>;
  }

  const summary = (report.summary ?? {}) as { score?: number };
  const rawScore = typeof summary.score === "number" ? summary.score : undefined;
  const score = typeof displayScore === "number" ? displayScore : rawScore;
  const processing = !report.pdf_path && report.status !== "failed";

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium text-white">Latest Report v{report.version}</p>
        <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${scoreChip(score)}`}>
          {typeof score === "number" ? `Score ${score}` : processing ? "Processing" : "Pending"}
        </span>
      </div>
      <p className="text-xs text-slate-400">{new Date(report.created_at).toLocaleString()}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={openPdf}
          disabled={!report.pdf_path || busy}
          className="rounded-md border border-cyan-300/30 bg-cyan-300/15 px-3 py-1.5 text-xs font-medium text-cyan-100 disabled:opacity-50"
        >
          {busy ? "Opening..." : "Download PDF"}
        </button>
        <button
          onClick={openPdf}
          disabled={!report.pdf_path || busy}
          className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 disabled:opacity-50"
        >
          View Report
        </button>
        <ReportShareButton caseId={caseId} variant="compact" />
      </div>
      <p className="mt-2 text-xs text-slate-400/80">{REPORT_USE_HINT_CONTEXT}</p>
    </div>
  );
}
