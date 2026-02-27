import { computeEvidenceScore, type EvidenceScore, DOCTOR_PHOTO_SCHEMA, DOCTOR_REQUIRED_KEYS, PATIENT_REQUIRED_KEYS, buildCountsByKey } from "@/lib/auditPhotoSchemas";
import { mapLegacyDoctorAnswers, doctorAuditSchema } from "@/lib/doctorAuditSchema";

export type DomainId = "SP" | "DP" | "GV" | "IC" | "DI";

export type DomainScoreV1 = {
  domain_id: DomainId;
  title: string;
  raw_score: number; // 0–100
  confidence: number; // 0–1
  evidence_grade: EvidenceScore; // A/B/C/D
  weighted_score: number; // raw_score * confidence
  drivers: string[]; // 1–5 short items
  limiters: string[]; // 1–8 short items
  improvement_plan: Array<{
    priority: 1 | 2 | 3 | 4 | 5;
    action: string;
    why: string;
    evidence_needed: string[];
  }>;

  // v1 improvement output contract (new; keep legacy fields above for back-compat)
  top_drivers?: string[]; // 1–3
  top_limiters?: string[]; // 1–3
  priority_actions?: Array<{
    order: number; // 1..5
    action: string;
    impact: "high" | "med" | "low";
    effort: "high" | "med" | "low";
    evidence_needed: string[];
  }>;
  protocol_opportunities?: Array<{
    name: string;
    indication: string;
    expected_benefit_domain: DomainId;
    documentation_required: string[];
  }>;
  suggested_modules?: Array<{
    module_id: string;
    title: string;
    reason: string;
    linked_domain: DomainId;
  }>;
};

export type BenchmarkEligibility = {
  eligible: boolean;
  gate_version: "balanced_v1";
  reasons: string[];
  overall_confidence: number; // 0.50–1.00 confidence multiplier
  confidence_grade: "A" | "B" | "C" | "D";
  doctor_evidence_grade: EvidenceScore | null;
  doctor_answers_complete: boolean;
};

export type CompletenessIndexV1 = {
  version: 1;
  score: number; // 0–100
  weights: { photos: 45; structured_metadata: 35; numeric_precision: 10; verification_evidence: 10 };
  breakdown: {
    photo_coverage: { score: number; base: number; bonus: number; per_category: Record<string, { uploaded: number; min: number; done: number }> };
    structured_metadata: { score: number; done: number; total: number; missing_keys: string[] };
    numeric_precision: { score: number; done: number; total: number; missing_keys: string[] };
    verification_evidence: { score: number; points: { graft_count_verified: number; intraop_present: number; day0_donor_recipient_present: number } };
  };
};

export type ConfidenceModelV1 = {
  version: 1;
  evidence_grade: "A" | "B" | "C" | "D";
  confidence_multiplier: number; // 0.50–1.00
  base_multiplier: number;
  penalties: Array<{ id: string; amount: number; reason: string }>;
  inputs: {
    completeness_score: number; // 0–100
    required_photos_coverage: number; // 0–1
    structured_metadata_completion: number; // 0–1
    missing_day0_recipient: boolean;
    missing_day0_donor: boolean;
    missing_holdingSolution: boolean;
    missing_graftCountImplanted: boolean;
    missing_technique_critical_block: boolean;
  };
};

export type OverallScoresV1 = {
  version: 1;
  domain_weights: { SP: 15; DP: 25; GV: 20; IC: 25; DI: 15 };
  performance_score: number; // 0–100 (overall_raw)
  confidence_grade: "A" | "B" | "C" | "D";
  confidence_multiplier: number; // 0.50–1.00
  benchmark_score: number; // 0–100 (overall_weighted)
};

export type TierV1 =
  | { tier_id: "tier1_standard"; title: "Standard Audit"; eligible: boolean; reasons: string[] }
  | { tier_id: "tier2_certified"; title: "Certified Submission"; eligible: boolean; reasons: string[] }
  | { tier_id: "tier3_award"; title: "Award Eligibility"; eligible: boolean; reasons: string[] };
type UploadRow = { type?: string; metadata?: any };

type ForensicAuditLike = {
  confidence?: number;
  confidence_label?: string;
  data_quality?: { missing_inputs?: string[]; missing_photos?: string[]; limitations?: string[] };
  section_scores?: Record<string, number>;
  section_score_evidence?: Record<string, string[]>;
  photo_observations?: Array<{ suspected_view?: string }>;
};

const clamp01 = (n: unknown) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
};

const clampScore = (n: unknown) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const avg = (xs: number[]) => {
  const ys = xs.filter((n) => Number.isFinite(n));
  if (ys.length === 0) return null;
  return ys.reduce((a, b) => a + b, 0) / ys.length;
};

function gradeToFactor(g: EvidenceScore): number {
  if (g === "A") return 1.0;
  if (g === "B") return 0.9;
  if (g === "C") return 0.75;
  return 0.6;
}

function pickEvidenceGrade(params: { doctorGrade: EvidenceScore | null; patientGrade: EvidenceScore | null; prefer: "doctor" | "patient" | "either" }): EvidenceScore {
  const { doctorGrade, patientGrade, prefer } = params;
  const fallback: EvidenceScore = patientGrade ?? doctorGrade ?? "D";
  if (prefer === "doctor") return doctorGrade ?? fallback;
  if (prefer === "patient") return patientGrade ?? fallback;
  return doctorGrade ?? patientGrade ?? "D";
}

function isInsufficientEvidenceLine(s: string) {
  return String(s || "").trim().toLowerCase().startsWith("insufficient evidence:");
}

function bestEvidenceSnippets(params: { evidence?: string[]; max: number }): string[] {
  const xs = (params.evidence ?? []).map((x) => String(x).trim()).filter(Boolean);
  const strong = xs.filter((x) => !isInsufficientEvidenceLine(x));
  const out = (strong.length ? strong : xs).slice(0, params.max);
  return out.map((x) => x.replace(/\s+/g, " ").trim());
}

function viewCoverageFactor(obs: ForensicAuditLike["photo_observations"] | undefined): number {
  const items = Array.isArray(obs) ? obs : [];
  if (items.length === 0) return 0.7; // neutral default (don’t punish if vision not used)
  const known = items.filter((p) => String(p?.suspected_view ?? "").trim() && String(p?.suspected_view ?? "").trim() !== "unknown").length;
  const rate = items.length > 0 ? known / items.length : 0;
  // Keep conservative: treat 0–100% → 0.75–1.0
  return 0.75 + 0.25 * Math.max(0, Math.min(1, rate));
}

function doctorAnswersCompleteness(doctorAnswersRaw: Record<string, unknown> | null | undefined): { complete: boolean; issues: string[] } {
  if (!doctorAnswersRaw || typeof doctorAnswersRaw !== "object") {
    return { complete: false, issues: ["Doctor answers not submitted."] };
  }
  const mapped = mapLegacyDoctorAnswers(doctorAnswersRaw);
  const parsed = doctorAuditSchema.safeParse(mapped);
  if (parsed.success) return { complete: true, issues: [] };
  const issues = parsed.error.issues.slice(0, 8).map((i) => {
    const path = i.path?.length ? String(i.path.join(".")) : "";
    return path ? `${path}: ${i.message}` : i.message;
  });
  return { complete: false, issues: issues.length ? issues : ["Doctor answers incomplete."] };
}

function requiredPhotoCoverage01(ci: CompletenessIndexV1): number {
  const per = ci.breakdown?.photo_coverage?.per_category ?? {};
  const keys = Object.keys(per);
  if (keys.length === 0) return 0;
  const avgDone = keys.reduce((a, k) => a + Number((per as any)[k]?.done ?? 0), 0) / keys.length;
  return clamp(avgDone, 0, 1);
}

function structuredCompletion01(ci: CompletenessIndexV1): number {
  const done = Number(ci.breakdown?.structured_metadata?.done ?? 0);
  const total = Number(ci.breakdown?.structured_metadata?.total ?? 0) || 1;
  return clamp(done / total, 0, 1);
}

function computeConfidenceModelV1(params: {
  completeness: CompletenessIndexV1;
  uploads: UploadRow[];
  doctorAnswersRaw?: Record<string, unknown> | null;
}): ConfidenceModelV1 {
  const ci = params.completeness;
  const completenessScore = clamp(Number(ci.score ?? 0), 0, 100);
  const requiredPhotosCoverage = requiredPhotoCoverage01(ci);
  const structured01 = structuredCompletion01(ci);

  const photosAll = (params.uploads ?? []).map((u) => ({ type: String(u.type ?? "") }));
  const doctorCounts = buildCountsByKey(photosAll, "doctor");
  const day0RecipientOk = Number(doctorCounts["day0_recipient"] ?? 0) >= (DOCTOR_PHOTO_SCHEMA.find((d) => d.key === "day0_recipient")?.min ?? 1);
  const day0DonorOk = Number(doctorCounts["day0_donor"] ?? 0) >= (DOCTOR_PHOTO_SCHEMA.find((d) => d.key === "day0_donor")?.min ?? 1);
  const missingDay0Recipient = !day0RecipientOk;
  const missingDay0Donor = !day0DonorOk;

  const mapped = params.doctorAnswersRaw ? mapLegacyDoctorAnswers(params.doctorAnswersRaw) : {};
  const answers = (mapped ?? {}) as Record<string, unknown>;
  const missingHoldingSolution = !hasNonEmpty((answers as any).holdingSolution);
  const missingGraftCountImplanted = !hasNonEmpty((answers as any).totalGraftsImplanted);

  const procedureType = String((answers as any).procedureType ?? "");
  const isFue = ["fue_manual", "fue_motorized", "fue_robotic", "combined"].includes(procedureType);
  const isFut = ["fut", "combined"].includes(procedureType);
  const implanterUsed =
    String((answers as any).recipientTool ?? "") === "implanter_pen" ||
    String((answers as any).implantationMethod ?? "") === "implanter";

  const missingFueBlock =
    isFue &&
    (!hasNonEmpty((answers as any).fuePunchType) ||
      !hasNonEmpty((answers as any).fuePunchDiameterRangeMm) ||
      !hasNonEmpty((answers as any).fuePunchMovement) ||
      !hasNonEmpty((answers as any).fueDepthControl));
  const missingFutBlock =
    isFut &&
    (!hasNonEmpty((answers as any).futBladeType) ||
      !hasNonEmpty((answers as any).futClosureTechnique) ||
      !hasNonEmpty((answers as any).futMicroscopicDissectionUsed));
  const missingImplanterBlock = implanterUsed && !hasNonEmpty((answers as any).implanterType);
  const missingTechniqueCriticalBlock = Boolean(missingFueBlock || missingFutBlock || missingImplanterBlock);

  // Evidence grade A–D
  const requiredPhotosComplete90 = requiredPhotosCoverage >= 0.9 && !missingDay0Recipient && !missingDay0Donor;
  let evidenceGrade: "A" | "B" | "C" | "D" = "C";
  if (completenessScore < 65 || missingDay0Recipient || missingDay0Donor) {
    evidenceGrade = "D";
  } else if (completenessScore >= 90 && requiredPhotosComplete90 && structured01 >= 0.9) {
    evidenceGrade = "A";
  } else if (completenessScore >= 80 && requiredPhotosCoverage >= 0.9 && structured01 >= 0.8) {
    evidenceGrade = "B";
  } else {
    evidenceGrade = completenessScore >= 65 ? "C" : "D";
  }

  // Base confidence multiplier by completeness
  let base =
    completenessScore < 65 ? 0.55 :
    completenessScore < 80 ? 0.70 :
    completenessScore < 90 ? 0.85 :
    0.95;

  const penalties: Array<{ id: string; amount: number; reason: string }> = [];
  const addPenalty = (id: string, amount: number, reason: string) => penalties.push({ id, amount, reason });

  if (missingDay0Recipient || missingDay0Donor) addPenalty("missing_day0_evidence", 0.10, "Missing day0_recipient or day0_donor.");
  if (missingHoldingSolution) addPenalty("missing_holdingSolution", 0.05, "Missing holdingSolution.");
  if (missingGraftCountImplanted) addPenalty("missing_graftCountImplanted", 0.05, "Missing graftCountImplanted (totalGraftsImplanted).");
  if (missingTechniqueCriticalBlock) addPenalty("missing_technique_block", 0.08, "Missing technique-critical conditional block (FUE/FUT/implanter).");

  const penaltySum = penalties.reduce((a, p) => a + p.amount, 0);
  const confidenceMultiplier = clamp(Math.round((base - penaltySum) * 1000) / 1000, 0.5, 1.0);

  return {
    version: 1,
    evidence_grade: evidenceGrade,
    confidence_multiplier: confidenceMultiplier,
    base_multiplier: Math.round(base * 1000) / 1000,
    penalties,
    inputs: {
      completeness_score: Math.round(completenessScore * 10) / 10,
      required_photos_coverage: Math.round(requiredPhotosCoverage * 1000) / 1000,
      structured_metadata_completion: Math.round(structured01 * 1000) / 1000,
      missing_day0_recipient: missingDay0Recipient,
      missing_day0_donor: missingDay0Donor,
      missing_holdingSolution: missingHoldingSolution,
      missing_graftCountImplanted: missingGraftCountImplanted,
      missing_technique_critical_block: missingTechniqueCriticalBlock,
    },
  };
}

function domainEvidenceFactorV1(params: {
  domainId: DomainId;
  ci: CompletenessIndexV1;
  uploads: UploadRow[];
  doctorAnswersRaw?: Record<string, unknown> | null;
}): number {
  const photosAll = (params.uploads ?? []).map((u) => ({ type: String(u.type ?? "") }));
  const doctorCounts = buildCountsByKey(photosAll, "doctor");
  const mapped = params.doctorAnswersRaw ? mapLegacyDoctorAnswers(params.doctorAnswersRaw) : {};
  const a = (mapped ?? {}) as Record<string, unknown>;

  const has = (k: string) => hasNonEmpty((a as any)[k]);
  const hasPhoto = (k: string) => Number(doctorCounts[k] ?? 0) >= (DOCTOR_PHOTO_SCHEMA.find((d) => d.key === k)?.min ?? 1);

  const scoreFromFlags = (flags: Array<boolean>) => {
    const total = flags.length || 1;
    const ok = flags.filter(Boolean).length / total;
    return clamp(0.8 + 0.3 * ok, 0.8, 1.1);
  };

  if (params.domainId === "SP") {
    return scoreFromFlags([
      hasPhoto("preop_front"),
      hasPhoto("preop_top"),
      hasPhoto("preop_crown"),
      has("totalGraftsImplanted"),
      has("densePackingAttempted"),
      has("procedureType"),
    ]);
  }

  if (params.domainId === "DP") {
    const procedureType = String((a as any).procedureType ?? "");
    const isFue = ["fue_manual", "fue_motorized", "fue_robotic", "combined"].includes(procedureType);
    const isFut = ["fut", "combined"].includes(procedureType);
    const techniqueBlockOk = isFue
      ? has("fuePunchType") && has("fuePunchDiameterRangeMm") && has("fuePunchMovement") && has("fueDepthControl")
      : isFut
        ? has("futBladeType") && has("futClosureTechnique") && has("futMicroscopicDissectionUsed")
        : has("procedureType");
    return scoreFromFlags([
      hasPhoto("preop_donor_rear"),
      hasPhoto("day0_donor"),
      has("donorMappingMethod"),
      has("percentExtractionPerZoneControlled"),
      techniqueBlockOk,
    ]);
  }

  if (params.domainId === "GV") {
    return scoreFromFlags([
      has("holdingSolution"),
      has("temperatureControlled"),
      has("outOfBodyTimeLogged"),
      has("avgOutOfBodyTimeHours"),
      has("microscopeStationsUsed"),
    ]);
  }

  if (params.domainId === "IC") {
    const intraopPresent = Number(doctorCounts["intraop"] ?? 0) > 0;
    const implanterUsed =
      String((a as any).recipientTool ?? "") === "implanter_pen" ||
      String((a as any).implantationMethod ?? "") === "implanter";
    return scoreFromFlags([
      hasPhoto("day0_recipient"),
      intraopPresent,
      has("implantationMethod"),
      has("recipientTool"),
      !implanterUsed || has("implanterType"),
    ]);
  }

  return clamp(0.8 + 0.3 * clamp(Number(params.ci.score ?? 0) / 100, 0, 1), 0.8, 1.1);
}

function requiredPhotoSetComplete(uploads: UploadRow[]): boolean {
  const photosAll = (uploads ?? []).map((u) => ({ type: String(u.type ?? "") }));
  const counts = buildCountsByKey(photosAll, "doctor");
  const requiredDefs = DOCTOR_PHOTO_SCHEMA.filter((d) => d.required);
  return requiredDefs.every((def) => Number(counts[def.key] ?? 0) >= (def.min ?? 1));
}

function intraopPresent(uploads: UploadRow[]): boolean {
  const photosAll = (uploads ?? []).map((u) => ({ type: String(u.type ?? "") }));
  const counts = buildCountsByKey(photosAll, "doctor");
  return Number(counts["intraop"] ?? 0) > 0;
}

function postopDay0to3Present(uploads: UploadRow[]): boolean {
  const photosAll = (uploads ?? []).map((u) => ({ type: String(u.type ?? "") }));
  const counts = buildCountsByKey(photosAll, "doctor");
  return Number(counts["postop_day0_3"] ?? 0) > 0;
}

function computeTiersV1(params: {
  completenessScore: number;
  benchmarkEligible: boolean;
  confidenceGrade: "A" | "B" | "C" | "D";
  uploads: UploadRow[];
}): TierV1[] {
  const cs = clamp(params.completenessScore, 0, 100);
  const tiers: TierV1[] = [];

  const t1 = cs >= 60;
  tiers.push({
    tier_id: "tier1_standard",
    title: "Standard Audit",
    eligible: t1,
    reasons: t1 ? ["Completeness ≥ 60."] : ["Completeness < 60."],
  });

  const t2 = cs >= 85 && params.benchmarkEligible;
  tiers.push({
    tier_id: "tier2_certified",
    title: "Certified Submission",
    eligible: t2,
    reasons: t2
      ? ["Completeness ≥ 85 and benchmark eligible."]
      : ["Requires completeness ≥ 85 and benchmark eligibility."],
  });

  const award = cs >= 92 && params.confidenceGrade === "A" && intraopPresent(params.uploads) && postopDay0to3Present(params.uploads);
  tiers.push({
    tier_id: "tier3_award",
    title: "Award Eligibility",
    eligible: award,
    reasons: award
      ? ["Completeness ≥ 92, grade A, intraop present, and follow-up evidence present (postop_day0_3 placeholder)."]
      : ["Requires completeness ≥ 92, grade A, intraop, and follow-up evidence (postop_day0_3)."],
  });

  return tiers;
}

function estimateImpactEffort(action: string): { impact: "high" | "med" | "low"; effort: "high" | "med" | "low" } {
  const s = action.toLowerCase();
  if (s.includes("complete the required doctor photo set") || s.includes("complete your information") || s.includes("complete missing required fields")) {
    return { impact: "high", effort: "med" };
  }
  if (s.includes("document") || s.includes("logging") || s.includes("protocol")) {
    return { impact: "high", effort: "low" };
  }
  if (s.includes("intra-op") || s.includes("close-ups") || s.includes("day-of")) {
    return { impact: "med", effort: "med" };
  }
  if (s.includes("attach planning") || s.includes("planning documentation")) {
    return { impact: "med", effort: "med" };
  }
  return { impact: "med", effort: "low" };
}

function protocolOpportunitiesForDomain(domainId: DomainId): Array<{
  name: string;
  indication: string;
  expected_benefit_domain: DomainId;
  documentation_required: string[];
}> {
  if (domainId === "GV") {
    return [
      {
        name: "Hypothermic holding solution protocol (e.g., HypoThermosol/ATP-enhanced)",
        indication: "When graft out-of-body time is non-trivial or multi-batch implantation workflow is used.",
        expected_benefit_domain: "GV",
        documentation_required: ["doctor_answers:holdingSolution", "doctor_answers:temperatureControlled", "doctor_answers:outOfBodyTimeLogged"],
      },
      {
        name: "Out-of-body time (OBT) logging + hydration workflow standardization",
        indication: "When OBT is estimated or not recorded; especially in large sessions.",
        expected_benefit_domain: "GV",
        documentation_required: ["doctor_answers:outOfBodyTimeLogged", "doctor_answers:avgOutOfBodyTimeHours"],
      },
    ];
  }
  if (domainId === "DP") {
    return [
      {
        name: "Safe-zone mapping + density-mapped grid planning",
        indication: "When donor limitations or long-term preservation risk is a concern.",
        expected_benefit_domain: "DP",
        documentation_required: ["doctor_answers:donorMappingMethod", "doctor_answers:percentExtractionPerZoneControlled", "doctor_photo:preop_donor_rear"],
      },
      {
        name: "Punch parameter standardization (diameter/movement/depth control)",
        indication: "For FUE cases to reduce transection/scarring risk indicators.",
        expected_benefit_domain: "DP",
        documentation_required: ["doctor_answers:fuePunchDiameterRangeMm", "doctor_answers:fuePunchMovement", "doctor_answers:fueDepthControl"],
      },
    ];
  }
  if (domainId === "IC") {
    return [
      {
        name: "Implantation workflow standardization (implanter vs forceps) + team role clarity",
        indication: "When implantation is mixed-role or technique varies within the case.",
        expected_benefit_domain: "IC",
        documentation_required: ["doctor_answers:implantationMethod", "doctor_answers:implantationPerformedBy", "doctor_photo:day0_recipient"],
      },
      {
        name: "Angle/direction QA checklist for recipient placement",
        indication: "When intra-op or day0 photos are available and directional consistency is assessable.",
        expected_benefit_domain: "IC",
        documentation_required: ["doctor_photo:intraop", "doctor_photo:day0_recipient"],
      },
    ];
  }
  if (domainId === "SP") {
    return [
      {
        name: "Zone-based density targets + graft distribution plan template",
        indication: "When planning artifacts are not attached or density targets are not explicit.",
        expected_benefit_domain: "SP",
        documentation_required: ["doctor_answers:totalGraftsImplanted", "doctor_photo:preop_front", "doctor_photo:preop_top"],
      },
    ];
  }
  return [
    {
      name: "Documentation integrity checklist (pre-op, day0, protocols, verification)",
      indication: "When aiming for benchmarking/certification tiers.",
      expected_benefit_domain: "DI",
      documentation_required: ["doctor_photo:required_set", "doctor_answers:required_fields", "doctor_answers:graftCountDoubleVerified"],
    },
  ];
}

function suggestedModulesForDomain(domainId: DomainId): Array<{ module_id: string; title: string; reason: string; linked_domain: DomainId }> {
  if (domainId === "GV") {
    return [
      { module_id: "MOD_GV_001", title: "Viability Chain: OBT + Hydration Controls", reason: "Improves documentation and control of holding/hydration/temperature workflow.", linked_domain: "GV" },
      { module_id: "MOD_GV_002", title: "Storage Solutions: Selection + Evidence", reason: "Standardizes holdingSolution selection and how it is documented as evidence.", linked_domain: "GV" },
    ];
  }
  if (domainId === "DP") {
    return [
      { module_id: "MOD_DP_001", title: "Donor Preservation: Safe Zone + Distribution Planning", reason: "Targets donor mapping and extraction distribution evidence quality.", linked_domain: "DP" },
      { module_id: "MOD_DP_002", title: "FUE Parameters: Punch, Movement, Depth Control", reason: "Improves technique-critical metadata completeness and risk control documentation.", linked_domain: "DP" },
    ];
  }
  if (domainId === "IC") {
    return [
      { module_id: "MOD_IC_001", title: "Recipient Site Planning + Placement Consistency", reason: "Improves day0/intraop evidence capture and implantation method documentation.", linked_domain: "IC" },
      { module_id: "MOD_IC_002", title: "Implanter Workflow: Setup + Evidence", reason: "Ensures implanterType evidence and placement workflow are consistently recorded.", linked_domain: "IC" },
    ];
  }
  if (domainId === "SP") {
    return [
      { module_id: "MOD_SP_001", title: "Hairline & Zone Plan Documentation", reason: "Standardizes planning artifacts and density/graft distribution documentation.", linked_domain: "SP" },
    ];
  }
  return [
    { module_id: "MOD_DI_001", title: "Audit Defensibility: Documentation Checklist", reason: "Improves completeness index and benchmarking readiness.", linked_domain: "DI" },
  ];
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function hasNonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true;
  if (typeof v === "object") return Object.keys(v as any).length > 0;
  return false;
}

function computeCompletenessIndexDoctorV1(params: {
  uploads: UploadRow[];
  doctorAnswersRaw?: Record<string, unknown> | null;
}): CompletenessIndexV1 {
  const uploads = params.uploads ?? [];
  const photosAll = uploads.map((u) => ({ type: String(u.type ?? "") }));
  const doctorCounts = buildCountsByKey(photosAll, "doctor");

  // 2.1 Photo coverage (0–45) based on DOCTOR_PHOTO_SCHEMA required categories
  const requiredDefs = DOCTOR_PHOTO_SCHEMA.filter((d) => d.required);
  const perCategory: Record<string, { uploaded: number; min: number; done: number }> = {};
  const doneValues: number[] = [];
  for (const def of requiredDefs) {
    const uploaded = Number(doctorCounts[def.key] ?? 0);
    const min = Math.max(1, Number(def.min ?? 1));
    const done = Math.max(0, Math.min(1, uploaded >= min ? 1 : uploaded / min));
    perCategory[def.key] = { uploaded, min, done: Math.round(done * 1000) / 1000 };
    doneValues.push(done);
  }
  const avgDone = doneValues.length ? doneValues.reduce((a, b) => a + b, 0) / doneValues.length : 0;
  const photoBase = 45 * avgDone;
  const intraopPresent = Number(doctorCounts["intraop"] ?? 0) > 0;
  const postopPresent = Number(doctorCounts["postop_day0_3"] ?? 0) > 0;
  const photoBonus = (intraopPresent ? 2 : 0) + (postopPresent ? 1 : 0); // future follow-up bonus reserved for later
  const photoScore = Math.max(0, Math.min(45, Math.round((photoBase + photoBonus) * 10) / 10));

  // Parse doctor answers (mapped for backward compat)
  const doctorAnswersMapped = params.doctorAnswersRaw ? mapLegacyDoctorAnswers(params.doctorAnswersRaw) : {};
  const answers = (doctorAnswersMapped ?? {}) as Record<string, unknown>;

  const procedureType = String((answers as any).procedureType ?? "");
  const isFue = ["fue_manual", "fue_motorized", "fue_robotic", "combined"].includes(procedureType);
  const isFut = ["fut", "combined"].includes(procedureType);
  const implanterUsed =
    String((answers as any).recipientTool ?? "") === "implanter_pen" ||
    String((answers as any).implantationMethod ?? "") === "implanter";

  // 2.2 Structured metadata (0–35)
  // We align requested conceptual keys to existing doctor form fields where possible.
  const requiredKeys: string[] = [
    "procedureType", // extractionMethod proxy
    "implantationMethod",
    "holdingSolution",
    "totalGraftsExtracted", // graftCountPlanned proxy
    "totalGraftsImplanted",
    // teamComposition proxy (roles/equipment coverage)
    "extractionPerformedBy",
    "implantationPerformedBy",
    "microscopeStationsUsed",
    // densityTargets proxy (best-effort until explicit densityTargets exists)
    "densePackingAttempted",
    // incision timing (future): accept either numeric minutes or a stick-and-place flag if present
    "incisionToImplantMinutes",
    "stickAndPlace",
  ];

  if (isFue) requiredKeys.push("fuePunchType", "fuePunchDiameterRangeMm", "fuePunchMovement", "fueDepthControl");
  if (isFut) requiredKeys.push("futBladeType", "futClosureTechnique", "futMicroscopicDissectionUsed");
  if (implanterUsed) requiredKeys.push("implanterType");

  // Treat incision timing as a single requirement: either of the two keys counts.
  const structuredGroups: Array<{ id: string; keys: string[]; anyOf?: boolean }> = [
    { id: "procedureType", keys: ["procedureType"] },
    { id: "implantationMethod", keys: ["implantationMethod"] },
    { id: "holdingSolution", keys: ["holdingSolution"] },
    { id: "totalGraftsExtracted", keys: ["totalGraftsExtracted"] },
    { id: "totalGraftsImplanted", keys: ["totalGraftsImplanted"] },
    { id: "extractionPerformedBy", keys: ["extractionPerformedBy"] },
    { id: "implantationPerformedBy", keys: ["implantationPerformedBy"] },
    { id: "microscopeStationsUsed", keys: ["microscopeStationsUsed"] },
    { id: "densePackingAttempted", keys: ["densePackingAttempted"] },
    { id: "incisionTiming", keys: ["incisionToImplantMinutes", "stickAndPlace"], anyOf: true },
  ];
  if (isFue) {
    structuredGroups.push(
      { id: "fuePunchType", keys: ["fuePunchType"] },
      { id: "fuePunchDiameterRangeMm", keys: ["fuePunchDiameterRangeMm"] },
      { id: "fuePunchMovement", keys: ["fuePunchMovement"] },
      { id: "fueDepthControl", keys: ["fueDepthControl"] }
    );
  }
  if (isFut) {
    structuredGroups.push(
      { id: "futBladeType", keys: ["futBladeType"] },
      { id: "futClosureTechnique", keys: ["futClosureTechnique"] },
      { id: "futMicroscopicDissectionUsed", keys: ["futMicroscopicDissectionUsed"] }
    );
  }
  if (implanterUsed) structuredGroups.push({ id: "implanterType", keys: ["implanterType"] });

  let structuredDone = 0;
  const structuredMissing: string[] = [];
  for (const g of structuredGroups) {
    const ok = g.anyOf
      ? g.keys.some((k) => hasNonEmpty((answers as any)[k]))
      : g.keys.every((k) => hasNonEmpty((answers as any)[k]));
    if (ok) structuredDone += 1;
    else structuredMissing.push(g.id);
  }
  const structuredTotal = structuredGroups.length || 1;
  const structuredScore = Math.round((35 * (structuredDone / structuredTotal)) * 10) / 10;

  // 2.3 Numeric precision (0–10)
  const numericExpected: Array<{ id: string; keys: string[]; anyOf?: boolean }> = [
    { id: "yearsPerformingHairTransplants", keys: ["yearsPerformingHairTransplants"] },
    { id: "totalGraftsExtracted", keys: ["totalGraftsExtracted"] },
    { id: "totalGraftsImplanted", keys: ["totalGraftsImplanted"] },
    { id: "totalProcedureCostUsd", keys: ["totalProcedureCostUsd"] },
    // Optional numeric fields still contribute if present (precision)
    { id: "preOpDensityFuPerCm2", keys: ["preOpDensityFuPerCm2"] },
    { id: "avgOutOfBodyTimeHours", keys: ["avgOutOfBodyTimeHours"] },
    { id: "fueDocumentedTransectionRatePercent", keys: ["fueDocumentedTransectionRatePercent"] },
    { id: "estimatedGraftSurvivalPercent", keys: ["estimatedGraftSurvivalPercent"] },
    // Future-oriented: accept minutes if added later
    { id: "incisionToImplantMinutes", keys: ["incisionToImplantMinutes"] },
    { id: "outOfBodyTimeAvgMinutes", keys: ["outOfBodyTimeAvgMinutes"] },
    { id: "densityTargetFUcm2", keys: ["densityTargetFUcm2"] },
  ];

  let numericDone = 0;
  const numericMissing: string[] = [];
  for (const g of numericExpected) {
    const ok = g.anyOf
      ? g.keys.some((k) => toNumberOrNull((answers as any)[k]) !== null)
      : g.keys.every((k) => toNumberOrNull((answers as any)[k]) !== null);
    if (ok) numericDone += 1;
    else numericMissing.push(g.id);
  }
  const numericTotal = numericExpected.length || 1;
  const numericScore = Math.round((10 * (numericDone / numericTotal)) * 10) / 10;

  // 2.4 Verification evidence (0–10)
  const graftCountVerified = String((answers as any).graftCountDoubleVerified ?? "").toLowerCase() === "yes";
  const p_graft = graftCountVerified ? 6 : 0;
  const p_intra = intraopPresent ? 2 : 0;
  const day0DonorOk = Number(doctorCounts["day0_donor"] ?? 0) >= (DOCTOR_PHOTO_SCHEMA.find((d) => d.key === "day0_donor")?.min ?? 1);
  const day0RecipientOk = Number(doctorCounts["day0_recipient"] ?? 0) >= (DOCTOR_PHOTO_SCHEMA.find((d) => d.key === "day0_recipient")?.min ?? 1);
  const p_day0 = day0DonorOk && day0RecipientOk ? 2 : 0;
  const verificationScore = Math.min(10, p_graft + p_intra + p_day0);

  const total = Math.max(0, Math.min(100, Math.round((photoScore + structuredScore + numericScore + verificationScore) * 10) / 10));

  return {
    version: 1,
    score: total,
    weights: { photos: 45, structured_metadata: 35, numeric_precision: 10, verification_evidence: 10 },
    breakdown: {
      photo_coverage: {
        score: photoScore,
        base: Math.round(photoBase * 10) / 10,
        bonus: photoBonus,
        per_category: perCategory,
      },
      structured_metadata: {
        score: structuredScore,
        done: structuredDone,
        total: structuredTotal,
        missing_keys: structuredMissing.slice(0, 20),
      },
      numeric_precision: {
        score: numericScore,
        done: numericDone,
        total: numericTotal,
        missing_keys: numericMissing.slice(0, 30),
      },
      verification_evidence: {
        score: verificationScore,
        points: {
          graft_count_verified: p_graft,
          intraop_present: p_intra,
          day0_donor_recipient_present: p_day0,
        },
      },
    },
  };
}

function computeCompletenessIndex(params: {
  uploads: UploadRow[];
  doctorAnswersComplete: boolean;
  missingInputs?: string[];
  missingPhotos?: string[];
}): { completeness01: number; limiters: string[]; evidenceNeeded: string[] } {
  const limiters: string[] = [];
  const evidenceNeeded: string[] = [];

  const photos = (params.uploads ?? []).map((u) => ({ type: String(u.type ?? "") }));
  const patientPhotos = photos.filter((p) => String(p.type).startsWith("patient_photo:"));
  const doctorPhotos = photos.filter((p) => String(p.type).startsWith("doctor_photo:"));

  const patientCounts = buildCountsByKey(patientPhotos, "patient");
  const doctorCounts = buildCountsByKey(doctorPhotos, "doctor");

  const missingPatient = PATIENT_REQUIRED_KEYS.filter((k) => (patientCounts[k] ?? 0) < 1);
  const missingDoctor = DOCTOR_REQUIRED_KEYS.filter((k) => (doctorCounts[k] ?? 0) < 1);

  if (missingPatient.length) {
    limiters.push(`Patient photo set incomplete (${missingPatient.length} required missing).`);
    evidenceNeeded.push(...missingPatient.map((k) => `patient_photo:${k}`));
  }
  if (missingDoctor.length) {
    limiters.push(`Doctor photo set incomplete (${missingDoctor.length} required missing).`);
    evidenceNeeded.push(...missingDoctor.map((k) => `doctor_photo:${k}`));
  }
  if (!params.doctorAnswersComplete) {
    limiters.push("Doctor documentation incomplete (answers missing required fields).");
    evidenceNeeded.push("Complete doctor audit form (required fields)");
  }

  const missingInputs = (params.missingInputs ?? []).filter(Boolean);
  const missingPhotos = (params.missingPhotos ?? []).filter(Boolean);
  if (missingInputs.length) limiters.push(`AI inputs missing: ${missingInputs.slice(0, 4).join(", ")}.`);
  if (missingPhotos.length) limiters.push(`AI photo limitations: ${missingPhotos.slice(0, 4).join(", ")}.`);

  // Simple completeness index: photos (50%) + doctor answers (30%) + AI missing signals (20%).
  const patientReq = PATIENT_REQUIRED_KEYS.length || 1;
  const doctorReq = DOCTOR_REQUIRED_KEYS.length || 1;
  const patientHave = patientReq - missingPatient.length;
  const doctorHave = doctorReq - missingDoctor.length;
  const photoFactor = 0.5 * (patientHave / patientReq) + 0.5 * (doctorHave / doctorReq);
  const answerFactor = params.doctorAnswersComplete ? 1 : 0.4;
  const aiFactor = missingInputs.length + missingPhotos.length === 0 ? 1 : Math.max(0.4, 1 - 0.15 * (missingInputs.length + missingPhotos.length));

  const completeness01 = clamp01(0.5 * photoFactor + 0.3 * answerFactor + 0.2 * aiFactor);
  return { completeness01, limiters: uniq(limiters).slice(0, 8), evidenceNeeded: uniq(evidenceNeeded).slice(0, 12) };
}

function uniq(xs: string[]) {
  return Array.from(new Set(xs.map((x) => String(x).trim()).filter(Boolean)));
}

function domainTitle(id: DomainId): string {
  return id === "SP"
    ? "Surgical Planning & Design"
    : id === "DP"
      ? "Donor Preservation & Extraction Quality"
      : id === "GV"
        ? "Graft Handling & Viability Chain"
        : id === "IC"
          ? "Implantation Consistency & Technique"
          : "Documentation Integrity & Audit Defensibility";
}

function sectionScore(ai: ForensicAuditLike, key: string): number | null {
  const v = ai?.section_scores?.[key];
  const n = Number(v);
  return Number.isFinite(n) ? clampScore(n) : null;
}

function computeDomainRawScores(ai: ForensicAuditLike): Record<DomainId, number> {
  const s = (k: string) => sectionScore(ai, k);

  const sp = avg([s("hairline_design") ?? NaN, s("density_distribution") ?? NaN]);
  const dp = avg([s("donor_management") ?? NaN, s("extraction_quality") ?? NaN]);
  const gv = s("graft_handling_and_viability");
  const ic = avg([s("recipient_placement") ?? NaN, s("naturalness_and_aesthetics") ?? NaN]);

  // DI is documentation-focused: default neutral 60, then adjust with AI data_quality signals (missing lowers).
  const missingInputs = (ai?.data_quality?.missing_inputs ?? []).length;
  const missingPhotos = (ai?.data_quality?.missing_photos ?? []).length;
  const limitations = (ai?.data_quality?.limitations ?? []).length;
  const diBase = 75;
  const diPenalty = 6 * missingInputs + 8 * missingPhotos + 1.5 * limitations;
  const di = clampScore(diBase - diPenalty);

  return {
    SP: clampScore(sp ?? 60),
    DP: clampScore(dp ?? 60),
    GV: clampScore(gv ?? 60),
    IC: clampScore(ic ?? 60),
    DI: clampScore(di),
  };
}

function improvementTemplates(params: {
  domainId: DomainId;
  missingDoctorKeys: string[];
  missingPatientKeys: string[];
  doctorAnswersIssues: string[];
  viewCoverageFactor: number;
}): Array<{ priority: 1 | 2 | 3 | 4 | 5; action: string; why: string; evidence_needed: string[] }> {
  const out: Array<{ priority: 1 | 2 | 3 | 4 | 5; action: string; why: string; evidence_needed: string[] }> = [];
  const { domainId } = params;

  const add = (x: (typeof out)[number]) => out.push(x);

  if (params.missingDoctorKeys.length) {
    add({
      priority: 1,
      action: "Complete the required doctor photo set for standardized benchmarking.",
      why: "Based on submitted documentation, missing standardized views reduces audit defensibility and confidence gating for benchmarking.",
      evidence_needed: params.missingDoctorKeys.slice(0, 6).map((k) => `doctor_photo:${k}`),
    });
  }
  if (params.doctorAnswersIssues.length) {
    add({
      priority: params.missingDoctorKeys.length ? 2 : 1,
      action: "Complete missing required fields in the doctor audit form (procedure + handling details).",
      why: "Based on submitted documentation, absent protocol fields prevent evidence-weighted scoring of technique and viability-chain controls.",
      evidence_needed: ["doctor_answers:required_fields"],
    });
  }
  if (params.viewCoverageFactor < 0.85) {
    add({
      priority: 3,
      action: "Add clearer close-ups for day-of donor/recipient to improve view classification and technique evidence.",
      why: "Based on submitted documentation, unclear/unknown views limit angle/direction and extraction-pattern assessment.",
      evidence_needed: ["doctor_photo:day0_donor", "doctor_photo:day0_recipient"],
    });
  }

  if (domainId === "GV") {
    add({
      priority: 2,
      action: "Document graft holding solution, temperature control, and out-of-body time logging explicitly for this case.",
      why: "Based on submitted documentation, viability-chain controls are answers-driven; missing specifics reduce confidence and audit defensibility.",
      evidence_needed: ["doctor_answers:holdingSolution", "doctor_answers:temperatureControlled", "doctor_answers:outOfBodyTimeLogged"],
    });
  }

  if (domainId === "DP") {
    add({
      priority: 2,
      action: "Include donor marking evidence and extraction-pattern documentation (safe-zone mapping + distribution).",
      why: "Based on submitted documentation, donor preservation scoring depends on clear planning evidence and donor-area views.",
      evidence_needed: ["doctor_answers:donorMappingMethod", "doctor_answers:percentExtractionPerZoneControlled", "doctor_photo:preop_donor_rear"],
    });
  }

  if (domainId === "SP") {
    add({
      priority: 2,
      action: "Attach planning documentation: density targets by zone, recipient plan/zones, and graft distribution plan.",
      why: "Based on submitted documentation, planning/design scoring is evidence-weighted and cannot be inferred reliably without explicit planning artifacts.",
      evidence_needed: ["doctor_answers:totalGraftsImplanted", "doctor_photo:preop_front", "doctor_photo:preop_top"],
    });
  }

  if (domainId === "IC") {
    add({
      priority: 2,
      action: "Provide intra-op/day0 recipient close-ups showing placement pattern and directionality evidence where available.",
      why: "Based on submitted documentation, implantation consistency requires visual evidence for spacing and directional alignment.",
      evidence_needed: ["doctor_photo:day0_recipient", "doctor_photo:intraop"],
    });
  }

  if (domainId === "DI") {
    add({
      priority: 1,
      action: "Ensure the case has a complete photo set and a completed doctor form before submission for benchmarking.",
      why: "Benchmarking requires high audit defensibility; incomplete documentation is confidence-gated out of rankings.",
      evidence_needed: ["doctor_photo:required_set", "doctor_answers:required_fields"],
    });
  }

  return out.slice(0, 6);
}

export function computeDomainScoresV1(params: {
  ai: ForensicAuditLike;
  uploads: UploadRow[];
  caseRow?: {
    evidence_score_doctor?: EvidenceScore | null;
    evidence_score_patient?: EvidenceScore | null;
    doctor_id?: string | null;
    clinic_id?: string | null;
  } | null;
  doctorAnswersRaw?: Record<string, unknown> | null;
}): {
  domains: DomainScoreV1[];
  benchmark: BenchmarkEligibility;
  completeness_index_v1: CompletenessIndexV1;
  confidence_model_v1: ConfidenceModelV1;
  overall_scores_v1: OverallScoresV1;
  tiers_v1: TierV1[];
} {

  const doctorPhotos = (params.uploads ?? []).filter((u) => String(u.type ?? "").startsWith("doctor_photo:")).map((u) => ({ type: String(u.type ?? "") }));
  const patientPhotos = (params.uploads ?? []).filter((u) => String(u.type ?? "").startsWith("patient_photo:")).map((u) => ({ type: String(u.type ?? "") }));

  const doctorGrade =
    params.caseRow?.evidence_score_doctor ?? (doctorPhotos.length ? computeEvidenceScore("doctor", doctorPhotos) : null);
  const patientGrade =
    params.caseRow?.evidence_score_patient ?? (patientPhotos.length ? computeEvidenceScore("patient", patientPhotos) : null);

  const { complete: doctorAnswersComplete, issues: doctorIssues } = doctorAnswersCompleteness(params.doctorAnswersRaw);

  const photoObs = params.ai?.photo_observations;
  const viewFactor = viewCoverageFactor(photoObs);

  const rawScores = computeDomainRawScores(params.ai);

  const photosAll = (params.uploads ?? []).map((u) => ({ type: String(u.type ?? "") }));
  const doctorCounts = buildCountsByKey(photosAll, "doctor");
  const patientCounts = buildCountsByKey(photosAll, "patient");
  const missingDoctorKeys = DOCTOR_REQUIRED_KEYS.filter((k) => (doctorCounts[k] ?? 0) < 1);
  const missingPatientKeys = PATIENT_REQUIRED_KEYS.filter((k) => (patientCounts[k] ?? 0) < 1);

  const sectionEvidence = params.ai?.section_score_evidence ?? {};
  const evidenceFor = (k: string) => bestEvidenceSnippets({ evidence: sectionEvidence[k], max: 2 });

  const missingInputs = params.ai?.data_quality?.missing_inputs ?? [];
  const missingPhotos = params.ai?.data_quality?.missing_photos ?? [];

  const completeness = computeCompletenessIndex({
    uploads: params.uploads ?? [],
    doctorAnswersComplete,
    missingInputs,
    missingPhotos,
  });

  const completenessIndexV1 = computeCompletenessIndexDoctorV1({
    uploads: params.uploads ?? [],
    doctorAnswersRaw: params.doctorAnswersRaw ?? null,
  });

  const confidenceModelV1 = computeConfidenceModelV1({
    completeness: completenessIndexV1,
    uploads: params.uploads ?? [],
    doctorAnswersRaw: params.doctorAnswersRaw ?? null,
  });

  const domains: DomainScoreV1[] = (["SP", "DP", "GV", "IC", "DI"] as DomainId[]).map((id) => {
    const prefer: "doctor" | "patient" | "either" =
      id === "GV" || id === "DI" ? "either" : "doctor";

    const evidence_grade =
      id === "DI"
        ? pickEvidenceGrade({ doctorGrade, patientGrade, prefer: "either" })
        : pickEvidenceGrade({ doctorGrade, patientGrade, prefer });

    const overallConfidence = clamp(confidenceModelV1.confidence_multiplier, 0.5, 1.0);
    const domainFactor = domainEvidenceFactorV1({
      domainId: id,
      ci: completenessIndexV1,
      uploads: params.uploads ?? [],
      doctorAnswersRaw: params.doctorAnswersRaw ?? null,
    });
    const confidence = clamp01(clamp(overallConfidence * domainFactor, 0.5, 1.0));

    const raw_score =
      id === "DI"
        ? clampScore(completenessIndexV1.score)
        : rawScores[id];

    const weighted_score = Math.round(raw_score * confidence);

    const drivers: string[] = (() => {
      if (id === "SP") return uniq([...evidenceFor("hairline_design"), ...evidenceFor("density_distribution")]).slice(0, 4);
      if (id === "DP") return uniq([...evidenceFor("donor_management"), ...evidenceFor("extraction_quality")]).slice(0, 4);
      if (id === "GV") return uniq([...evidenceFor("graft_handling_and_viability")]).slice(0, 3);
      if (id === "IC") return uniq([...evidenceFor("recipient_placement"), ...evidenceFor("naturalness_and_aesthetics")]).slice(0, 4);
      return uniq([
        ...(doctorAnswersComplete ? ["Doctor answers: required fields completed."] : []),
        ...(missingDoctorKeys.length === 0 ? ["Doctor photo set: required views present."] : []),
        ...(missingPatientKeys.length === 0 ? ["Patient photo set: required views present."] : []),
      ]).slice(0, 4);
    })();

    const limiters: string[] = uniq([
      ...(id !== "DI" ? completeness.limiters : []),
      ...(id === "DI" ? completeness.limiters : []),
      ...(doctorIssues.length && (id === "GV" || id === "DI") ? doctorIssues.slice(0, 3) : []),
    ]).slice(0, 8);

    const improvement_plan = improvementTemplates({
      domainId: id,
      missingDoctorKeys,
      missingPatientKeys,
      doctorAnswersIssues: doctorIssues,
      viewCoverageFactor: viewFactor,
    });

    const top_drivers = (drivers.length ? drivers : []).slice(0, 3);
    const top_limiters = (limiters.length ? limiters : []).slice(0, 3);
    const priority_actions = improvement_plan.slice(0, 5).map((p, idx) => {
      const ie = estimateImpactEffort(p.action);
      return {
        order: (idx + 1) as number,
        action: p.action,
        impact: ie.impact,
        effort: ie.effort,
        evidence_needed: Array.isArray(p.evidence_needed) ? p.evidence_needed : [],
      };
    });

    return {
      domain_id: id,
      title: domainTitle(id),
      raw_score,
      confidence: Math.round(confidence * 1000) / 1000,
      evidence_grade,
      weighted_score,
      drivers: drivers.length ? drivers : ["Based on submitted documentation, there is insufficient evidence to identify strong drivers for this domain."],
      limiters: limiters.length ? limiters : ["Based on submitted documentation, no major limiters were detected for this domain."],
      improvement_plan,
      top_drivers,
      top_limiters,
      priority_actions,
      protocol_opportunities: protocolOpportunitiesForDomain(id),
      suggested_modules: suggestedModulesForDomain(id),
    };
  });

  const benchmark = computeBenchmarkEligibility({
    completeness: completenessIndexV1,
    confidenceModel: confidenceModelV1,
    uploads: params.uploads ?? [],
    doctorAnswersRaw: params.doctorAnswersRaw ?? null,
    doctorId: params.caseRow?.doctor_id ?? null,
    clinicId: params.caseRow?.clinic_id ?? null,
  });

  const weights = { SP: 15, DP: 25, GV: 20, IC: 25, DI: 15 } as const;
  const byId = new Map(domains.map((d) => [d.domain_id, d]));
  const overallRaw =
    (Number(byId.get("SP")?.raw_score ?? 0) * weights.SP +
      Number(byId.get("DP")?.raw_score ?? 0) * weights.DP +
      Number(byId.get("GV")?.raw_score ?? 0) * weights.GV +
      Number(byId.get("IC")?.raw_score ?? 0) * weights.IC +
      Number(byId.get("DI")?.raw_score ?? 0) * weights.DI) / 100;

  const performanceScore = Math.round(clamp(overallRaw, 0, 100) * 10) / 10;
  const benchmarkScore = Math.round(clamp(performanceScore * confidenceModelV1.confidence_multiplier, 0, 100) * 10) / 10;

  const overallScoresV1: OverallScoresV1 = {
    version: 1,
    domain_weights: weights,
    performance_score: performanceScore,
    confidence_grade: confidenceModelV1.evidence_grade,
    confidence_multiplier: confidenceModelV1.confidence_multiplier,
    benchmark_score: benchmarkScore,
  };

  return {
    domains,
    benchmark,
    completeness_index_v1: completenessIndexV1,
    confidence_model_v1: confidenceModelV1,
    overall_scores_v1: overallScoresV1,
    tiers_v1: computeTiersV1({
      completenessScore: completenessIndexV1.score,
      benchmarkEligible: benchmark.eligible,
      confidenceGrade: confidenceModelV1.evidence_grade,
      uploads: params.uploads ?? [],
    }),
  };
}

export function computeBenchmarkEligibility(params: {
  completeness: CompletenessIndexV1;
  confidenceModel: ConfidenceModelV1;
  uploads: UploadRow[];
  doctorAnswersRaw?: Record<string, unknown> | null;
  doctorId: string | null;
  clinicId: string | null;
}): BenchmarkEligibility {
  const reasons: string[] = [];
  const completeness = clamp(Number(params.completeness?.score ?? 0), 0, 100);
  const grade = params.confidenceModel?.evidence_grade ?? "D";
  const requiredComplete = requiredPhotoSetComplete(params.uploads ?? []);

  const mapped = params.doctorAnswersRaw ? mapLegacyDoctorAnswers(params.doctorAnswersRaw) : {};
  const answers = (mapped ?? {}) as Record<string, unknown>;
  const graftCountImplantedPresent = hasNonEmpty((answers as any).totalGraftsImplanted);

  const hasEntity = Boolean(params.doctorId || params.clinicId);
  if (!hasEntity) reasons.push("No doctor_id/clinic_id set on case; cannot attribute benchmarking.");

  if (completeness < 85) reasons.push("Completeness < 85 (confidence-gated).");
  if (!(grade === "A" || grade === "B")) reasons.push("Evidence grade must be A or B.");
  if (!requiredComplete) reasons.push("Required doctor photo set not complete (all required categories must meet min).");
  if (!graftCountImplantedPresent) reasons.push("Missing graftCountImplanted (totalGraftsImplanted).");

  const eligible = hasEntity && completeness >= 85 && (grade === "A" || grade === "B") && requiredComplete && graftCountImplantedPresent;
  if (eligible) reasons.push("Eligible: meets confidence and documentation gates.");

  return {
    eligible,
    gate_version: "balanced_v1",
    reasons: reasons.slice(0, 8),
    overall_confidence: Math.round(clamp(Number(params.confidenceModel?.confidence_multiplier ?? 0.5), 0.5, 1.0) * 1000) / 1000,
    confidence_grade: grade,
    doctor_evidence_grade: null,
    doctor_answers_complete: Boolean(doctorAuditSchema.safeParse(mapped).success),
  };
}

export type DoctorAiContextV1 = {
  completeness_score: number; // 0–100
  completeness_breakdown: { photos: number; structured: number; numeric: number; verification: number };
  evidence_grade: "A" | "B" | "C" | "D";
  confidence_multiplier: number; // 0.50–1.00
  benchmark_eligible: boolean;
  tier?: 1 | 2 | 3;
};

export function computeDoctorAiContextV1(params: {
  uploads: UploadRow[];
  doctorAnswersRaw?: Record<string, unknown> | null;
  doctorId: string | null;
  clinicId: string | null;
}): {
  ai_context: DoctorAiContextV1;
  completeness_index_v1: CompletenessIndexV1;
  confidence_model_v1: ConfidenceModelV1;
  benchmark: BenchmarkEligibility;
  tiers_v1: TierV1[];
} {
  const completeness = computeCompletenessIndexDoctorV1({
    uploads: params.uploads ?? [],
    doctorAnswersRaw: params.doctorAnswersRaw ?? null,
  });
  const confidenceModel = computeConfidenceModelV1({
    completeness,
    uploads: params.uploads ?? [],
    doctorAnswersRaw: params.doctorAnswersRaw ?? null,
  });
  const benchmark = computeBenchmarkEligibility({
    completeness,
    confidenceModel,
    uploads: params.uploads ?? [],
    doctorAnswersRaw: params.doctorAnswersRaw ?? null,
    doctorId: params.doctorId ?? null,
    clinicId: params.clinicId ?? null,
  });
  const tiers = computeTiersV1({
    completenessScore: completeness.score,
    benchmarkEligible: benchmark.eligible,
    confidenceGrade: confidenceModel.evidence_grade,
    uploads: params.uploads ?? [],
  });

  const tier: 1 | 2 | 3 | undefined = tiers.find((t) => t.tier_id === "tier3_award")?.eligible
    ? 3
    : tiers.find((t) => t.tier_id === "tier2_certified")?.eligible
      ? 2
      : tiers.find((t) => t.tier_id === "tier1_standard")?.eligible
        ? 1
        : undefined;

  return {
    ai_context: {
      completeness_score: Math.round(clamp(Number(completeness.score ?? 0), 0, 100) * 10) / 10,
      completeness_breakdown: {
        photos: Math.round(clamp(Number(completeness.breakdown?.photo_coverage?.score ?? 0), 0, 45) * 10) / 10,
        structured: Math.round(clamp(Number(completeness.breakdown?.structured_metadata?.score ?? 0), 0, 35) * 10) / 10,
        numeric: Math.round(clamp(Number(completeness.breakdown?.numeric_precision?.score ?? 0), 0, 10) * 10) / 10,
        verification: Math.round(clamp(Number(completeness.breakdown?.verification_evidence?.score ?? 0), 0, 10) * 10) / 10,
      },
      evidence_grade: confidenceModel.evidence_grade,
      confidence_multiplier: confidenceModel.confidence_multiplier,
      benchmark_eligible: benchmark.eligible,
      tier,
    },
    completeness_index_v1: completeness,
    confidence_model_v1: confidenceModel,
    benchmark,
    tiers_v1: tiers,
  };
}

