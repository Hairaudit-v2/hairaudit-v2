"use client";

import React from "react";

type EvidenceBasis = "submitted_photos" | "submitted_metadata" | "ai_vision_findings" | "missing_evidence";

type DomainScoreV1 = {
  domain_id: string;
  title: string;
  raw_score: number;
  confidence: number;
  evidence_grade: "A" | "B" | "C" | "D";
  weighted_score: number;
  drivers?: string[];
  limiters?: string[];
  improvement_plan?: Array<{
    priority: number;
    action: string;
    why: string;
    evidence_needed?: string[];
  }>;
  top_drivers?: string[];
  top_limiters?: string[];
  priority_actions?: Array<{
    order: number;
    action: string;
    impact: "high" | "med" | "low";
    effort: "high" | "med" | "low";
    evidence_basis?: EvidenceBasis;
    evidence_needed?: string[];
  }>;
  protocol_opportunities?: Array<{
    name: string;
    indication: string;
    expected_benefit_domain: string;
    documentation_required?: string[];
  }>;
  suggested_modules?: Array<{
    module_id: string;
    title: string;
    reason: string;
    linked_domain: string;
  }>;
};

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 70) return "text-green-700 bg-green-50 border-green-200";
  if (score >= 55) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

function gradeClass(g: string) {
  return g === "A"
    ? "bg-emerald-100 text-emerald-800"
    : g === "B"
      ? "bg-blue-100 text-blue-800"
      : g === "C"
        ? "bg-amber-100 text-amber-800"
        : "bg-rose-100 text-rose-800";
}

function pillForBasis(b: EvidenceBasis) {
  const label =
    b === "submitted_photos"
      ? "Photos"
      : b === "submitted_metadata"
        ? "Metadata"
        : b === "ai_vision_findings"
          ? "AI Vision"
          : "Missing";
  const cls =
    b === "missing_evidence"
      ? "bg-rose-100 text-rose-800 border-rose-200"
      : b === "ai_vision_findings"
        ? "bg-violet-100 text-violet-800 border-violet-200"
        : b === "submitted_photos"
          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
          : "bg-slate-100 text-slate-800 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function normalizeLimiters(limiters: unknown, topLimiters?: string[]): Array<{ text: string; basis?: EvidenceBasis }> {
  if (!Array.isArray(limiters)) {
    const src = Array.isArray(topLimiters) ? topLimiters : [];
    return src.slice(0, 3).map((t) => ({ text: String(t) }));
  }
  const arr = limiters as any[];
  if (arr.length === 0) return [];
  if (typeof arr[0] === "string") {
    const src = topLimiters && topLimiters.length ? topLimiters : (arr as string[]);
    return src.slice(0, 3).map((t) => ({ text: String(t) }));
  }
  return arr
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const item = String((x as any).item ?? "");
      const basis = (x as any).evidence_basis as EvidenceBasis | undefined;
      return item ? { text: item, basis } : null;
    })
    .filter(Boolean) as Array<{ text: string; basis?: EvidenceBasis }>;
}

export default function DomainScoreCards({
  domains,
  benchmark,
  overallScores,
}: {
  domains: DomainScoreV1[];
  benchmark?: { eligible?: boolean; reasons?: string[]; gate_version?: string };
  overallScores?: { performance_score?: number; confidence_grade?: string; confidence_multiplier?: number; benchmark_score?: number };
}) {
  const items = Array.isArray(domains) ? domains : [];
  if (items.length === 0) return null;

  const eligible = Boolean(benchmark?.eligible);
  const reasons = Array.isArray(benchmark?.reasons) ? benchmark!.reasons!.slice(0, 6) : [];
  const perf = overallScores?.performance_score;
  const confGrade = overallScores?.confidence_grade;
  const confMult = overallScores?.confidence_multiplier;
  const benchScore = overallScores?.benchmark_score;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Evidence-weighted Domains (v1)</h3>
          <p className="mt-1 text-sm text-slate-600">
            Scores are evidence-weighted and confidence-multiplied, based on submitted documentation.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {(perf != null || benchScore != null) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">
                Performance Score: {perf ?? "—"}
              </div>
              <div className="text-xs">
                Confidence: {confGrade ?? "—"} {typeof confMult === "number" ? `(${confMult.toFixed(2)})` : ""}
              </div>
              <div className="text-xs">
                Benchmark Score: {benchScore ?? "—"}
              </div>
            </div>
          )}
          <div className={`rounded-xl border px-3 py-2 text-sm ${eligible ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
            <div className="font-semibold">Benchmark eligible</div>
            <div className="text-xs">{eligible ? "Yes" : "No"}</div>
          </div>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div className="font-medium mb-1">Eligibility gate ({String(benchmark?.gate_version ?? "v1")})</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((d) => {
          const confPct = Math.round(Number(d.confidence || 0) * 100);
          const weighted = Number.isFinite(Number(d.weighted_score)) ? Number(d.weighted_score) : Math.round(Number(d.raw_score || 0) * Number(d.confidence || 0));
          const color = scoreColor(weighted);
          return (
            <section key={d.domain_id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-500">{d.domain_id}</div>
                  <div className="font-semibold text-slate-900">{d.title}</div>
                </div>
                <span className={`rounded px-2 py-0.5 text-sm font-bold ${gradeClass(String(d.evidence_grade ?? "D"))}`}>
                  {String(d.evidence_grade ?? "D")}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="text-[10px] font-semibold text-slate-500">Raw</div>
                  <div className="text-lg font-bold text-slate-900">{Math.round(Number(d.raw_score || 0))}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="text-[10px] font-semibold text-slate-500">Confidence</div>
                  <div className="text-lg font-bold text-slate-900">{confPct}%</div>
                </div>
                <div className={`rounded-xl border p-2 ${color}`}>
                  <div className="text-[10px] font-semibold opacity-80">Weighted</div>
                  <div className="text-lg font-bold">{Math.round(weighted)}</div>
                </div>
              </div>

              {(Array.isArray(d.drivers) && d.drivers.length > 0) && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-600">Drivers</div>
                  <ul className="mt-1 list-disc pl-5 text-sm text-slate-700 space-y-0.5">
                    {(d.top_drivers?.length ? d.top_drivers : d.drivers).slice(0, 3).map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              )}

              {(Array.isArray(d.limiters) && d.limiters.length > 0) && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-600">Limiters</div>
                  <ul className="mt-1 space-y-1 text-sm text-slate-700">
                    {normalizeLimiters(d.limiters as any, d.top_limiters).map((l) => (
                      <li key={`${d.domain_id}-${l.text}`} className="flex items-start gap-2">
                        <span className="mt-0.5">•</span>
                        <span className="flex-1">{l.text}</span>
                        {l.basis ? pillForBasis(l.basis) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(Array.isArray(d.priority_actions) && d.priority_actions.length > 0) && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-600">Priority actions</div>
                  <ol className="mt-1 list-decimal pl-5 text-sm text-slate-700 space-y-1">
                    {d.priority_actions.slice(0, 5).map((p) => (
                      <li key={`${d.domain_id}-${p.order}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{p.action}</span>
                          {p.evidence_basis ? pillForBasis(p.evidence_basis as EvidenceBasis) : null}
                          <span className="text-xs text-slate-500">
                            (impact: {p.impact}, effort: {p.effort})
                          </span>
                        </div>
                        {Array.isArray(p.evidence_needed) && p.evidence_needed.length > 0 && (
                          <ul className="mt-0.5 list-disc pl-5 text-xs text-slate-500 space-y-0.5">
                            {p.evidence_needed.slice(0, 5).map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                            {p.evidence_needed.length > 5 && (
                              <li key="more">+{p.evidence_needed.length - 5} more…</li>
                            )}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {(Array.isArray(d.protocol_opportunities) && d.protocol_opportunities.length > 0) && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-600">Protocol opportunities</div>
                  <ul className="mt-1 list-disc pl-5 text-sm text-slate-700 space-y-0.5">
                    {d.protocol_opportunities.slice(0, 3).map((p) => (
                      <li key={p.name}>
                        <span className="font-medium">{p.name}</span>
                        <div className="text-xs text-slate-500">{p.indication}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

