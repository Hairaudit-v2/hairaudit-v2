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

export const DONOR_HEALING_ENTRY_CONTEXT = "donor_healing" as const;
export type DonorHealingEntryContext = typeof DONOR_HEALING_ENTRY_CONTEXT;

export const DONOR_HEALING_GUIDE_SLUG = "normal-donor-healing-after-fue";

/** Bounded orientation states for report / review preparation (not diagnoses). */
export const DONOR_HEALING_ORIENTATION_STATES = [
  "compatible_with_reported_stage",
  "too_early_to_assess_homogeneity",
  "temporary_shedding_may_contribute",
  "persistent_irregularity_deserves_review",
  "direct_clinical_assessment_recommended",
  "insufficient_evidence",
] as const;

export type DonorHealingOrientationState = (typeof DONOR_HEALING_ORIENTATION_STATES)[number];

export const DONOR_HEALING_ORIENTATION_LABELS: Record<DonorHealingOrientationState, string> = {
  compatible_with_reported_stage:
    "Appearance broadly compatible with the reported healing stage",
  too_early_to_assess_homogeneity: "Too early to assess long-term donor uniformity",
  temporary_shedding_may_contribute: "Temporary donor shedding may be contributing",
  persistent_irregularity_deserves_review:
    "Persistent donor irregularity deserves structured review",
  direct_clinical_assessment_recommended: "Direct clinical assessment is recommended",
  insufficient_evidence:
    "The available photographs are not sufficient to assess this reliably",
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
] as const;

export const DONOR_RED_FLAG_SYMPTOM_VALUES = [
  "increasing_pain",
  "spreading_redness",
  "discharge",
  "fever",
  "persistent_bleeding",
] as const;

export type DonorRedFlagSymptom = (typeof DONOR_RED_FLAG_SYMPTOM_VALUES)[number];

export const DONOR_RED_FLAG_WARNING_COPY =
  "Symptoms such as increasing pain, spreading redness, discharge, fever, or persistent bleeding need direct clinical care. Contact your treating clinic, a local doctor, or urgent care as appropriate. HairAudit photo review does not replace medical assessment.";

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

export function isPostSurgeryConcern(value: unknown): value is PostSurgeryConcern {
  return typeof value === "string" && (POST_SURGERY_CONCERNS as readonly string[]).includes(value);
}

export function parsePostSurgeryConcern(value: unknown): PostSurgeryConcern | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return isPostSurgeryConcern(trimmed) ? trimmed : null;
}

/** Entry context accepted on audit start / chooser handoff (donor focus only in 1A). */
export function parseDonorEntryContext(value: unknown): DonorHealingEntryContext | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === DONOR_HEALING_ENTRY_CONTEXT || trimmed === "donor") {
    return DONOR_HEALING_ENTRY_CONTEXT;
  }
  // Allow concern tokens that imply donor-healing entry.
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

export function donorHealingOrientationLabel(
  state: DonorHealingOrientationState
): string {
  return DONOR_HEALING_ORIENTATION_LABELS[state];
}

/**
 * Bounded orientation stub for 1A. Never diagnoses infection, overharvesting,
 * normality, or graft capacity. Full report integration lands in 1B.
 */
export function resolveDonorHealingOrientationState(input: {
  monthsSinceBand?: string | null;
  appearanceTrend?: string | null;
  hasDonorRearPhoto?: boolean;
  hasDonorLeftPhoto?: boolean;
  hasDonorRightPhoto?: boolean;
  hasRedFlagSymptoms?: boolean;
}): DonorHealingOrientationState {
  if (input.hasRedFlagSymptoms) {
    return "direct_clinical_assessment_recommended";
  }

  const donorViews =
    Number(Boolean(input.hasDonorRearPhoto)) +
    Number(Boolean(input.hasDonorLeftPhoto)) +
    Number(Boolean(input.hasDonorRightPhoto));
  if (donorViews < 1) {
    return "insufficient_evidence";
  }

  const band = String(input.monthsSinceBand ?? "").toLowerCase();
  const early =
    band === "under_3" ||
    band === "days_1_3" ||
    band === "days_4_7" ||
    band === "days_8_14" ||
    band === "weeks_3_8";

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
}): { state: DonorHealingOrientationState; label: string } {
  const state = resolveDonorHealingOrientationState(input);
  return { state, label: donorHealingOrientationLabel(state) };
}

/** Analytics-safe meta only — never include answers, symptoms, or image URLs. */
export function donorHealingAnalyticsMeta(extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    entry_context: DONOR_HEALING_ENTRY_CONTEXT,
    patient_guide: DONOR_HEALING_GUIDE_SLUG,
    ...extra,
  };
}
