/**
 * HA-DONOR-HEALING-1A — donor-healing entry context, safety language, and
 * photo emphasis helpers. Layers onto the canonical post_surgery pathway;
 * does not create a third case pathway.
 */

/** Canonical concern values carried into post-surgery intake. */
export const POST_SURGERY_CONCERNS = [
  "donor_healing",
  "donor_patchiness",
  "donor_shock_loss",
  "pain_redness_irritation",
  "possible_overharvesting",
  "future_donor_capacity",
] as const;

export type PostSurgeryConcern = (typeof POST_SURGERY_CONCERNS)[number];

/**
 * Validated public entry-context contract.
 * Only `donor_healing` is fully implemented in 1A; other values are reserved
 * for future concern pages and must be rejected until wired.
 */
export const HAIRAUDIT_ENTRY_CONTEXTS = [
  "donor_healing",
  "suspected_graft_failure",
  "low_density",
  "bright_light_appearance",
] as const;

export type HairAuditEntryContext = (typeof HAIRAUDIT_ENTRY_CONTEXTS)[number];

/** Entry contexts fully active in this phase. */
export const IMPLEMENTED_HAIRAUDIT_ENTRY_CONTEXTS = ["donor_healing"] as const;

export type ImplementedHairAuditEntryContext =
  (typeof IMPLEMENTED_HAIRAUDIT_ENTRY_CONTEXTS)[number];

export const DONOR_HEALING_ENTRY_CONTEXT = "donor_healing" as const;
export type DonorHealingEntryContext = typeof DONOR_HEALING_ENTRY_CONTEXT;

export const DONOR_HEALING_GUIDE_SLUG = "normal-donor-healing-after-fue";
export const DONOR_HEALING_SOURCE_PAGE = DONOR_HEALING_GUIDE_SLUG;
export const DONOR_HEALING_RECOMMENDED_PATHWAY = "post_surgery" as const;

/** Bounded orientation states for report / review preparation (not diagnoses). */
export const DONOR_HEALING_ORIENTATION_STATES = [
  "compatible_with_reported_stage",
  "too_early_to_assess_homogeneity",
  "temporary_shedding_may_contribute",
  "persistent_irregularity_deserves_review",
  "direct_clinical_assessment_recommended",
  "insufficient_evidence",
] as const;

export type DonorHealingOrientation =
  (typeof DONOR_HEALING_ORIENTATION_STATES)[number];

/** @deprecated Prefer DonorHealingOrientation — kept for existing imports. */
export type DonorHealingOrientationState = DonorHealingOrientation;

export const DONOR_HEALING_ORIENTATION_LABELS: Record<DonorHealingOrientation, string> = {
  compatible_with_reported_stage:
    "Appearance broadly compatible with the reported healing stage",
  too_early_to_assess_homogeneity: "Too early to assess long-term donor uniformity",
  temporary_shedding_may_contribute: "Temporary donor shedding may be contributing",
  persistent_irregularity_deserves_review:
    "Persistent donor irregularity deserves structured review",
  direct_clinical_assessment_recommended: "Direct clinical assessment is recommended",
  insufficient_evidence:
    "The available photographs are insufficient to assess this reliably",
};

/** Phrases that must never appear in patient-facing donor copy or automated outputs. */
export const FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES = [
  "normal donor confirmed",
  "overharvested confirmed",
  "overharvesting confirmed",
  "infection diagnosed",
  "infection confirmed",
  "safe remaining graft capacity",
  "safe graft capacity",
  // HA-DONOR-HEALING-1C — longitudinal comparison must not claim these
  "follicle death",
  "permanent depletion",
  "exact density loss",
  "confirmed overharvesting",
  "future safe graft capacity",
] as const;

export const DONOR_RED_FLAG_SYMPTOM_VALUES = [
  "increasing_pain",
  "spreading_redness",
  "discharge",
  "fever",
  "persistent_bleeding",
  "rapidly_worsening_swelling",
] as const;

export type DonorRedFlagSymptom = (typeof DONOR_RED_FLAG_SYMPTOM_VALUES)[number];

export const DONOR_RED_FLAG_WARNING_COPY =
  "These symptoms are better assessed directly rather than from photographs alone. Contact your treating clinic, local doctor, or urgent medical service depending on severity. HairAudit photo review does not replace urgent or in-person care.";

/** Canonical upload keys emphasised for donor-healing entry (readiness unchanged). */
export const DONOR_EMPHASIS_PHOTO_KEYS = [
  "preop_donor_rear",
  "preop_donor_left",
  "preop_donor_right",
] as const;

export type DonorEmphasisPhotoKey = (typeof DONOR_EMPHASIS_PHOTO_KEYS)[number];

export const DONOR_EMPHASIS_PHOTO_COPY: Record<
  DonorEmphasisPhotoKey,
  { title: string; whyNeeded: string }
> = {
  preop_donor_rear: {
    title: "Rear donor view",
    whyNeeded:
      "Shows the main extraction zone and how evenly healing appears across the back of the head.",
  },
  preop_donor_left: {
    title: "Left donor view",
    whyNeeded:
      "Documents the left transition into the donor zone so patchiness is not judged from one angle alone.",
  },
  preop_donor_right: {
    title: "Right donor view",
    whyNeeded:
      "Documents the right transition into the donor zone for a balanced left–right comparison.",
  },
};

/** Privacy-safe funnel event names (no PHI payloads). */
export const DONOR_FUNNEL_EVENTS = [
  "donor_guide_viewed",
  "donor_stage_selected",
  "donor_timeline_stage_opened",
  "donor_cta_clicked",
  "donor_pathway_confirmed",
  "donor_auth_started",
  "donor_auth_completed",
  "donor_case_created",
  "donor_first_photo_uploaded",
  "donor_photo_set_completed",
  "donor_questions_completed",
  "donor_case_submitted",
  "donor_report_viewed",
] as const;

export type DonorFunnelEvent = (typeof DONOR_FUNNEL_EVENTS)[number];

export const DONOR_ANALYTICS_FORBIDDEN_META_KEYS = [
  "symptoms",
  "donor_red_flag_symptoms",
  "imageUrl",
  "image_url",
  "email",
  "patient_name",
  "name",
  "caseId",
  "case_id",
  "uploadId",
  "upload_id",
  "free_text",
  "answers",
] as const;

export function isPostSurgeryConcern(value: unknown): value is PostSurgeryConcern {
  return typeof value === "string" && (POST_SURGERY_CONCERNS as readonly string[]).includes(value);
}

export function parsePostSurgeryConcern(value: unknown): PostSurgeryConcern | null {
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    return isPostSurgeryConcern(trimmed) ? trimmed : null;
  }
  return null;
}

/**
 * Validate a HairAudit entry context token.
 * Unknown values are rejected. Reserved-but-unimplemented values are rejected in 1A.
 */
export function parseHairAuditEntryContext(
  value: unknown
): ImplementedHairAuditEntryContext | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if ((IMPLEMENTED_HAIRAUDIT_ENTRY_CONTEXTS as readonly string[]).includes(trimmed)) {
    return trimmed as ImplementedHairAuditEntryContext;
  }
  // Explicitly reject reserved future values and arbitrary URL tokens.
  return null;
}

/**
 * Map concern / URL tokens to the active donor-healing entry context.
 * Concern enums may imply donor entry; reserved entry contexts do not.
 */
export function parseDonorEntryContext(value: unknown): DonorHealingEntryContext | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();

  if (parseHairAuditEntryContext(trimmed) === DONOR_HEALING_ENTRY_CONTEXT) {
    return DONOR_HEALING_ENTRY_CONTEXT;
  }
  if (trimmed === "donor") {
    return DONOR_HEALING_ENTRY_CONTEXT;
  }
  // Concern tokens that imply donor-healing entry.
  if (
    trimmed === "donor_healing" ||
    trimmed === "donor_patchiness" ||
    trimmed === "donor_shock_loss" ||
    trimmed === "possible_overharvesting" ||
    trimmed === "future_donor_capacity" ||
    trimmed === "pain_redness_irritation"
  ) {
    return DONOR_HEALING_ENTRY_CONTEXT;
  }
  return null;
}

export function isDonorHealingEntryContext(value: unknown): boolean {
  return parseDonorEntryContext(value) != null;
}

export function getDonorRedFlagWarningCopy(): string {
  return DONOR_RED_FLAG_WARNING_COPY;
}

export function answersIncludeDonorRedFlags(
  answers: Record<string, unknown> | null | undefined
): boolean {
  if (!answers) return false;
  const raw = answers.donor_red_flag_symptoms ?? answers.donor_symptoms;
  const values = Array.isArray(raw)
    ? raw.map((v) => String(v))
    : typeof raw === "string"
      ? [raw]
      : [];
  return values.some((v) =>
    (DONOR_RED_FLAG_SYMPTOM_VALUES as readonly string[]).includes(v)
  );
}

export function containsForbiddenDonorDiagnosticLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES.some((phrase) => lower.includes(phrase));
}

export function donorHealingOrientationLabel(state: DonorHealingOrientation): string {
  return DONOR_HEALING_ORIENTATION_LABELS[state];
}

/**
 * Bounded orientation mapping (1A contract / 1B report mapping).
 * Never diagnoses infection, overharvesting, normality, or graft capacity.
 * Single-photograph certainty is rejected for mature-stage compatibility claims.
 */
export function resolveDonorHealingOrientationState(input: {
  monthsSinceBand?: string | null;
  appearanceTrend?: string | null;
  hasDonorRearPhoto?: boolean;
  hasDonorLeftPhoto?: boolean;
  hasDonorRightPhoto?: boolean;
  hasRedFlagSymptoms?: boolean;
  hasProcedureDate?: boolean;
}): DonorHealingOrientation {
  if (input.hasRedFlagSymptoms) {
    return "direct_clinical_assessment_recommended";
  }

  const donorViews =
    Number(Boolean(input.hasDonorRearPhoto)) +
    Number(Boolean(input.hasDonorLeftPhoto)) +
    Number(Boolean(input.hasDonorRightPhoto));
  const band = String(input.monthsSinceBand ?? "").toLowerCase();
  const hasTiming = Boolean(band) || Boolean(input.hasProcedureDate);
  const early =
    band === "under_3" ||
    band === "days_1_3" ||
    band === "days_4_7" ||
    band === "days_8_14" ||
    band === "weeks_3_8";

  if (!hasTiming || donorViews < 1) {
    return "insufficient_evidence";
  }

  // One photograph alone must never produce a mature-stage compatibility claim.
  if (donorViews === 1) {
    return early ? "too_early_to_assess_homogeneity" : "insufficient_evidence";
  }

  if (early) {
    return "too_early_to_assess_homogeneity";
  }

  const trend = String(input.appearanceTrend ?? "").toLowerCase();
  if (trend === "worsening") {
    return "persistent_irregularity_deserves_review";
  }
  if (trend === "improving") {
    return "temporary_shedding_may_contribute";
  }
  if (donorViews < 3) {
    return "insufficient_evidence";
  }
  return "compatible_with_reported_stage";
}

export function buildDonorHealingOrientationSummary(input: {
  monthsSinceBand?: string | null;
  appearanceTrend?: string | null;
  hasDonorRearPhoto?: boolean;
  hasDonorLeftPhoto?: boolean;
  hasDonorRightPhoto?: boolean;
  hasRedFlagSymptoms?: boolean;
}): { state: DonorHealingOrientation; label: string } {
  const state = resolveDonorHealingOrientationState(input);
  return { state, label: donorHealingOrientationLabel(state) };
}

/** Analytics-safe meta only — never include answers, symptoms, or image URLs. */
export function donorHealingAnalyticsMeta(
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const safeExtra: Record<string, unknown> = {};
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (
        (DONOR_ANALYTICS_FORBIDDEN_META_KEYS as readonly string[]).includes(key) ||
        value == null
      ) {
        continue;
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        safeExtra[key] = value;
      }
    }
  }
  return {
    entry_context: DONOR_HEALING_ENTRY_CONTEXT,
    source_page: DONOR_HEALING_SOURCE_PAGE,
    pathway: DONOR_HEALING_RECOMMENDED_PATHWAY,
    patient_guide: DONOR_HEALING_GUIDE_SLUG,
    ...safeExtra,
  };
}

/**
 * Append validated donor entry_context to an internal path for auth return /
 * resume continuity. Rejects arbitrary entry_context query values.
 */
export function withDonorEntryContextQuery(
  path: string,
  entryContext?: unknown
): string {
  const parsed = parseDonorEntryContext(entryContext);
  if (!parsed || !path.startsWith("/") || path.startsWith("//") || path.includes(":")) {
    return path;
  }
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const qIndex = withoutHash.indexOf("?");
  const pathname = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
  const params = new URLSearchParams(qIndex >= 0 ? withoutHash.slice(qIndex + 1) : "");
  params.set("entry_context", parsed);
  return `${pathname}?${params.toString()}${hash}`;
}
