"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { ExtremeScoreQueueData, HighScoreQueueItem, LowScoreQueueItem, ReportSummaryParsed } from "@/lib/admin/extremeScoreQueue";

async function reportStatusAction(reportId: string, action: string, body?: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/auditor/report-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportId, action, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: Boolean(json.ok), error: json.error };
}

function DetailPanel({
  kind,
  item,
  onClose,
  onActionDone,
}: {
  kind: "high" | "low";
  item: HighScoreQueueItem | LowScoreQueueItem;
  onClose: () => void;
  onActionDone: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const p = item.parsed as ReportSummaryParsed;

  const handleValidate = useCallback(async () => {
    setBusy(true);
    const { ok, error } = await reportStatusAction(item.reportId, "approve_final_report");
    setBusy(false);
    if (error) alert(error);
    else {
      onActionDone();
      router.refresh();
      onClose();
    }
  }, [item.reportId, onActionDone, onClose, router]);

  const handleReject = useCallback(async () => {
    if (!confirm("Reject award contribution for this report?")) return;
    setBusy(true);
    const { ok, error } = await reportStatusAction(item.reportId, "reject_provisional");
    setBusy(false);
    if (error) alert(error);
    else {
      onActionDone();
      router.refresh();
      onClose();
    }
  }, [item.reportId, onActionDone, onClose, router]);

  const handleSetReviewStatus = useCallback(async (reviewStatus: "in_review" | "skipped") => {
    setBusy(true);
    const { ok, error } = await reportStatusAction(item.reportId, "set_review_status", { reviewStatus });
    setBusy(false);
    if (error) alert(error);
    else {
      onActionDone();
      router.refresh();
      onClose();
    }
  }, [item.reportId, onActionDone, onClose, router]);

  const high = kind === "high" ? (item as HighScoreQueueItem) : null;
  const low = kind === "low" ? (item as LowScoreQueueItem) : null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-slate-700 bg-slate-900 shadow-xl overflow-y-auto">
      <div className="sticky top-0 flex items-center justify-between border-b border-slate-700 bg-slate-900/95 px-4 py-3">
        <h3 className="font-semibold text-white">Queue item</h3>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white">
          ✕
        </button>
      </div>
      <div className="p-4 space-y-4 text-sm">
        <div>
          <p className="text-slate-500">Case</p>
          <p className="text-white font-mono">{item.caseId.slice(0, 8)}…</p>
        </div>
        <div>
          <p className="text-slate-500">Report score</p>
          <p className="text-white">{p.score.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-slate-500">Confidence</p>
          <p className="text-white">{(p.confidence * 100).toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-slate-500">Benchmark eligible</p>
          <p className="text-white">{p.benchmarkEligible ? "Yes" : "No"}</p>
        </div>
        <div>
          <p className="text-slate-500">Doctor contribution</p>
          <p className="text-white">{high ? (high.doctorContributionReceived ? "Received" : "No") : low ? (low.doctorContributionReceived ? "Received" : "No") : "—"}</p>
        </div>
        <div>
          <p className="text-slate-500">Documentation / completeness</p>
          <p className="text-white">DI: {p.documentationScore.toFixed(1)} · Completeness: {p.completenessScore.toFixed(0)}</p>
        </div>
        {high && (
          <>
            <div>
              <p className="text-slate-500">Provisional status</p>
              <p className="text-white">{high.provisionalStatus}</p>
            </div>
            <div>
              <p className="text-slate-500">Contribution payload</p>
              <p className="text-white">{high.contributionPayloadSummary ?? "—"}</p>
            </div>
          </>
        )}
        <div>
          <p className="text-slate-500">Overrides / comments</p>
          <p className="text-white">{item.overrideCount} override(s), {item.feedbackCount} feedback</p>
        </div>

        <div className="pt-4 border-t border-slate-700 space-y-2">
          <Link
            href={`/cases/${item.caseId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-lg bg-slate-700 px-3 py-2 text-center text-white hover:bg-slate-600"
          >
            Open full case
          </Link>
          {kind === "high" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleValidate}
                className="block w-full rounded-lg bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? "…" : "Validate by auditor"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleReject}
                className="block w-full rounded-lg bg-amber-600 px-3 py-2 text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {busy ? "…" : "Reject award contribution"}
              </button>
            </>
          )}
          {kind === "low" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSetReviewStatus("in_review")}
                className="block w-full rounded-lg bg-cyan-600 px-3 py-2 text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {busy ? "…" : "Start auditor review"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSetReviewStatus("skipped")}
                className="block w-full rounded-lg bg-slate-600 px-3 py-2 text-white hover:bg-slate-500 disabled:opacity-50"
              >
                {busy ? "…" : "Mark skipped"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExtremeScoreReviewClient({ data }: { data: ExtremeScoreQueueData }) {
  const [detail, setDetail] = useState<{ kind: "high" | "low"; item: HighScoreQueueItem | LowScoreQueueItem } | null>(null);
  const router = useRouter();

  const triggerRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-4">
          <p className="text-xs text-slate-400">Provisional high scores awaiting validation</p>
          <p className="text-2xl font-semibold text-white">{data.summary.provisionalHighAwaiting}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-4">
          <p className="text-xs text-slate-400">Low-score cases awaiting optional review</p>
          <p className="text-2xl font-semibold text-white">{data.summary.lowScoreAwaiting}</p>
        </div>
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-4">
          <p className="text-xs text-emerald-300/80">Validated this week</p>
          <p className="text-2xl font-semibold text-emerald-200">{data.summary.validatedThisWeek}</p>
        </div>
        <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
          <p className="text-xs text-amber-300/80">Rejected this week</p>
          <p className="text-2xl font-semibold text-amber-200">{data.summary.rejectedThisWeek}</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
        <h2 className="border-b border-slate-700 bg-slate-800/80 px-4 py-3 text-lg font-semibold text-white">
          High Score Validation Queue
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="px-4 py-2">Case ID</th>
                <th className="px-4 py-2">Clinic</th>
                <th className="px-4 py-2">Doctor</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Benchmark</th>
                <th className="px-4 py-2">Doc score</th>
                <th className="px-4 py-2">Contribution</th>
                <th className="px-4 py-2">Provisional</th>
                <th className="px-4 py-2">Pathway</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.highScoreQueue.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                    No provisional high-score cases awaiting validation.
                  </td>
                </tr>
              ) : (
                data.highScoreQueue.map((row) => (
                  <tr key={row.reportId} className="border-b border-slate-700/80 hover:bg-slate-800/50">
                    <td className="px-4 py-2 font-mono text-slate-300">{row.caseId.slice(0, 8)}…</td>
                    <td className="px-4 py-2 text-slate-200">{row.clinicName}</td>
                    <td className="px-4 py-2 text-slate-200">{row.doctorName}</td>
                    <td className="px-4 py-2 font-medium text-white">{row.score.toFixed(1)}</td>
                    <td className="px-4 py-2">{row.benchmarkEligible ? "Yes" : "No"}</td>
                    <td className="px-4 py-2">{row.documentationScore.toFixed(1)}</td>
                    <td className="px-4 py-2">{row.doctorContributionReceived ? "Yes" : "No"}</td>
                    <td className="px-4 py-2 text-slate-300">{row.provisionalStatus}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs max-w-[120px] truncate">{row.validationPathwayAvailable}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setDetail({ kind: "high", item: row })}
                          className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500"
                        >
                          Open review
                        </button>
                        <Link
                          href={`/cases/${row.caseId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500"
                        >
                          Full case
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
        <h2 className="border-b border-slate-700 bg-slate-800/80 px-4 py-3 text-lg font-semibold text-white">
          Low Score Review Queue
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="px-4 py-2">Case ID</th>
                <th className="px-4 py-2">Clinic</th>
                <th className="px-4 py-2">Doctor</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Confidence</th>
                <th className="px-4 py-2">Contribution</th>
                <th className="px-4 py-2">Benchmark</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.lowScoreQueue.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No low-score cases in the optional review queue.
                  </td>
                </tr>
              ) : (
                data.lowScoreQueue.map((row) => (
                  <tr key={row.reportId} className="border-b border-slate-700/80 hover:bg-slate-800/50">
                    <td className="px-4 py-2 font-mono text-slate-300">{row.caseId.slice(0, 8)}…</td>
                    <td className="px-4 py-2 text-slate-200">{row.clinicName}</td>
                    <td className="px-4 py-2 text-slate-200">{row.doctorName}</td>
                    <td className="px-4 py-2 font-medium text-white">{row.score.toFixed(1)}</td>
                    <td className="px-4 py-2">{(row.confidence * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2">{row.doctorContributionReceived ? "Yes" : "No"}</td>
                    <td className="px-4 py-2">{row.benchmarkEligible ? "Yes" : "No"}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setDetail({ kind: "low", item: row })}
                          className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500"
                        >
                          Open review
                        </button>
                        <Link
                          href={`/cases/${row.caseId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500"
                        >
                          Full case
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <DetailPanel
          kind={detail.kind}
          item={detail.item}
          onClose={() => setDetail(null)}
          onActionDone={triggerRefresh}
        />
      )}
    </div>
  );
}
