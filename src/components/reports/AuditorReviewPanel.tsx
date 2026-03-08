"use client";

import { useEffect, useState, useCallback } from "react";
import {
  resolveDomainScore,
  computeAuditorOverallScore,
  type DomainScoreOverride,
  type ResolvedDomainScore,
} from "@/lib/auditor/resolveScores";

const DOMAIN_IDS = ["SP", "DP", "GV", "IC", "DI"] as const;
const DOMAIN_TITLES: Record<string, string> = {
  SP: "Surgical Planning & Design",
  DP: "Donor Preservation & Extraction",
  GV: "Graft Handling & Viability",
  IC: "Implantation Consistency",
  DI: "Documentation Integrity",
};

const REASON_CATEGORIES: { value: string; label: string }[] = [
  { value: "ai_overestimated", label: "AI overestimated" },
  { value: "ai_underestimated", label: "AI underestimated" },
  { value: "missing_documentation", label: "Missing documentation" },
  { value: "image_quality_issue", label: "Image quality issue" },
  { value: "conflicting_evidence", label: "Conflicting evidence" },
  { value: "clinic_contribution_clarified", label: "Clinic contribution clarified" },
  { value: "medical_nuance", label: "Medical nuance" },
  { value: "benchmark_rule_exception", label: "Benchmark rule exception" },
  { value: "auditor_judgment", label: "Auditor judgment" },
];

const SECTION_KEYS: { key: string; label: string }[] = [
  { key: "hairline_design", label: "Hairline Design" },
  { key: "donor_management", label: "Donor Management" },
  { key: "extraction_quality", label: "Extraction Quality" },
  { key: "recipient_placement", label: "Recipient Placement" },
  { key: "density_distribution", label: "Density Distribution" },
  { key: "graft_handling", label: "Graft Handling" },
  { key: "documentation_integrity", label: "Documentation Integrity" },
  { key: "healing_aftercare", label: "Healing & Aftercare" },
  { key: "benchmark_eligibility", label: "Benchmark Eligibility" },
];

const FEEDBACK_TYPES: { value: string; label: string }[] = [
  { value: "clarification", label: "Clarification" },
  { value: "improvement_suggestion", label: "Improvement suggestion" },
  { value: "evidence_gap", label: "Evidence gap" },
  { value: "quality_note", label: "Quality note" },
  { value: "benchmark_note", label: "Benchmark note" },
  { value: "other", label: "Other" },
];

const VISIBILITY_SCOPES: { value: string; label: string }[] = [
  { value: "internal_only", label: "Internal only" },
  { value: "included_in_report", label: "Included in report" },
  { value: "included_in_clinic_feedback", label: "Included in clinic feedback" },
];

type DomainScoreV1 = {
  domain_id: string;
  title?: string;
  raw_score?: number;
  weighted_score?: number;
  confidence?: number;
  drivers?: string[];
  limiters?: unknown;
  top_drivers?: string[];
  top_limiters?: string[];
  priority_actions?: Array<{ order: number; action: string; impact: string; effort: string }>;
};

type OverrideRow = {
  id: string;
  domain_key: string;
  ai_score: number;
  ai_weighted_score: number | null;
  manual_score: number;
  manual_weighted_score: number | null;
  delta_score: number;
  reason_category: string;
  override_note: string | null;
};

type FeedbackRow = {
  id: string;
  section_key: string;
  feedback_type: string;
  visibility_scope: string;
  feedback_note: string;
  created_at: string;
};

function scoreChipClass(score: number) {
  if (score >= 85) return "bg-emerald-300/20 text-emerald-100 border-emerald-300/40";
  if (score >= 70) return "bg-lime-300/20 text-lime-100 border-lime-300/40";
  if (score >= 55) return "bg-amber-300/20 text-amber-100 border-amber-300/40";
  return "bg-rose-300/20 text-rose-100 border-rose-300/40";
}

export default function AuditorReviewPanel({
  caseId,
  reportId,
  domains,
  benchmark,
  overallScores,
  onRefresh,
}: {
  caseId: string;
  reportId: string;
  domains: DomainScoreV1[];
  benchmark?: { eligible?: boolean; reasons?: string[] };
  overallScores?: { performance_score?: number; benchmark_score?: number; confidence_multiplier?: number };
  onRefresh?: () => void;
}) {
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [sectionFeedbackOpen, setSectionFeedbackOpen] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<Record<string, { manual: number; reason: string; note: string }>>({});

  const fetchOverrides = useCallback(async () => {
    try {
      const res = await fetch(`/api/auditor/score-overrides?caseId=${caseId}&reportId=${reportId}`);
      const json = await res.json();
      if (json.ok) setOverrides(json.overrides ?? []);
    } catch {
      setOverrides([]);
    }
  }, [caseId, reportId]);

  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch(`/api/auditor/section-feedback?caseId=${caseId}&reportId=${reportId}`);
      const json = await res.json();
      if (json.ok) setFeedback(json.feedback ?? []);
    } catch {
      setFeedback([]);
    }
  }, [caseId, reportId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchOverrides(), fetchFeedback()]);
      setLoading(false);
    })();
  }, [fetchOverrides, fetchFeedback]);

  const overrideByDomain = new Map(overrides.map((o) => [o.domain_key, o]));
  const resolvedDomains: ResolvedDomainScore[] = domains
    .filter((d) => DOMAIN_IDS.includes(d.domain_id as any))
    .map((d) => {
      const ov = overrideByDomain.get(d.domain_id);
      const overridePayload: DomainScoreOverride | null = ov
        ? {
            domain_key: d.domain_id as any,
            ai_score: ov.ai_score,
            ai_weighted_score: ov.ai_weighted_score,
            manual_score: ov.manual_score,
            manual_weighted_score: ov.manual_weighted_score,
            delta_score: ov.delta_score,
          }
        : null;
      return resolveDomainScore(
        d.domain_id as any,
        Number(d.raw_score ?? 0),
        ov?.ai_weighted_score ?? Number(d.weighted_score ?? 0),
        overridePayload
      );
    });

  const { performance_score: auditorScore } = computeAuditorOverallScore(resolvedDomains);
  const aiOverall = overallScores?.performance_score ?? overallScores?.benchmark_score ?? 0;
  const domainsAdjusted = overrides.length;
  const sectionsCommented = new Set(feedback.map((f) => f.section_key)).size;

  const saveOverride = async (domainKey: string) => {
    const domain = domains.find((d) => d.domain_id === domainKey);
    if (!domain) return;
    const override = overrideByDomain.get(domainKey);
    const draft = overrideDraft[domainKey];
    const manualScore = draft?.manual ?? override?.manual_score ?? Number(domain.raw_score ?? 0);
    const reasonCategory = draft?.reason ?? override?.reason_category ?? "";
    if (!reasonCategory) return;

    setSaving(`override-${domainKey}`);
    try {
      const res = await fetch("/api/auditor/score-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          reportId,
          domainKey,
          aiScore: Number(domain.raw_score ?? 0),
          aiWeightedScore: domain.weighted_score != null ? Number(domain.weighted_score) : null,
          manualScore,
          reasonCategory,
          overrideNote: (draft?.note ?? override?.override_note ?? "") || null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        await fetchOverrides();
        setOverrideDraft((prev) => {
          const next = { ...prev };
          delete next[domainKey];
          return next;
        });
        setExpandedDomain(null);
        onRefresh?.();
      } else {
        alert(json.error ?? "Failed to save override");
      }
    } catch (e: any) {
      alert(e?.message ?? "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const restoreOverride = async (domainKey: string) => {
    setSaving(`restore-${domainKey}`);
    try {
      const res = await fetch(
        `/api/auditor/score-overrides?caseId=${caseId}&reportId=${reportId}&domainKey=${domainKey}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (json.ok) {
        await fetchOverrides();
        setOverrideDraft((prev) => {
          const next = { ...prev };
          delete next[domainKey];
          return next;
        });
        setExpandedDomain(null);
        onRefresh?.();
      } else {
        alert(json.error ?? "Failed to restore");
      }
    } catch (e: any) {
      alert(e?.message ?? "Failed to restore");
    } finally {
      setSaving(null);
    }
  };

  const saveFeedback = async (sectionKey: string, type: string, scope: string, note: string) => {
    if (!note.trim()) return;
    setSaving(`feedback-${sectionKey}`);
    try {
      const res = await fetch("/api/auditor/section-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          reportId,
          sectionKey,
          feedbackType: type,
          visibilityScope: scope,
          feedbackNote: note,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        await fetchFeedback();
        setSectionFeedbackOpen(null);
        onRefresh?.();
      } else {
        alert(json.error ?? "Failed to save feedback");
      }
    } catch (e: any) {
      alert(e?.message ?? "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <p className="text-sm text-slate-400">Loading auditor controls…</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Auditor Review</h2>
          <p className="text-sm text-slate-300/80">Override AI scores and add section feedback.</p>
        </div>
        {/* Review sidebar summary */}
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-400">AI overall</p>
            <p className="font-semibold text-slate-100">{Number(aiOverall).toFixed(1)}</p>
          </div>
          <div className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3 py-2">
            <p className="text-[11px] uppercase text-cyan-200">Auditor score</p>
            <p className="font-semibold text-cyan-100">{auditorScore.toFixed(1)}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-400">Domains adjusted</p>
            <p className="font-semibold text-slate-100">{domainsAdjusted}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-400">Sections commented</p>
            <p className="font-semibold text-slate-100">{sectionsCommented}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-400">Benchmark</p>
            <p className={`font-semibold ${benchmark?.eligible ? "text-emerald-200" : "text-slate-200"}`}>
              {benchmark?.eligible ? "Eligible" : "Not eligible"}
            </p>
          </div>
        </div>
      </div>

      {/* Domain cards with override controls */}
      <div className="grid gap-3">
        {domains
          .filter((d) => DOMAIN_IDS.includes(d.domain_id as any))
          .map((domain) => {
            const resolved = resolvedDomains.find((r) => r.domain_id === domain.domain_id)!;
            const override = overrideByDomain.get(domain.domain_id);
            const isExpanded = expandedDomain === domain.domain_id;
            const draft = overrideDraft[domain.domain_id];
            const raw = Number(domain.raw_score ?? 0);
            const weighted = Number(domain.weighted_score ?? raw);
            const confidence = Math.round(Number(domain.confidence ?? 0) * 100);
            const drivers = (domain.top_drivers ?? domain.drivers ?? []).slice(0, 4);
            const limiters = (domain.top_limiters ?? (Array.isArray(domain.limiters) ? domain.limiters : [])).slice(0, 4);
            const actions = (domain.priority_actions ?? []).slice(0, 3);

            return (
              <div
                key={domain.domain_id}
                className={`rounded-xl border transition-colors ${
                  override ? "border-amber-300/40 bg-amber-950/30" : "border-slate-700 bg-slate-950"
                }`}
              >
                <div
                  className="flex cursor-pointer items-center justify-between gap-3 p-4"
                  onClick={() => setExpandedDomain(isExpanded ? null : domain.domain_id)}
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{domain.domain_id}</p>
                    <p className="font-semibold text-white">
                      {domain.title ?? DOMAIN_TITLES[domain.domain_id]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${scoreChipClass(resolved.final_weighted)}`}>
                      {resolved.is_overridden ? (
                        <>
                          <span className="line-through text-slate-400">{resolved.ai_score}</span> → {resolved.final_score}
                        </>
                      ) : (
                        `Score ${Math.round(resolved.final_weighted)}`
                      )}
                    </span>
                    <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-100">
                      Conf {confidence}%
                    </span>
                    {override && (
                      <span className="rounded-md border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-100">
                        Overridden
                      </span>
                    )}
                    <span className="text-slate-400">{isExpanded ? "⌃" : "⌄"}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-700 px-4 pb-4 pt-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-3">
                        <p className="text-[11px] uppercase text-slate-200">Raw</p>
                        <p className="mt-1 text-lg font-semibold text-white">{Math.round(raw)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-3">
                        <p className="text-[11px] uppercase text-slate-200">Confidence</p>
                        <p className="mt-1 text-lg font-semibold text-white">{confidence}%</p>
                      </div>
                      <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-3">
                        <p className="text-[11px] uppercase text-slate-200">Weighted</p>
                        <p className="mt-1 text-lg font-semibold text-white">{Math.round(weighted)}</p>
                      </div>
                    </div>

                    {drivers.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase text-slate-300">Drivers</p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-slate-200/90">
                          {(drivers as string[]).map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {limiters.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold uppercase text-slate-300">Limiters</p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-slate-200/90">
                          {(limiters as string[]).map((l, i) => (
                            <li key={i}>{typeof l === "object" && l && "item" in l ? (l as any).item : l}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {actions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold uppercase text-slate-300">Priority actions</p>
                        <ol className="mt-1 list-decimal pl-5 text-sm text-slate-200/90">
                          {actions.map((a) => (
                            <li key={a.order}>{a.action}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Override controls */}
                    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-300">Override score</p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400">Manual score (0–100)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            className="ml-1 mt-0.5 w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white"
                            defaultValue={draft?.manual ?? (override?.manual_score ?? raw)}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isNaN(v))
                                setOverrideDraft((prev) => ({
                                  ...prev,
                                  [domain.domain_id]: {
                                    manual: v,
                                    reason: prev[domain.domain_id]?.reason ?? "",
                                    note: prev[domain.domain_id]?.note ?? "",
                                  },
                                }));
                            }}
                          />
                        </div>
                        <div className="min-w-[180px]">
                          <label className="text-[11px] text-slate-400">Reason category</label>
                          <select
                            className="mt-0.5 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white"
                            value={draft?.reason ?? override?.reason_category ?? ""}
                            onChange={(e) =>
                              setOverrideDraft((prev) => ({
                                ...prev,
                                [domain.domain_id]: {
                                  manual: prev[domain.domain_id]?.manual ?? raw,
                                  reason: e.target.value,
                                  note: prev[domain.domain_id]?.note ?? "",
                                },
                              }))
                            }
                          >
                            <option value="">Select reason</option>
                            {REASON_CATEGORIES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <label className="text-[11px] text-slate-400">Override note</label>
                          <input
                            type="text"
                            placeholder="Optional note"
                            className="mt-0.5 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white placeholder-slate-500"
                            defaultValue={draft?.note ?? override?.override_note ?? ""}
                            onChange={(e) =>
                              setOverrideDraft((prev) => ({
                                ...prev,
                                [domain.domain_id]: {
                                  manual: prev[domain.domain_id]?.manual ?? raw,
                                  reason: prev[domain.domain_id]?.reason ?? "",
                                  note: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <button
                          disabled={saving !== null || !(draft?.reason ?? override?.reason_category)}
                          onClick={(e) => {
                            e.stopPropagation();
                            saveOverride(domain.domain_id);
                          }}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                        >
                          {override ? "Update" : "Save override"}
                        </button>
                        {override && (
                          <button
                            disabled={saving !== null}
                            onClick={(e) => {
                              e.stopPropagation();
                              restoreOverride(domain.domain_id);
                            }}
                            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                          >
                            Restore AI
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Section feedback */}
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-white">Section feedback</h3>
        <p className="mb-3 text-xs text-slate-400">Targeted notes per audit section. Visibility controls future report/clinic exposure.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SECTION_KEYS.map((sec) => {
            const isOpen = sectionFeedbackOpen === sec.key;
            const items = feedback.filter((f) => f.section_key === sec.key);
            return (
              <div key={sec.key} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">{sec.label}</span>
                  {items.length > 0 && (
                    <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{items.length}</span>
                  )}
                </div>
                {items.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {items.slice(0, 2).map((f) => (
                      <li key={f.id} className="text-xs text-slate-300 line-clamp-2">{f.feedback_note}</li>
                    ))}
                    {items.length > 2 && <li className="text-xs text-slate-500">+{items.length - 2} more</li>}
                  </ul>
                )}
                {!isOpen ? (
                  <button
                    onClick={() => setSectionFeedbackOpen(sec.key)}
                    className="mt-2 text-xs text-cyan-300 hover:text-cyan-200"
                  >
                    Add feedback
                  </button>
                ) : (
                  <SectionFeedbackForm
                    sectionKey={sec.key}
                    sectionLabel={sec.label}
                    onSave={(type, scope, note) => saveFeedback(sec.key, type, scope, note)}
                    onCancel={() => setSectionFeedbackOpen(null)}
                    saving={saving !== null}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Report-level actions */}
      <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-700 pt-4">
        <button
          onClick={() => window.open(`/reports/${caseId}/html`, "_blank")}
          className="rounded-lg border border-cyan-300/40 bg-cyan-300/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/25"
        >
          Preview final report
        </button>
        <button
          onClick={async () => {
            try {
              const res = await fetch("/api/auditor/report-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reportId, action: "approve_final_report" }),
              });
              const json = await res.json();
              if (json.ok) onRefresh?.();
              else alert(json.error ?? "Failed");
            } catch (e: any) {
              alert(e?.message ?? "Failed");
            }
          }}
          className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-300/20"
        >
          Approve final report
        </button>
        <button
          onClick={async () => {
            try {
              const res = await fetch(
                `/api/auditor/score-overrides?caseId=${caseId}&reportId=${reportId}`,
                { method: "DELETE" }
              );
              const json = await res.json();
              if (json.ok) {
                await fetchOverrides();
                onRefresh?.();
              } else alert(json.error ?? "Failed");
            } catch (e: any) {
              alert(e?.message ?? "Failed");
            }
          }}
          disabled={overrides.length === 0}
          className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          Restore all AI values
        </button>
        <button
          onClick={async () => {
            try {
              const res = await fetch("/api/auditor/report-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reportId, action: "needs_more_evidence" }),
              });
              const json = await res.json();
              if (json.ok) onRefresh?.();
              else alert(json.error ?? "Failed");
            } catch (e: any) {
              alert(e?.message ?? "Failed");
            }
          }}
          className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-300/20"
        >
          Mark needs more evidence
        </button>
        <button
          onClick={onRefresh}
          className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
        >
          Refresh view
        </button>
      </div>
    </section>
  );
}

function SectionFeedbackForm({
  sectionKey,
  sectionLabel,
  onSave,
  onCancel,
  saving,
}: {
  sectionKey: string;
  sectionLabel: string;
  onSave: (type: string, scope: string, note: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [type, setType] = useState("clarification");
  const [scope, setScope] = useState("internal_only");
  const [note, setNote] = useState("");

  return (
    <div className="mt-2 space-y-2">
      <select
        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        {FEEDBACK_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <select
        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white"
        value={scope}
        onChange={(e) => setScope(e.target.value)}
      >
        {VISIBILITY_SCOPES.map((v) => (
          <option key={v.value} value={v.value}>{v.label}</option>
        ))}
      </select>
      <textarea
        placeholder={`Note for ${sectionLabel}…`}
        rows={2}
        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white placeholder-slate-500"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          disabled={saving || !note.trim()}
          onClick={() => onSave(type, scope, note.trim())}
          className="rounded bg-cyan-600 px-2 py-1 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          Save feedback
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
