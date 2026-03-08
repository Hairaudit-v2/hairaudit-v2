"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuditorStatus = "pending" | "approved" | "rejected" | "needs_more_evidence";
type ConfidenceLabel = "low" | "medium" | "high";

export type AuditorGiiRow = {
  id: string;
  case_id: string;
  claimed_grafts: number | null;
  estimated_extracted_min: number | null;
  estimated_extracted_max: number | null;
  estimated_implanted_min: number | null;
  estimated_implanted_max: number | null;
  variance_claimed_vs_implanted_min_pct: number | null;
  variance_claimed_vs_implanted_max_pct: number | null;
  variance_claimed_vs_extracted_min_pct: number | null;
  variance_claimed_vs_extracted_max_pct: number | null;
  confidence: number;
  confidence_label: ConfidenceLabel;
  evidence_sufficiency_score?: number | null;
  inputs_used: {
    donor_images?: string[];
    recipient_images?: string[];
    metadata_keys?: string[];
  } | null;
  limitations: string[];
  flags: string[];
  ai_notes: string | null;
  auditor_status: AuditorStatus;
  auditor_notes: string | null;
  auditor_adjustments: any;
  audited_by: string | null;
  audited_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AuditorCaseRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
};

function fmtInt(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function range(min: number | null, max: number | null) {
  if (min === null && max === null) return "—";
  if (min !== null && max !== null) return `${fmtInt(min)}–${fmtInt(max)}`;
  if (min !== null) return `≥ ${fmtInt(min)}`;
  return `≤ ${fmtInt(max as number)}`;
}

function pct(min: number | null, max: number | null) {
  const f = (v: number) => {
    const n = Math.round(v * 10) / 10;
    const sign = n > 0 ? "+" : "";
    return `${sign}${n}%`;
  };
  if (min === null && max === null) return "—";
  if (min !== null && max !== null) return `${f(min)} to ${f(max)}`;
  if (min !== null) return `≥ ${f(min)}`;
  return `≤ ${f(max as number)}`;
}

function abs(n: number) {
  return Math.abs(n);
}

function statusPill(s: AuditorStatus) {
  if (s === "approved") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (s === "needs_more_evidence") return "bg-amber-50 text-amber-900 border-amber-200";
  if (s === "rejected") return "bg-rose-50 text-rose-800 border-rose-200";
  return "bg-slate-50 text-slate-800 border-slate-200";
}

function confPill(s: ConfidenceLabel) {
  if (s === "high") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (s === "low") return "bg-amber-50 text-amber-900 border-amber-200";
  return "bg-cyan-50 text-cyan-900 border-cyan-200";
}

async function signThumb(path: string): Promise<string | null> {
  const res = await fetch(`/api/uploads/signed-url?path=${encodeURIComponent(path)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return json?.url ?? null;
}

function computeVariancePct(claimed: number | null, est: number | null): number | null {
  if (!claimed || claimed <= 0 || est === null) return null;
  return ((est - claimed) / claimed) * 100;
}

export default function GraftIntegrityReviewPanel(props: {
  cases: AuditorCaseRow[];
  initialEstimates: AuditorGiiRow[];
  /** Optional message when no estimates (e.g. "No Graft Integrity estimate generated yet for this case.") */
  emptyMessage?: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [estimates, setEstimates] = useState<AuditorGiiRow[]>(props.initialEstimates ?? []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [internalNotes, setInternalNotes] = useState<Record<string, string>>({});
  const [publicNotes, setPublicNotes] = useState<Record<string, string>>({});

  const [overrideExtractedMin, setOverrideExtractedMin] = useState<Record<string, string>>({});
  const [overrideExtractedMax, setOverrideExtractedMax] = useState<Record<string, string>>({});
  const [overrideImplantedMin, setOverrideImplantedMin] = useState<Record<string, string>>({});
  const [overrideImplantedMax, setOverrideImplantedMax] = useState<Record<string, string>>({});

  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const channel = supabase
      .channel("gii-auditor")
      .on("postgres_changes", { event: "*", schema: "public", table: "graft_integrity_estimates" }, async () => {
        const { data } = await supabase
          .from("graft_integrity_estimates")
          .select(
            "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, variance_claimed_vs_extracted_min_pct, variance_claimed_vs_extracted_max_pct, confidence, confidence_label, evidence_sufficiency_score, inputs_used, limitations, flags, ai_notes, auditor_status, auditor_notes, auditor_adjustments, audited_by, audited_at, created_at, updated_at"
          )
          .order("created_at", { ascending: false })
          .limit(200);
        if (!Array.isArray(data)) return;
        // Keep the latest row per case_id
        const byCase = new Map<string, AuditorGiiRow>();
        for (const r of data as any[]) {
          const cid = String(r.case_id);
          if (!byCase.has(cid)) byCase.set(cid, r as AuditorGiiRow);
        }
        setEstimates(Array.from(byCase.values()));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const caseById = useMemo(() => new Map(props.cases.map((c) => [c.id, c])), [props.cases]);

  const latestByCase = useMemo(() => {
    const m = new Map<string, AuditorGiiRow>();
    for (const e of estimates) {
      const cid = String(e.case_id);
      if (!m.has(cid)) m.set(cid, e);
    }
    return m;
  }, [estimates]);

  const rows = useMemo(() => {
    const out: Array<{ c: AuditorCaseRow; e: AuditorGiiRow }> = [];
    for (const [caseId, e] of latestByCase.entries()) {
      const c = caseById.get(caseId);
      if (c) out.push({ c, e });
    }
    out.sort((a, b) => {
      const ta = new Date(a.e.created_at ?? a.c.created_at).getTime();
      const tb = new Date(b.e.created_at ?? b.c.created_at).getTime();
      return tb - ta;
    });
    return out;
  }, [latestByCase, caseById]);

  const majorVarianceRows = useMemo(() => {
    return rows.filter(({ e }) => {
      const vmax = e.variance_claimed_vs_implanted_max_pct;
      if (typeof vmax !== "number") return false;
      return abs(vmax) > 25 && Number(e.confidence) >= 0.65;
    });
  }, [rows]);

  async function ensureThumbs(paths: string[]) {
    const missing = paths.filter((p) => !(p in thumbs));
    if (missing.length === 0) return;
    const next: Record<string, string | null> = {};
    await Promise.all(
      missing.slice(0, 16).map(async (p) => {
        const url = await signThumb(p);
        next[p] = url;
      })
    );
    setThumbs((prev) => ({ ...prev, ...next }));
  }

  async function act(e: AuditorGiiRow, action: "approve" | "needs_more_evidence" | "reject") {
    setBusyId(e.id);
    setMessage(null);
    try {
      const res = await fetch("/api/auditor/graft-integrity/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId: e.id,
          action,
          internalNotes: internalNotes[e.id] ?? "",
          publicNote: publicNotes[e.id] ?? "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Update failed");
      setMessage({ type: "success", text: `Saved: ${action.replace(/_/g, " ")}` });
      // Optimistic local patch
      setEstimates((prev) =>
        prev.map((x) =>
          x.id === e.id
            ? {
                ...x,
                auditor_status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "needs_more_evidence",
                auditor_notes: internalNotes[e.id] ?? null,
                audited_at: new Date().toISOString(),
              }
            : x
        )
      );
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Update failed" });
    } finally {
      setBusyId(null);
    }
  }

  async function approveWithOverrides(e: AuditorGiiRow) {
    setBusyId(e.id);
    setMessage(null);
    try {
      const extracted_min = overrideExtractedMin[e.id] ? Number(overrideExtractedMin[e.id]) : null;
      const extracted_max = overrideExtractedMax[e.id] ? Number(overrideExtractedMax[e.id]) : null;
      const implanted_min = overrideImplantedMin[e.id] ? Number(overrideImplantedMin[e.id]) : null;
      const implanted_max = overrideImplantedMax[e.id] ? Number(overrideImplantedMax[e.id]) : null;

      const res = await fetch("/api/auditor/graft-integrity/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId: e.id,
          action: "approve_with_overrides",
          internalNotes: internalNotes[e.id] ?? "",
          publicNote: publicNotes[e.id] ?? "",
          overrides: { extracted_min, extracted_max, implanted_min, implanted_max },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Override failed");

      setMessage({ type: "success", text: "Approved with overrides saved" });
      const claimed = e.claimed_grafts;
      setEstimates((prev) =>
        prev.map((x) =>
          x.id === e.id
            ? {
                ...x,
                auditor_status: "approved",
                estimated_extracted_min: extracted_min,
                estimated_extracted_max: extracted_max,
                estimated_implanted_min: implanted_min,
                estimated_implanted_max: implanted_max,
                variance_claimed_vs_extracted_min_pct: computeVariancePct(claimed, extracted_min),
                variance_claimed_vs_extracted_max_pct: computeVariancePct(claimed, extracted_max),
                variance_claimed_vs_implanted_min_pct: computeVariancePct(claimed, implanted_min),
                variance_claimed_vs_implanted_max_pct: computeVariancePct(claimed, implanted_max),
                audited_at: new Date().toISOString(),
              }
            : x
        )
      );
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Override failed" });
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    const msg = props.emptyMessage ?? "No estimates found yet.";
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-semibold text-slate-900">Graft Integrity Estimates</div>
        <div className="mt-1 text-sm text-slate-600">{msg}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {majorVarianceRows.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Major variance alert queue</div>
          <div className="mt-1 text-sm text-amber-900">
            {majorVarianceRows.length} case{majorVarianceRows.length === 1 ? "" : "s"} exceed ±25% variance (max) with confidence ≥ 0.65.
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Graft Integrity Estimates</div>
            <div className="mt-1 text-xs text-slate-500">
              Review AI ranges, confirm reliability, request more evidence, or override with audited ranges.
            </div>
          </div>
          <div className="text-xs text-slate-500">Live</div>
        </div>
        {message && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
              message.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {rows.map(({ c, e }) => {
        const isExpanded = Boolean(expanded[e.id]);
        const donorKeys = (e.inputs_used?.donor_images ?? []).slice(0, 8);
        const recipientKeys = (e.inputs_used?.recipient_images ?? []).slice(0, 8);
        const metaKeys = (e.inputs_used?.metadata_keys ?? []).slice(0, 8);
        const majorVariance = typeof e.variance_claimed_vs_implanted_max_pct === "number" && abs(e.variance_claimed_vs_implanted_max_pct) > 25 && Number(e.confidence) >= 0.65;
        const evidenceStrength =
          typeof (e as any).evidence_sufficiency_score === "number" && Number.isFinite((e as any).evidence_sufficiency_score)
            ? Math.max(0, Math.min(100, Math.round((e as any).evidence_sufficiency_score)))
            : null;

        return (
          <div key={e.id} className={`rounded-xl border bg-white p-4 ${majorVariance ? "border-amber-300" : "border-slate-200"}`}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/cases/${c.id}`} className="font-medium text-slate-900 hover:underline">
                    {c.title ?? "Untitled case"}
                  </Link>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPill(e.auditor_status)}`}>
                    {e.auditor_status.replaceAll("_", " ")}
                  </span>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${confPill(e.confidence_label)}`}>
                    {e.confidence_label} ({Math.round(Number(e.confidence) * 100)}%)
                  </span>
                  {majorVariance && (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      Major variance alert
                    </span>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">Claimed</div>
                    <div className="font-semibold text-slate-900 tabular-nums">{e.claimed_grafts !== null ? fmtInt(e.claimed_grafts) : "—"}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">Evidence strength</div>
                    <div className="font-semibold text-slate-900 tabular-nums">{evidenceStrength !== null ? `${evidenceStrength}/100` : "—"}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">Extracted range</div>
                    <div className="font-semibold text-slate-900 tabular-nums">{range(e.estimated_extracted_min, e.estimated_extracted_max)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">Implanted range</div>
                    <div className="font-semibold text-slate-900 tabular-nums">{range(e.estimated_implanted_min, e.estimated_implanted_max)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">Variance vs claimed</div>
                    <div className="text-sm font-semibold text-slate-900 tabular-nums">
                      Implanted: {pct(e.variance_claimed_vs_implanted_min_pct, e.variance_claimed_vs_implanted_max_pct)}
                    </div>
                    <div className="text-xs text-slate-600 tabular-nums">
                      Extracted: {pct(e.variance_claimed_vs_extracted_min_pct, e.variance_claimed_vs_extracted_max_pct)}
                    </div>
                  </div>
                </div>

                {Array.isArray(e.flags) && e.flags.length > 0 && (
                  <div className="mt-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Flags:</span> {e.flags.slice(0, 8).join(", ")}
                  </div>
                )}
              </div>

              <div className="shrink-0 flex gap-2">
                <Link
                  href={`/cases/${c.id}/audit`}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Open case audit
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setExpanded((p) => ({ ...p, [e.id]: !isExpanded }));
                    void ensureThumbs([...donorKeys, ...recipientKeys]);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {isExpanded ? "Hide review" : "Review"}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 space-y-4">
                {majorVariance && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <span className="font-semibold">Major variance alert:</span> max implanted variance exceeds ±25% with confidence ≥ 0.65.
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-semibold text-slate-700">Photos used — Donor</div>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {donorKeys.length === 0 ? (
                        <div className="col-span-4 text-xs text-slate-500">None recorded.</div>
                      ) : (
                        donorKeys.map((k) => (
                          <div key={k} className="aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                            {thumbs[k] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumbs[k] as string} alt="Donor thumbnail" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full animate-pulse bg-slate-100" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-semibold text-slate-700">Photos used — Recipient</div>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {recipientKeys.length === 0 ? (
                        <div className="col-span-4 text-xs text-slate-500">None recorded.</div>
                      ) : (
                        recipientKeys.map((k) => (
                          <div key={k} className="aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                            {thumbs[k] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumbs[k] as string} alt="Recipient thumbnail" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full animate-pulse bg-slate-100" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-semibold text-slate-700">AI Notes</div>
                    <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{e.ai_notes ?? "—"}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-semibold text-slate-700">Limitations</div>
                    {Array.isArray(e.limitations) && e.limitations.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {e.limitations.slice(0, 8).map((x, i) => (
                          <li key={`${x}-${i}`} className="flex gap-2">
                            <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
                            <span>{x}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-1 text-sm text-slate-600">—</div>
                    )}
                    {metaKeys.length > 0 && (
                      <div className="mt-3 text-xs text-slate-500">
                        <span className="font-semibold text-slate-600">Metadata keys:</span> {metaKeys.join(", ")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold text-slate-700">Decision</div>
                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Internal auditor notes (not patient-facing)</label>
                      <textarea
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        rows={3}
                        value={internalNotes[e.id] ?? ""}
                        onChange={(ev) => setInternalNotes((p) => ({ ...p, [e.id]: ev.target.value }))}
                        placeholder="Internal rationale, what you checked, reliability concerns…"
                      />
                      <label className="mt-3 block text-xs font-semibold text-slate-700">Patient-facing note (short, neutral)</label>
                      <textarea
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        rows={2}
                        value={publicNotes[e.id] ?? ""}
                        onChange={(ev) => setPublicNotes((p) => ({ ...p, [e.id]: ev.target.value }))}
                        placeholder="Optional: short neutral message visible to the patient."
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === e.id}
                          onClick={() => void act(e, "approve")}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === e.id}
                          onClick={() => void act(e, "needs_more_evidence")}
                          className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                        >
                          Needs more evidence
                        </button>
                        <button
                          type="button"
                          disabled={busyId === e.id}
                          onClick={() => void act(e, "reject")}
                          className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                        >
                          Reject (rare)
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-700">Manual override (ranges)</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">Extracted min</label>
                          <input
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            inputMode="numeric"
                            value={overrideExtractedMin[e.id] ?? ""}
                            onChange={(ev) => setOverrideExtractedMin((p) => ({ ...p, [e.id]: ev.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">Extracted max</label>
                          <input
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            inputMode="numeric"
                            value={overrideExtractedMax[e.id] ?? ""}
                            onChange={(ev) => setOverrideExtractedMax((p) => ({ ...p, [e.id]: ev.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">Implanted min</label>
                          <input
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            inputMode="numeric"
                            value={overrideImplantedMin[e.id] ?? ""}
                            onChange={(ev) => setOverrideImplantedMin((p) => ({ ...p, [e.id]: ev.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">Implanted max</label>
                          <input
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            inputMode="numeric"
                            value={overrideImplantedMax[e.id] ?? ""}
                            onChange={(ev) => setOverrideImplantedMax((p) => ({ ...p, [e.id]: ev.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-slate-700">
                        <div className="font-semibold text-slate-700">Preview variance vs claimed</div>
                        <div className="mt-1 tabular-nums">
                          Implanted (max):{" "}
                          {(() => {
                            const max = overrideImplantedMax[e.id] ? Number(overrideImplantedMax[e.id]) : null;
                            const v = computeVariancePct(e.claimed_grafts, max);
                            return v === null ? "—" : `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}%`;
                          })()}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          Overrides are stored in <code>auditor_adjustments</code> and applied to approved outputs.
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={busyId === e.id}
                        onClick={() => void approveWithOverrides(e)}
                        className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        Approve with overrides
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

