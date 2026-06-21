/**
 * HA-DUAL-PATHWAY-1 — pre-surgery vs post-surgery patient public review pathways.
 *
 * Stored on `cases.patient_review_pathway` at creation time. Distinct from
 * `cases.audit_type` (patient | doctor | clinic submitter role).
 */

export const PATIENT_REVIEW_PATHWAYS = ["pre_surgery", "post_surgery"] as const;

export type PatientReviewPathway = (typeof PATIENT_REVIEW_PATHWAYS)[number];

export const DEFAULT_PATIENT_REVIEW_PATHWAY: PatientReviewPathway = "post_surgery";

export function isPatientReviewPathway(value: unknown): value is PatientReviewPathway {
  return value === "pre_surgery" || value === "post_surgery";
}

/** Normalize API / cookie / query values; legacy cases default to post_surgery. */
export function normalizePatientReviewPathway(value: unknown): PatientReviewPathway {
  return isPatientReviewPathway(value) ? value : DEFAULT_PATIENT_REVIEW_PATHWAY;
}

export type PatientPathwayDefinition = {
  id: PatientReviewPathway;
  marketingTitleKey: string;
  marketingDescriptionKey: string;
  marketingCtaKey: string;
  analyticsEventSuffix: string;
  /** Patient-safe focus areas surfaced in reports and progress UI */
  reportFocusAreas: readonly string[];
  /** Intelligence engine module ids executed for this pathway */
  intelligenceModules: readonly string[];
};

export const PATIENT_PATHWAY_DEFINITIONS: Record<PatientReviewPathway, PatientPathwayDefinition> = {
  pre_surgery: {
    id: "pre_surgery",
    marketingTitleKey: "marketing.home.pathways.preSurgery.title",
    marketingDescriptionKey: "marketing.home.pathways.preSurgery.description",
    marketingCtaKey: "marketing.home.pathways.preSurgery.cta",
    analyticsEventSuffix: "pre_surgery",
    reportFocusAreas: [
      "Treatment planning context",
      "Candidacy and suitability signals",
      "Donor reserve assessment",
      "Graft range estimation",
      "Progression outlook",
    ],
    intelligenceModules: [
      "planning",
      "suitability",
      "donor_analysis",
      "graft_estimation",
      "progression_forecast",
    ],
  },
  post_surgery: {
    id: "post_surgery",
    marketingTitleKey: "marketing.home.pathways.postSurgery.title",
    marketingDescriptionKey: "marketing.home.pathways.postSurgery.description",
    marketingCtaKey: "marketing.home.pathways.postSurgery.cta",
    analyticsEventSuffix: "post_surgery",
    reportFocusAreas: [
      "Donor trauma signals",
      "Overharvesting assessment",
      "Density and placement review",
      "Procedural integrity scoring",
      "Repair and corrective guidance",
    ],
    intelligenceModules: [
      "donor_trauma_detection",
      "overharvesting_detection",
      "density_assessment",
      "procedural_integrity_scoring",
      "repair_intelligence",
    ],
  },
};

/** Upload category keys (patient_photo:{key}) required before submit per pathway. */
export const PATHWAY_REQUIRED_UPLOAD_CATEGORY_KEYS: Record<
  PatientReviewPathway,
  readonly string[]
> = {
  pre_surgery: ["preop_front", "preop_top", "preop_donor_rear"],
  post_surgery: ["preop_front", "preop_top", "preop_donor_rear"],
};

/** Audit bucket keys derived from upload categories (auditPhotoSchemas). */
export const PATHWAY_REQUIRED_AUDIT_KEYS: Record<PatientReviewPathway, readonly string[]> = {
  pre_surgery: ["patient_current_front", "patient_current_top", "patient_current_donor_rear"],
  post_surgery: ["patient_current_front", "patient_current_top", "patient_current_donor_rear"],
};

/** Full intake section ids shown when advanced questionnaire is enabled. */
export const PATHWAY_INTAKE_SECTION_IDS: Record<PatientReviewPathway, readonly string[]> = {
  pre_surgery: ["clinic_procedure", "transparency", "cost"],
  post_surgery: [
    "clinic_procedure",
    "transparency",
    "cost",
    "surgical_experience",
    "recovery",
    "results",
  ],
};

/** Minimum friction-free intake fields on first submit. */
export const PATHWAY_MINIMAL_REQUIRED_FIELD_IDS: Record<PatientReviewPathway, readonly string[]> = {
  pre_surgery: ["clinic_country", "procedure_type"],
  post_surgery: [
    "clinic_name",
    "clinic_country",
    "clinic_city",
    "procedure_date",
    "procedure_type",
  ],
};

/** Minimal intake section ids for the friction-free marketing funnel. */
export const PATHWAY_MINIMAL_SECTION_IDS: Record<PatientReviewPathway, readonly string[]> = {
  pre_surgery: ["clinic_procedure"],
  post_surgery: ["clinic_procedure"],
};

export function getPathwayDefinition(pathway: PatientReviewPathway): PatientPathwayDefinition {
  return PATIENT_PATHWAY_DEFINITIONS[pathway];
}

export function resolvePatientReviewPathwayFromCase(
  row: { patient_review_pathway?: string | null } | null | undefined
): PatientReviewPathway {
  return normalizePatientReviewPathway(row?.patient_review_pathway);
}

export function filterUploadCategoriesForPathway<T extends { key: string; phase?: string }>(
  categories: readonly T[],
  pathway: PatientReviewPathway
): T[] {
  if (pathway === "pre_surgery") {
    return categories.filter(
      (c) =>
        c.phase === "preoperative" ||
        c.key.startsWith("preop_") ||
        !c.phase?.startsWith("follow")
    );
  }
  return [...categories];
}

export function isIntakeSectionVisibleForPathway(
  sectionId: string,
  pathway: PatientReviewPathway,
  opts?: { minimal?: boolean; includeAdvanced?: boolean }
): boolean {
  const allowed = opts?.minimal
    ? PATHWAY_MINIMAL_SECTION_IDS[pathway]
    : PATHWAY_INTAKE_SECTION_IDS[pathway];
  if (!allowed.includes(sectionId)) return false;
  if (sectionId.startsWith("adv_") && !opts?.includeAdvanced) return false;
  return true;
}
