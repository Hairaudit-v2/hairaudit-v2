export type EvidenceBasis = "submitted_photos" | "submitted_metadata" | "ai_vision_findings" | "missing_evidence";

export type NormalizedLimiter = {
  item: string;
  evidence_basis: EvidenceBasis;
};

export type NormalizedPriorityAction = {
  action: string;
  impact?: string;
  effort?: string;
  evidence_basis: EvidenceBasis;
  evidence_needed?: string[];
};

export type NormalizedDoctorNarrativeDomain = {
  drivers: string[];
  limiters: NormalizedLimiter[];
  priority_actions: NormalizedPriorityAction[];
};

export type NormalizedDoctorNarrative = {
  domains: Record<string, NormalizedDoctorNarrativeDomain>;
  protocol_opportunities?: any[];
  suggested_modules?: any[];
  missing_evidence_priorities?: Array<{ item: string; why_it_matters: string }>;
};

const EVIDENCE_BASIS_FALLBACK: EvidenceBasis = "submitted_metadata";

function coerceEvidenceBasis(v: unknown): EvidenceBasis {
  const s = String(v ?? "").trim() as EvidenceBasis;
  return s === "submitted_photos" ||
    s === "submitted_metadata" ||
    s === "ai_vision_findings" ||
    s === "missing_evidence"
    ? s
    : EVIDENCE_BASIS_FALLBACK;
}

function isV2Limiter(x: unknown): x is { item: string; evidence_basis?: string } {
  return !!x && typeof x === "object" && typeof (x as any).item === "string";
}

function normalizeLimiters(raw: unknown): NormalizedLimiter[] {
  if (!Array.isArray(raw)) return [];
  const arr = raw as any[];
  if (arr.length === 0) return [];

  // v2 shape: objects with item/evidence_basis
  if (isV2Limiter(arr[0])) {
    return arr
      .map((x) => {
        if (!isV2Limiter(x)) return null;
        const item = String(x.item ?? "").trim();
        if (!item) return null;
        const basis = coerceEvidenceBasis((x as any).evidence_basis);
        return { item, evidence_basis: basis };
      })
      .filter(Boolean) as NormalizedLimiter[];
  }

  // v1: string[]
  return (arr as any[])
    .map((v) => {
      const item = String(v ?? "").trim();
      if (!item) return null;
      const lower = item.toLowerCase();
      const looksMissing =
        lower.includes("missing ") ||
        lower.startsWith("missing") ||
        lower.includes("not provided") ||
        lower.includes("no photo") ||
        lower.includes("no images") ||
        lower.includes("incomplete");
      return {
        item,
        evidence_basis: looksMissing ? ("missing_evidence" as EvidenceBasis) : EVIDENCE_BASIS_FALLBACK,
      };
    })
    .filter(Boolean) as NormalizedLimiter[];
}

function normalizePriorityActions(raw: unknown): NormalizedPriorityAction[] {
  if (!Array.isArray(raw)) return [];
  return (raw as any[])
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const action = String((x as any).action ?? "").trim();
      if (!action) return null;
      const impact = (x as any).impact ? String((x as any).impact) : undefined;
      const effort = (x as any).effort ? String((x as any).effort) : undefined;
      const basis = coerceEvidenceBasis((x as any).evidence_basis);
      const evidence_needed = Array.isArray((x as any).evidence_needed)
        ? ((x as any).evidence_needed as any[]).map((e) => String(e)).slice(0, 10)
        : undefined;
      return { action, impact, effort, evidence_basis: basis, evidence_needed };
    })
    .filter(Boolean) as NormalizedPriorityAction[];
}

export function normalizeDoctorNarrative(scoring: unknown): NormalizedDoctorNarrative {
  const out: NormalizedDoctorNarrative = {
    domains: {},
  };

  if (!scoring || typeof scoring !== "object") {
    return out;
  }

  const s = scoring as any;

  const domainsRaw = s.domains && typeof s.domains === "object" ? (s.domains as Record<string, unknown>) : {};
  for (const [key, value] of Object.entries(domainsRaw)) {
    const d = (value || {}) as any;
    const drivers =
      Array.isArray(d.drivers) && d.drivers.length
        ? (d.drivers as any[]).map((v) => String(v)).filter(Boolean).slice(0, 5)
        : [];
    const limiters = normalizeLimiters(d.limiters);
    const priority_actions = normalizePriorityActions(d.priority_actions);

    out.domains[key] = {
      drivers,
      limiters,
      priority_actions,
    };
  }

  if (Array.isArray(s.protocol_opportunities)) {
    out.protocol_opportunities = s.protocol_opportunities as any[];
  }
  if (Array.isArray(s.suggested_modules)) {
    out.suggested_modules = s.suggested_modules as any[];
  }

  if (Array.isArray(s.missing_evidence_priorities)) {
    out.missing_evidence_priorities = (s.missing_evidence_priorities as any[])
      .map((g) => {
        if (!g || typeof g !== "object") {
          const item = String(g ?? "").trim();
          return item
            ? {
                item,
                why_it_matters:
                  "Based on submitted documentation, this evidence is missing and lowers confidence for benchmarking.",
              }
            : null;
        }
        const item = String((g as any).item ?? "").trim();
        const why = String((g as any).why_it_matters ?? "").trim();
        if (!item) return null;
        return {
          item,
          why_it_matters:
            why ||
            "Based on submitted documentation, this evidence is missing and lowers confidence for benchmarking.",
        };
      })
      .filter(Boolean)
      .slice(0, 8) as Array<{ item: string; why_it_matters: string }>;
  }

  return out;
}

