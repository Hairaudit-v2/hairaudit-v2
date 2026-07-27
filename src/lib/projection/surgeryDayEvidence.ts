/**
 * HA-PROJECTION-1A — Canonical surgery-day evidence role resolution.
 *
 * Accepts patient_photo / doctor_photo / clinic_photo / surgery_photo aliases.
 * Does not rewrite stored categories or move storage objects.
 */

import type {
  ProjectionEvidenceContext,
  ProjectionUploadInput,
  ReconstructionConfidence,
  SurgeryDayEvidenceAssessment,
  SurgeryDayEvidenceRole,
  SurgeryDayReconstructionMode,
} from "./types";

const REQUIRED_ROLE: SurgeryDayEvidenceRole = "surgery_day_recipient";

const STRONGLY_RECOMMENDED: readonly SurgeryDayEvidenceRole[] = [
  "surgery_day_donor",
  "surgery_day_design",
];

const HIGH_VALUE_OPTIONAL: readonly SurgeryDayEvidenceRole[] = [
  "surgery_day_site_creation",
  "surgery_day_implantation",
  "surgery_day_graft_evidence",
];

const BASELINE_ROLES: readonly SurgeryDayEvidenceRole[] = [
  "preop_front",
  "preop_left",
  "preop_right",
  "preop_top",
  "preop_crown",
  "preop_donor",
  "preop_hairline_closeup",
];

/** Category key (no prefix) → logical role. `any_day0` is fallback-only. */
const CATEGORY_ROLE_MAP: Readonly<Record<string, SurgeryDayEvidenceRole | "fallback_any_day0">> = {
  // Patient explicit surgery-day
  day0_recipient: "surgery_day_recipient",
  day0_donor: "surgery_day_donor",
  day0_donor_rear: "surgery_day_donor",
  day0_donor_left: "surgery_day_donor",
  day0_donor_right: "surgery_day_donor",
  day0_donor_closeup: "surgery_day_donor",
  intraop: "surgery_day_recipient",
  intraop_recipient_sites: "surgery_day_site_creation",
  intraop_implantation: "surgery_day_implantation",
  intraop_extraction: "surgery_day_donor",
  intraop_donor_closeup: "surgery_day_donor",
  graft_tray_overview: "surgery_day_graft_evidence",
  graft_tray_closeup: "surgery_day_graft_evidence",
  graft_sorting: "surgery_day_graft_evidence",
  graft_hydration_solution: "surgery_day_graft_evidence",
  graft_count_board: "surgery_day_graft_evidence",

  // Patient pre-op / baseline candidates (eligibility decided separately)
  preop_front: "preop_front",
  preop_left: "preop_left",
  preop_right: "preop_right",
  preop_top: "preop_top",
  preop_crown: "preop_crown",
  preop_donor_rear: "preop_donor",
  preop_donor_left: "preop_donor",
  preop_donor_right: "preop_donor",
  preop_donor_closeup: "preop_donor",
  preop_hairline_closeup: "preop_hairline_closeup",
  preop_wet_top: "preop_top",

  // Generic audit bucket — fallback only
  any_day0: "fallback_any_day0",

  // Doctor / clinic
  img_immediate_postop_recipient: "surgery_day_recipient",
  img_immediate_postop_donor: "surgery_day_donor",
  img_marking_design: "surgery_day_design",
  img_site_creation: "surgery_day_site_creation",
  img_implantation_stage: "surgery_day_implantation",
  img_intraop_extraction: "surgery_day_donor",
  img_graft_tray: "surgery_day_graft_evidence",
  img_graft_closeup: "surgery_day_graft_evidence",
  img_graft_quality: "surgery_day_graft_evidence",
  img_preop_front: "preop_front",
  img_preop_left: "preop_left",
  img_preop_right: "preop_right",
  img_preop_top: "preop_top",
  img_preop_crown: "preop_crown",
  img_preop_donor_rear: "preop_donor",
  img_preop_donor_sides: "preop_donor",

  // Surgery portal slots
  postop_recipient: "surgery_day_recipient",
  postop_donor: "surgery_day_donor",
  hairline_design: "surgery_day_design",
  preop_recipient: "preop_front",
  preop_donor: "preop_donor",
  graft_quality: "surgery_day_graft_evidence",
  implantation_progress: "surgery_day_implantation",
  extraction_progress: "surgery_day_donor",
  petri_graft_sorting: "surgery_day_graft_evidence",
};

export type ResolvedProjectionEvidence = {
  uploadId: string | null;
  rawType: string;
  prefix: string | null;
  categoryKey: string;
  /** Logical role when mapped; null if unrecognized for projection. */
  role: SurgeryDayEvidenceRole | null;
  /** True when category is any_day0 (or equivalent) — never preferred over explicit day0. */
  isAnyDay0Fallback: boolean;
  /** Whether this upload may count as a preoperative baseline. */
  baselineEligible: boolean;
  baselineIneligibilityReason: string | null;
};

function parseUploadType(type: string | null | undefined): {
  prefix: string | null;
  categoryKey: string;
} {
  const raw = String(type ?? "").trim();
  const lower = raw.toLowerCase();
  const prefixes = ["patient_photo:", "doctor_photo:", "clinic_photo:", "surgery_photo:"] as const;
  for (const p of prefixes) {
    if (lower.startsWith(p)) {
      return { prefix: p.slice(0, -1), categoryKey: raw.slice(p.length) };
    }
  }
  // Bare category keys (tests / legacy)
  return { prefix: null, categoryKey: raw };
}

function parseDateMs(value: unknown): number | null {
  if (value == null || value === "") return null;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

function readMetadataString(meta: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!meta) return null;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function isClinicOrSurgeryPrefix(prefix: string | null): boolean {
  return prefix === "doctor_photo" || prefix === "clinic_photo" || prefix === "surgery_photo";
}

function isNeverBaselineCategory(categoryKey: string): boolean {
  const k = categoryKey.toLowerCase();
  if (k.startsWith("patient_current_")) return true;
  if (k.startsWith("postop_month")) return true;
  if (k.startsWith("postop_day") || k.startsWith("postop_week")) return true;
  if (k === "current_recipient_closeup" || k === "postop_wet_recipient") return true;
  if (k.startsWith("img_followup") || k.startsWith("img_immediate_postop")) return true;
  if (k === "any_early_postop_day0_3" || k === "any_day0") return true;
  return false;
}

/**
 * Determine whether a mapped preop_* role upload is attributable to before surgery.
 * Uncertain provenance → baselineEligible = false (never silent promotion).
 */
export function resolveBaselineEligibility(
  upload: ProjectionUploadInput,
  categoryKey: string,
  role: SurgeryDayEvidenceRole | null,
  context: ProjectionEvidenceContext
): { baselineEligible: boolean; reason: string | null } {
  if (!role || !BASELINE_ROLES.includes(role)) {
    return { baselineEligible: false, reason: null };
  }

  if (isNeverBaselineCategory(categoryKey)) {
    return {
      baselineEligible: false,
      reason: "Category is a current/follow-up view and cannot serve as preoperative baseline.",
    };
  }

  const { prefix } = parseUploadType(upload.type);
  const meta = (upload.metadata ?? null) as Record<string, unknown> | null;

  // Clinic/doctor/surgery portal pre-op slots are workflow-attested.
  if (isClinicOrSurgeryPrefix(prefix) && categoryKey.toLowerCase().includes("preop")) {
    return { baselineEligible: true, reason: null };
  }
  if (prefix === "surgery_photo" && (categoryKey === "preop_recipient" || categoryKey === "preop_donor")) {
    return { baselineEligible: true, reason: null };
  }

  if (context.baselineConfirmed === true) {
    return { baselineEligible: true, reason: null };
  }

  const metaPhase = readMetadataString(meta, ["phase", "photo_phase", "patient_photo_phase"])?.toLowerCase();
  if (metaPhase === "preoperative" || metaPhase === "pre_op" || metaPhase === "preop") {
    return { baselineEligible: true, reason: null };
  }

  const provenance = readMetadataString(meta, ["provenance", "evidence_provenance", "baseline_provenance"]);
  if (provenance && /pre.?op|before.?surgery|baseline/i.test(provenance)) {
    return { baselineEligible: true, reason: null };
  }

  const captureMs =
    parseDateMs(upload.captured_at) ??
    parseDateMs(meta?.captured_at) ??
    parseDateMs(meta?.capture_timestamp) ??
    parseDateMs(meta?.taken_at);
  const procedureMs = parseDateMs(context.procedureDate);
  if (captureMs != null && procedureMs != null && captureMs < procedureMs) {
    return { baselineEligible: true, reason: null };
  }

  // Pre-surgery pathway uploads labeled preop_* are accepted as baseline intent.
  if (context.pathway === "pre_surgery" && categoryKey.toLowerCase().startsWith("preop_")) {
    return { baselineEligible: true, reason: null };
  }

  // Post-surgery pathway historically reuses preop_* for "current" views — do not trust name alone.
  if (context.pathway === "post_surgery" && categoryKey.toLowerCase().startsWith("preop_")) {
    return {
      baselineEligible: false,
      reason:
        "Preop-named upload on post-surgery pathway lacks verified pre-procedure provenance; not treated as baseline.",
    };
  }

  // Unknown pathway / insufficient provenance
  if (categoryKey.toLowerCase().startsWith("preop_")) {
    return {
      baselineEligible: false,
      reason: "Preop-named upload lacks verified pre-procedure provenance; baselineEligible=false.",
    };
  }

  return { baselineEligible: false, reason: "Insufficient provenance for baseline attribution." };
}

/**
 * Resolve a single upload to a projection evidence role without mutating storage.
 */
export function resolveProjectionEvidenceRole(
  upload: ProjectionUploadInput,
  context: ProjectionEvidenceContext = {}
): ResolvedProjectionEvidence {
  const rawType = String(upload.type ?? "").trim();
  const { prefix, categoryKey } = parseUploadType(rawType);
  const mapped = CATEGORY_ROLE_MAP[categoryKey] ?? CATEGORY_ROLE_MAP[categoryKey.toLowerCase()] ?? null;

  const isAnyDay0Fallback = mapped === "fallback_any_day0";
  const role: SurgeryDayEvidenceRole | null =
    mapped && mapped !== "fallback_any_day0" ? mapped : null;

  const baseline = resolveBaselineEligibility(upload, categoryKey, role, context);

  return {
    uploadId: upload.id ?? null,
    rawType,
    prefix,
    categoryKey,
    role,
    isAnyDay0Fallback,
    baselineEligible: baseline.baselineEligible,
    baselineIneligibilityReason: baseline.reason,
  };
}

export type AssessSurgeryDayEvidenceInput = {
  uploads: ProjectionUploadInput[];
  context?: ProjectionEvidenceContext;
};

function uniqueRoles(roles: SurgeryDayEvidenceRole[]): SurgeryDayEvidenceRole[] {
  return [...new Set(roles)];
}

function deriveConfidence(input: {
  hasRecipient: boolean;
  hasDonor: boolean;
  hasDesign: boolean;
  baselineAvailable: boolean;
  hasStructuredMetadataHint: boolean;
  usedAnyDay0Fallback: boolean;
  qualityConcern: boolean;
}): ReconstructionConfidence {
  if (!input.hasRecipient) return "low";
  if (input.usedAnyDay0Fallback || input.qualityConcern) return "low";
  if (input.hasRecipient && input.hasDonor && input.hasDesign && input.baselineAvailable && input.hasStructuredMetadataHint) {
    return "high";
  }
  if (input.hasRecipient && (input.hasDonor || input.hasDesign || input.baselineAvailable || input.hasStructuredMetadataHint)) {
    return "moderate";
  }
  return "low";
}

/**
 * Assess surgery-day evidence sufficiency and reconstruction mode.
 */
export function assessSurgeryDayEvidence(
  input: AssessSurgeryDayEvidenceInput
): SurgeryDayEvidenceAssessment {
  const context = input.context ?? {};
  const resolved = (input.uploads ?? []).map((u) => resolveProjectionEvidenceRole(u, context));

  const explicitRoles: SurgeryDayEvidenceRole[] = [];
  let anyDay0Present = false;
  const baselineRolesPresent: SurgeryDayEvidenceRole[] = [];
  const limitations: string[] = [];

  for (const r of resolved) {
    if (r.isAnyDay0Fallback) {
      anyDay0Present = true;
      continue;
    }
    if (!r.role) continue;
    if (BASELINE_ROLES.includes(r.role)) {
      if (r.baselineEligible) {
        baselineRolesPresent.push(r.role);
        explicitRoles.push(r.role);
      } else if (r.baselineIneligibilityReason) {
        limitations.push(r.baselineIneligibilityReason);
      }
      continue;
    }
    explicitRoles.push(r.role);
  }

  let usedAnyDay0Fallback = false;
  const present = uniqueRoles(explicitRoles);
  if (!present.includes(REQUIRED_ROLE) && anyDay0Present) {
    present.push(REQUIRED_ROLE);
    usedAnyDay0Fallback = true;
    limitations.push(
      "Surgery-day recipient evidence relies on a generic any_day0 upload; anatomic specificity is limited."
    );
  }

  const hasRecipient = present.includes(REQUIRED_ROLE);
  const hasDonor = present.includes("surgery_day_donor");
  const hasDesign = present.includes("surgery_day_design");
  const baselineAvailable = baselineRolesPresent.length > 0;

  let mode: SurgeryDayReconstructionMode | null = null;
  if (hasRecipient && baselineAvailable) {
    mode = "baseline_plus_surgery_day";
  } else if (hasRecipient) {
    mode = "surgery_day_only";
  }

  const missingRecommended = STRONGLY_RECOMMENDED.filter((r) => !present.includes(r));
  for (const r of missingRecommended) {
    limitations.push(
      r === "surgery_day_donor"
        ? "No surgery-day donor image was available for extraction-pattern observation."
        : "No surgery-day design/marking image was available."
    );
  }

  for (const r of HIGH_VALUE_OPTIONAL) {
    if (!present.includes(r)) {
      // Optional — do not fail; note only once as aggregate later if needed
    }
  }

  if (!baselineAvailable) {
    limitations.push("No verified preoperative baseline was available.");
  }

  if (!hasRecipient) {
    limitations.push("Acceptable surgery-day recipient evidence is required for procedure reconstruction.");
  }

  // Deduplicate limitation strings
  const uniqueLimitations = [...new Set(limitations)];

  const confidence = deriveConfidence({
    hasRecipient,
    hasDonor,
    hasDesign,
    baselineAvailable,
    hasStructuredMetadataHint: false, // filled by builder after metadata resolve
    usedAnyDay0Fallback,
    qualityConcern: usedAnyDay0Fallback,
  });

  return {
    mode,
    sufficient: hasRecipient,
    confidence,
    presentRoles: present,
    missingRecommendedRoles: missingRecommended,
    limitations: uniqueLimitations,
    baselineAvailable,
    baselineRoleCount: uniqueRoles(baselineRolesPresent).length,
    usedAnyDay0Fallback,
  };
}

/** Re-export recommended role lists for docs/tests. */
export const SURGERY_DAY_EVIDENCE_POLICY = {
  required: REQUIRED_ROLE,
  stronglyRecommended: STRONGLY_RECOMMENDED,
  highValueOptional: HIGH_VALUE_OPTIONAL,
  baselineRoles: BASELINE_ROLES,
} as const;

export function listAcceptedCategoryAliases(): Readonly<Record<string, SurgeryDayEvidenceRole | "fallback_any_day0">> {
  return CATEGORY_ROLE_MAP;
}
