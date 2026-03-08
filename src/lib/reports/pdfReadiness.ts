export type DomainDefinition = {
  domain_id: string;
  sections?: Array<{ section_id: string }>;
};

export type PdfReadinessInput = {
  caseStatus?: string | null;
  reportStatus?: string | null;
  summary: unknown;
};

export type PdfReadinessResult = {
  ready: boolean;
  reason?: string;
};

export function toNumberRecord(x: unknown): Record<string, number> {
  if (!x || typeof x !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export function deriveDomainScoresFromSections(
  sectionScores: Record<string, number>,
  domainDefs: DomainDefinition[]
): Record<string, number> {
  if (Object.keys(sectionScores).length === 0 || domainDefs.length === 0) return {};
  const out: Record<string, number> = {};
  for (const domain of domainDefs) {
    const values = (domain.sections ?? [])
      .map((s) => sectionScores[s.section_id])
      .filter((n): n is number => Number.isFinite(n));
    if (values.length === 0) continue;
    out[domain.domain_id] = values.reduce((a, b) => a + b, 0) / values.length;
  }
  return out;
}

export function deriveDomainScoresHeuristic(sectionScores: Record<string, number>): Record<string, number> {
  if (Object.keys(sectionScores).length === 0) return {};
  const avg = (keys: string[]) => {
    const vals = keys.map((k) => sectionScores[k]).filter((n): n is number => Number.isFinite(n));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const out: Record<string, number> = {};
  const rules: Array<[string, string[]]> = [
    ["donor_management", ["donor_management"]],
    ["extraction_quality", ["extraction_quality"]],
    ["graft_handling", ["graft_handling_and_viability"]],
    ["recipient_implantation", ["recipient_placement", "hairline_design", "density_distribution", "naturalness_and_aesthetics"]],
    ["safety_documentation_aftercare", ["post_op_course_and_aftercare", "complications_and_risks"]],
    ["consultation_indication", ["hairline_design", "naturalness_and_aesthetics"]],
  ];
  for (const [domainId, keys] of rules) {
    const value = avg(keys);
    if (value !== null) out[domainId] = value;
  }
  return out;
}

export function isAuditSummaryReady(summary: unknown): boolean {
  const s = (summary ?? null) as Record<string, unknown> | null;
  if (!s || typeof s !== "object") return false;
  if (s.manual_audit === true) return true;
  const forensic = ((s.forensic_audit ?? s.forensic) ?? null) as Record<string, unknown> | null;
  const overall = Number(s.overall_score ?? s.score ?? forensic?.overall_score);
  const sections = toNumberRecord(
    ((s as { computed?: { component_scores?: { sections?: unknown } } }).computed?.component_scores?.sections ??
      s.section_scores ??
      forensic?.section_scores ??
      null)
  );
  const narrative = String(forensic?.summary ?? s.notes ?? "").trim();
  return Number.isFinite(overall) && Object.keys(sections).length > 0 && narrative.length > 0;
}

export function evaluatePdfReadiness(input: PdfReadinessInput): PdfReadinessResult {
  if (String(input.caseStatus ?? "").toLowerCase() === "processing") {
    return { ready: false, reason: "case status is processing" };
  }
  if (String(input.reportStatus ?? "").toLowerCase() === "processing") {
    return { ready: false, reason: "report status is processing" };
  }
  if (!isAuditSummaryReady(input.summary)) {
    return { ready: false, reason: "audit summary is incomplete" };
  }
  return { ready: true };
}

export function shouldGeneratePdf(input: PdfReadinessInput): PdfReadinessResult {
  return evaluatePdfReadiness(input);
}

export function assertPdfReady(input: PdfReadinessInput): void {
  const state = evaluatePdfReadiness(input);
  if (state.ready) return;
  throw Object.assign(new Error(`AUDIT_NOT_READY: ${state.reason ?? "unknown"}`), {
    code: "AUDIT_NOT_READY" as const,
  });
}
