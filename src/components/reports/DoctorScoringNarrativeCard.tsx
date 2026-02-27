"use client";

import React from "react";
import {
  EvidenceBasis,
  normalizeDoctorNarrative,
  type NormalizedDoctorNarrative,
} from "@/lib/scoring/normalizeDoctorNarrative";

function pillForBasis(b: EvidenceBasis) {
  const label =
    b === "submitted_photos"
      ? "Photos"
      : b === "submitted_metadata"
        ? "Metadata"
        : b === "ai_vision_findings"
          ? "AI vision"
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
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function normalizeLimiters(limiters: unknown): Array<{ text: string; basis?: EvidenceBasis }> {
  if (!Array.isArray(limiters)) return [];
  return limiters
    .map((x) => {
      if (typeof x === "string") return { text: x };
      if (x && typeof x === "object") {
        const item = String((x as any).item ?? "");
        const basis = (x as any).evidence_basis as EvidenceBasis | undefined;
        return item ? { text: item, basis } : null;
      }
      return null;
    })
    .filter(Boolean) as any;
}

function normalizePriorityActions(actions: unknown): Array<{ action: string; impact?: string; effort?: string; basis?: EvidenceBasis; evidence_needed?: string[] }> {
  if (!Array.isArray(actions)) return [];
  return actions
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const action = String((x as any).action ?? "");
      if (!action) return null;
      return {
        action,
        impact: (x as any).impact ? String((x as any).impact) : undefined,
        effort: (x as any).effort ? String((x as any).effort) : undefined,
        basis: (x as any).evidence_basis as EvidenceBasis | undefined,
        evidence_needed: Array.isArray((x as any).evidence_needed) ? ((x as any).evidence_needed as any[]).map(String).slice(0, 8) : undefined,
      };
    })
    .filter(Boolean) as any;
}

export default function DoctorScoringNarrativeCard({
  scoring,
  scoringVersion,
  generatedAt,
  aiContext,
}: {
  scoring: unknown | null | undefined;
  scoringVersion?: string | null;
  generatedAt?: string | null;
  aiContext?: { missing_required?: string[] } | null;
}) {
  if (!scoring || typeof scoring !== "object") return null;
  const normalized: NormalizedDoctorNarrative = normalizeDoctorNarrative(scoring);
  const domains = normalized.domains || {};
  const domainOrder = ["SP", "DP", "GV", "IC", "DI"];
  const hasAny = domainOrder.some((k) => domains[k]);
  if (!hasAny) return null;

  let gaps =
    Array.isArray(normalized.missing_evidence_priorities)
      ? normalized.missing_evidence_priorities.map((g) => ({
          item: String(g?.item ?? ""),
          why: String(g?.why_it_matters ?? ""),
        }))
      : [];

  if (!gaps.length && aiContext && Array.isArray(aiContext.missing_required)) {
    gaps = aiContext.missing_required
      .slice(0, 8)
      .map((k) => {
        const key = String(k);
        let label = key;
        if (key.startsWith("doctor_photo:")) {
          label = `Missing doctor photo: ${key.replace("doctor_photo:", "")}`;
        } else if (key.startsWith("patient_photo:")) {
          label = `Missing patient photo: ${key.replace("patient_photo:", "")}`;
        } else if (key.startsWith("doctor_answers:")) {
          label = `Missing doctor field: ${key.replace("doctor_answers:", "")}`;
        }
        return {
          item: label,
          why: "Based on submitted documentation, this evidence is missing and lowers confidence for benchmarking.",
        };
      });
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Doctor scoring narrative</h3>
          <p className="mt-1 text-sm text-slate-600">Evidence-tagged narrative items, based on submitted documentation.</p>
        </div>
        <div className="text-xs text-slate-500">
          {scoringVersion ? <div>Version: {scoringVersion}</div> : null}
          {generatedAt ? <div>Generated: {new Date(generatedAt).toLocaleString()}</div> : null}
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="font-semibold text-slate-900">Top Evidence Gaps Holding Confidence Back</div>
          <div className="mt-2 grid gap-2">
            {gaps.map((g) => (
              <div key={g.item} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="font-medium text-slate-900">{g.item}</div>
                <div className="mt-1 text-xs text-slate-600">{g.why}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {domainOrder.map((k) => {
          const d = domains[k];
          if (!d) return null;
          const drivers = d.drivers.slice(0, 3);
          const limiters = d.limiters.slice(0, 4);
          const actions = d.priority_actions.slice(0, 4);

          return (
            <section key={k} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">{k}</div>

              {drivers.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-semibold text-slate-600">Drivers</div>
                  <ul className="mt-1 list-disc pl-5 text-sm text-slate-700 space-y-0.5">
                    {drivers.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}

              {limiters.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-600">Limiters</div>
                  <ul className="mt-1 space-y-1">
                    {limiters.map((l) => (
                      <li key={`${k}-${l.item}`} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-0.5">•</span>
                        <span className="flex-1">{l.item}</span>
                        {l.evidence_basis ? pillForBasis(l.evidence_basis) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {actions.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-600">Priority actions</div>
                  <ol className="mt-1 list-decimal pl-5 text-sm text-slate-700 space-y-1">
                    {actions.map((a) => (
                      <li key={`${k}-${a.action}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{a.action}</span>
                          {a.evidence_basis ? pillForBasis(a.evidence_basis) : null}
                          {(a.impact || a.effort) && (
                            <span className="text-xs text-slate-500">
                              (impact: {a.impact ?? "—"}, effort: {a.effort ?? "—"})
                            </span>
                          )}
                        </div>
                        {Array.isArray(a.evidence_needed) && a.evidence_needed.length > 0 && (
                          <div className="mt-0.5 text-xs text-slate-500">
                            Evidence needed: {a.evidence_needed.slice(0, 6).join(", ")}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

