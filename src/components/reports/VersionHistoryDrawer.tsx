"use client";

import { useMemo, useState } from "react";

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
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const history = useMemo(() => (Array.isArray(reports) ? reports : []), [reports]);

  async function openPdf(path: string, reportId: string) {
    setBusyId(reportId);
    try {
      const res = await fetch(`/api/reports/signed-url?path=${encodeURIComponent(path)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) throw new Error(json?.error ?? "Could not open report");
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert((error as Error)?.message ?? "Could not open report");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
      >
        Open Version History
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="Close drawer backdrop"
            className="absolute inset-0 bg-slate-950/70"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-white/10 bg-slate-950/95 p-6 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Version History</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {history.length === 0 ? (
              <p className="text-sm text-slate-300/80">No report versions yet.</p>
            ) : (
              <div className="space-y-3 overflow-y-auto pb-6">
                {history.map((report, idx) => {
                  const summary = (report.summary ?? {}) as { score?: number };
                  const score = typeof summary.score === "number" ? summary.score : undefined;
                  const isLatest = idx === 0;
                  const processing = !report.pdf_path && report.status !== "failed";

                  return (
                    <div key={report.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-medium text-white">
                          {isLatest ? "Latest Report" : `Report v${report.version}`}
                        </p>
                        <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${scoreClass(score)}`}>
                          {typeof score === "number" ? `Score ${score}` : processing ? "Processing" : "Pending"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{new Date(report.created_at).toLocaleString()}</p>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => report.pdf_path && openPdf(report.pdf_path, report.id)}
                          disabled={!report.pdf_path || busyId === report.id}
                          className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100 disabled:opacity-50"
                        >
                          {busyId === report.id ? "Opening..." : "Download"}
                        </button>
                        <button
                          onClick={() => report.pdf_path && openPdf(report.pdf_path, report.id)}
                          disabled={!report.pdf_path || busyId === report.id}
                          className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 disabled:opacity-50"
                        >
                          View
                        </button>
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
