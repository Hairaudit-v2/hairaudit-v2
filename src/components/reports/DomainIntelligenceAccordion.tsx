"use client";

type EvidenceBasis = "submitted_photos" | "submitted_metadata" | "ai_vision_findings" | "missing_evidence";

type DomainScoreV1 = {
  domain_id: string;
  title: string;
  raw_score: number;
  confidence: number;
  evidence_grade: "A" | "B" | "C" | "D";
  weighted_score: number;
  drivers?: string[];
  limiters?: string[] | Array<{ item?: string; evidence_basis?: EvidenceBasis }>;
  top_drivers?: string[];
  top_limiters?: string[];
  priority_actions?: Array<{
    order: number;
    action: string;
    impact: "high" | "med" | "low";
    effort: "high" | "med" | "low";
    evidence_basis?: EvidenceBasis;
  }>;
};

function scoreChipClass(score: number) {
  if (score >= 85) return "bg-emerald-300/20 text-emerald-100 border-emerald-300/40";
  if (score >= 70) return "bg-lime-300/20 text-lime-100 border-lime-300/40";
  if (score >= 55) return "bg-amber-300/20 text-amber-100 border-amber-300/40";
  return "bg-rose-300/20 text-rose-100 border-rose-300/40";
}

function basisLabel(basis: EvidenceBasis) {
  if (basis === "submitted_photos") return "Photos";
  if (basis === "submitted_metadata") return "Metadata";
  if (basis === "ai_vision_findings") return "AI Vision";
  return "Missing";
}

function normalizeLimiters(
  limiters: DomainScoreV1["limiters"],
  fallback?: string[]
): Array<{ text: string; basis?: EvidenceBasis }> {
  if (!Array.isArray(limiters)) {
    return (fallback ?? []).slice(0, 3).map((text) => ({ text }));
  }
  if (limiters.length === 0) return [];
  if (typeof limiters[0] === "string") {
    const src = (fallback && fallback.length > 0 ? fallback : (limiters as string[])).slice(0, 3);
    return src.map((text) => ({ text }));
  }
  return (limiters as Array<{ item?: string; evidence_basis?: EvidenceBasis }>)
    .map((entry) => {
      const text = String(entry?.item ?? "").trim();
      if (!text) return null;
      return { text, basis: entry.evidence_basis };
    })
    .filter(Boolean) as Array<{ text: string; basis?: EvidenceBasis }>;
}

export default function DomainIntelligenceAccordion({ domains }: { domains: DomainScoreV1[] }) {
  if (!Array.isArray(domains) || domains.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">Domain Intelligence</h2>
        <p className="text-sm text-slate-300/80">SP, DP, GV, IC, DI analysis cards with actionable guidance.</p>
      </div>

      <div className="grid gap-4">
        {domains.map((domain) => {
          const raw = Math.round(Number(domain.raw_score ?? 0));
          const confidence = Math.round(Number(domain.confidence ?? 0) * 100);
          const weighted = Math.round(Number(domain.weighted_score ?? raw));
          const drivers = (domain.top_drivers?.length ? domain.top_drivers : domain.drivers ?? []).slice(0, 4);
          const limiters = normalizeLimiters(domain.limiters, domain.top_limiters).slice(0, 4);
          const actions = (domain.priority_actions ?? []).slice(0, 3);

          return (
            <details
              key={domain.domain_id}
              className="group rounded-xl border border-white/10 bg-slate-950/70 open:bg-slate-900/70"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{domain.domain_id}</p>
                  <p className="font-semibold text-white">{domain.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${scoreChipClass(weighted)}`}>
                    Score {weighted}
                  </span>
                  <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-100">
                    Conf {confidence}%
                  </span>
                </div>
              </summary>

              <div className="border-t border-white/10 px-4 pb-4 pt-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Raw</p>
                    <p className="mt-1 text-lg font-semibold text-white">{raw}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Confidence</p>
                    <p className="mt-1 text-lg font-semibold text-white">{confidence}%</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Evidence Grade</p>
                    <p className="mt-1 text-lg font-semibold text-white">{domain.evidence_grade ?? "D"}</p>
                  </div>
                </div>

                {drivers.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Drivers</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200/90">
                      {drivers.map((driver) => (
                        <li key={`${domain.domain_id}-driver-${driver}`}>{driver}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {limiters.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Limiters</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-200/90">
                      {limiters.map((limiter) => (
                        <li key={`${domain.domain_id}-limiter-${limiter.text}`} className="flex items-center justify-between gap-3">
                          <span>{limiter.text}</span>
                          {limiter.basis ? (
                            <span className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                              {basisLabel(limiter.basis)}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {actions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Priority Actions</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-200/90">
                      {actions.map((action) => (
                        <li key={`${domain.domain_id}-action-${action.order}`}>
                          {action.action} <span className="text-slate-400">({action.impact}/{action.effort})</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
