"use client";

import { useState, useEffect, useCallback } from "react";

const ACTION_LABELS: Record<string, string> = {
  regenerate_ai_audit: "Regenerate AI Audit",
  regenerate_scoring: "Rerun Scoring",
  regenerate_graft_integrity: "Regenerate Graft Integrity",
  regenerate_evidence_analysis: "Rerun Evidence Analysis",
  rebuild_pdf: "Rebuild PDF",
  regenerate_report_generation: "Regenerate Report",
  full_reaudit: "Run Full Re-audit",
  full_reaudit_latest_submission: "Full Re-audit (Latest Submission)",
  full_reaudit_with_followup_linkage: "Full Re-audit (Original + Follow-up Linkage)",
};

const REASON_LABELS: Record<string, string> = {
  new_uploads: "New uploads added",
  new_doctor_data: "New doctor data provided",
  failed_previous_run: "Previous run failed",
  updated_model_or_prompt: "Updated model or prompt",
  auditor_review_request: "Auditor review request",
  data_inconsistency: "Data inconsistency found",
  corrected_patient_photos: "Corrected patient photos (categories / exclusions)",
};

const REASONS = Object.keys(REASON_LABELS) as string[];

type RerunItem = {
  id: string;
  case_id: string;
  action_type: string;
  triggered_by: string;
  triggered_role: string;
  reason: string;
  notes: string | null;
  source_report_version: number | null;
  target_report_version: number | null;
  status: string;
  error: string | null;
  created_at: string;
};

type RerunTracking = {
  rerun_count?: number | null;
  last_rerun_at?: string | null;
  last_rerun_by?: string | null;
  processing_log?: unknown[] | null;
};

export default function AuditorRerunPanel({ caseId, latestReportVersion }: { caseId: string; latestReportVersion?: number }) {
  const [items, setItems] = useState<RerunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [tracking, setTracking] = useState<RerunTracking | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/auditor/rerun?caseId=${encodeURIComponent(caseId)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to load");
      setItems(json.items ?? []);
      setTracking((json.tracking ?? null) as RerunTracking | null);
    } catch (e: unknown) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Failed to load rerun history");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchHistory();
    const id = setInterval(fetchHistory, 8000);
    return () => clearInterval(id);
  }, [fetchHistory]);

  const handleSubmit = async () => {
    if (!action || !reason) {
      setError("Select action and reason");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auditor/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, action, reason, notes: notes.trim() || null }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Rerun failed");
      setAction("");
      setReason("");
      setNotes("");
      setShowForm(false);
      fetchHistory();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Rerun failed");
    } finally {
      setSubmitting(false);
    }
  };

  const processing = items.some((i) => i.status === "pending" || i.status === "processing");

  return (
    <div className="rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold text-white">Auditor Rerun</h2>
          {latestReportVersion != null && (
            <p className="text-xs text-slate-400 mt-0.5">Latest report: v{latestReportVersion}</p>
          )}
          {tracking && (
            <p className="text-xs text-slate-400 mt-0.5">
              rerun_count: {Number(tracking.rerun_count ?? 0)} · last_rerun_at: {tracking.last_rerun_at ? new Date(tracking.last_rerun_at).toLocaleString() : "—"}
            </p>
          )}
        </div>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={processing}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Trigger rerun
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 border border-white/15 hover:bg-white/5"
          >
            Cancel
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900/50 text-white px-3 py-2 text-sm"
            >
              <option value="">Select action</option>
              {Object.entries(ACTION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Reason (required)</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900/50 text-white px-3 py-2 text-sm"
            >
              <option value="">Select reason</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>{REASON_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context for this rerun"
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-slate-900/50 text-white px-3 py-2 text-sm placeholder-slate-500"
            />
          </div>
          {error && <p className="text-rose-300 text-sm">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !action || !reason}
            className="rounded-xl px-5 py-2 text-sm font-semibold text-slate-950 bg-emerald-300 hover:bg-emerald-200 disabled:opacity-50"
          >
            {submitting ? "Starting…" : "Start rerun"}
          </button>
        </div>
      )}

      {processing && (
        <p className="mt-3 text-amber-300 text-sm">⏳ Rerun is processing. This page will refresh automatically.</p>
      )}

      <div className="mt-4">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Rerun history</h3>
        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-slate-400 text-sm">No reruns yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-white">{ACTION_LABELS[i.action_type] ?? i.action_type}</span>
                <span className="text-slate-400">({REASON_LABELS[i.reason] ?? i.reason})</span>
                <span className={`rounded px-2 py-0.5 text-xs ${
                  i.status === "complete" ? "bg-emerald-300/20 text-emerald-200" :
                  i.status === "failed" ? "bg-rose-300/20 text-rose-200" :
                  "bg-amber-300/20 text-amber-200"
                }`}>
                  {i.status}
                </span>
                {i.source_report_version != null && (
                  <span className="text-slate-500">v{i.source_report_version}→{i.target_report_version ?? "…"}</span>
                )}
                <span className="text-slate-500">{new Date(i.created_at).toLocaleString()}</span>
                {i.error && <span className="text-rose-300 text-xs">{i.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
