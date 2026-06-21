/**
 * HA-DUAL-PATHWAY-1/2 — pre-surgery vs post-surgery patient public review pathways.
 *
 * Stored on `cases.patient_review_pathway` at creation time. Distinct from
 * `cases.audit_type` (patient | doctor | clinic submitter role).
 */

import {
  PATIENT_AUDIT_PHOTO_BUCKET_DEFS,
  PATIENT_UPLOAD_CATEGORY_DEFS,
  type PatientUploadCategoryDef,
} from "@/lib/patientPhotoCategoryConfig";

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

export type PathwayEvidenceTier = "required" | "recommended" | "optional";

/** Upload or audit-bucket key shown in the pathway evidence UI. */
export type PathwayEvidencePhotoKey = string;

export type PathwayEvidencePack = {
  id: PatientReviewPathway;
  titleKey: string;
  purposeKey: string;
  confidenceMessageKey: string;
  continueButtonKey: string;
  requiredPhotoKeys: readonly PathwayEvidencePhotoKey[];
  recommendedPhotoKeys: readonly PathwayEvidencePhotoKey[];
  optionalPhotoKeys: readonly PathwayEvidencePhotoKey[];
};

export const PATHWAY_EVIDENCE_PACKS: Record<PatientReviewPathway, PathwayEvidencePack> = {
  pre_surgery: {
    id: "pre_surgery",
    titleKey: "patient.upload.pathways.preSurgery.packTitle",
    purposeKey: "patient.upload.pathways.preSurgery.purpose",
    confidenceMessageKey: "patient.upload.pathways.preSurgery.confidenceMessage",
    continueButtonKey: "patient.upload.pathways.preSurgery.continueButton",
    requiredPhotoKeys: [
      "preop_front",
      "preop_left",
      "preop_right",
      "preop_top",
      "preop_donor_rear",
    ],
    recommendedPhotoKeys: ["preop_wet_top", "preop_hairline_closeup", "preop_donor_closeup"],
    optionalPhotoKeys: [
      "preop_clinic_quote",
      "preop_styling_reference",
      "preop_family_pattern",
    ],
  },
  post_surgery: {
    id: "post_surgery",
    titleKey: "patient.upload.pathways.postSurgery.packTitle",
    purposeKey: "patient.upload.pathways.postSurgery.purpose",
    confidenceMessageKey: "patient.upload.pathways.postSurgery.confidenceMessage",
    continueButtonKey: "patient.upload.pathways.postSurgery.continueButton",
    requiredPhotoKeys: [
      "preop_front",
      "current_recipient_closeup",
      "preop_top",
      "preop_donor_rear",
      "preop_donor_closeup",
    ],
    recommendedPhotoKeys: [
      "day0_recipient",
      "day0_donor",
      "postop_wet_recipient",
      "any_preop",
      "postop_day0",
    ],
    optionalPhotoKeys: [
      "graft_count_board",
      "preop_clinic_quote",
      "postop_day1_recipient",
      "postop_week1_recipient",
      "postop_month3_front",
      "postop_month6_front",
    ],
  },
};

export type PathwayUploadGroup = {
  tier: PathwayEvidenceTier;
  titleKey: string;
  descriptionKey: string;
  keys: readonly PathwayEvidencePhotoKey[];
};

export const uploadGroupsByPathway: Record<PatientReviewPathway, readonly PathwayUploadGroup[]> = {
  pre_surgery: [
    {
      tier: "required",
      titleKey: "patient.upload.tiers.required.title",
      descriptionKey: "patient.upload.pathways.preSurgery.requiredDescription",
      keys: PATHWAY_EVIDENCE_PACKS.pre_surgery.requiredPhotoKeys,
    },
    {
      tier: "recommended",
      titleKey: "patient.upload.tiers.recommended.title",
      descriptionKey: "patient.upload.pathways.preSurgery.recommendedDescription",
      keys: PATHWAY_EVIDENCE_PACKS.pre_surgery.recommendedPhotoKeys,
    },
    {
      tier: "optional",
      titleKey: "patient.upload.tiers.optional.title",
      descriptionKey: "patient.upload.pathways.preSurgery.optionalDescription",
      keys: PATHWAY_EVIDENCE_PACKS.pre_surgery.optionalPhotoKeys,
    },
  ],
  post_surgery: [
    {
      tier: "required",
      titleKey: "patient.upload.tiers.required.title",
      descriptionKey: "patient.upload.pathways.postSurgery.requiredDescription",
      keys: PATHWAY_EVIDENCE_PACKS.post_surgery.requiredPhotoKeys,
    },
    {
      tier: "recommended",
      titleKey: "patient.upload.tiers.recommended.title",
      descriptionKey: "patient.upload.pathways.postSurgery.recommendedDescription",
      keys: PATHWAY_EVIDENCE_PACKS.post_surgery.recommendedPhotoKeys,
    },
    {
      tier: "optional",
      titleKey: "patient.upload.tiers.optional.title",
      descriptionKey: "patient.upload.pathways.postSurgery.optionalDescription",
      keys: PATHWAY_EVIDENCE_PACKS.post_surgery.optionalPhotoKeys,
    },
  ],
};

export const requiredPhotoKeys: Record<PatientReviewPathway, readonly PathwayEvidencePhotoKey[]> = {
  pre_surgery: PATHWAY_EVIDENCE_PACKS.pre_surgery.requiredPhotoKeys,
  post_surgery: PATHWAY_EVIDENCE_PACKS.post_surgery.requiredPhotoKeys,
};

export const recommendedPhotoKeys: Record<
  PatientReviewPathway,
  readonly PathwayEvidencePhotoKey[]
> = {
  pre_surgery: PATHWAY_EVIDENCE_PACKS.pre_surgery.recommendedPhotoKeys,
  post_surgery: PATHWAY_EVIDENCE_PACKS.post_surgery.recommendedPhotoKeys,
};

export const optionalPhotoKeys: Record<PatientReviewPathway, readonly PathwayEvidencePhotoKey[]> = {
  pre_surgery: PATHWAY_EVIDENCE_PACKS.pre_surgery.optionalPhotoKeys,
  post_surgery: PATHWAY_EVIDENCE_PACKS.post_surgery.optionalPhotoKeys,
};

/** i18n key prefix: `patient.upload.pathways.{pathway}.photos.{key}.title|description` */
export function pathwayPhotoLabelKey(
  pathway: PatientReviewPathway,
  photoKey: string,
  field: "title" | "description"
): string {
  const segment = pathway === "pre_surgery" ? "preSurgery" : "postSurgery";
  return `patient.upload.pathways.${segment}.photos.${photoKey}.${field}`;
}

/** Upload category keys (patient_photo:{key}) required before submit per pathway. */
export const PATHWAY_REQUIRED_UPLOAD_CATEGORY_KEYS = requiredPhotoKeys;

/** Audit bucket keys derived from upload categories (auditPhotoSchemas). */
export const PATHWAY_REQUIRED_AUDIT_KEYS: Record<PatientReviewPathway, readonly string[]> = {
  pre_surgery: [
    "patient_current_front",
    "patient_current_left",
    "patient_current_right",
    "patient_current_top",
    "patient_current_donor_rear",
  ],
  post_surgery: [
    "patient_current_front",
    "patient_current_top",
    "patient_current_donor_rear",
  ],
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

const uploadDefByKey = new Map(PATIENT_UPLOAD_CATEGORY_DEFS.map((d) => [d.key, d]));
const auditBucketByKey = new Map(PATIENT_AUDIT_PHOTO_BUCKET_DEFS.map((d) => [d.key, d]));

export function getPathwayEvidencePack(pathway: PatientReviewPathway): PathwayEvidencePack {
  return PATHWAY_EVIDENCE_PACKS[pathway];
}

export function getPathwayDefinition(pathway: PatientReviewPathway): PatientPathwayDefinition {
  return PATIENT_PATHWAY_DEFINITIONS[pathway];
}

export function resolvePatientReviewPathwayFromCase(
  row: { patient_review_pathway?: string | null } | null | undefined
): PatientReviewPathway {
  return normalizePatientReviewPathway(row?.patient_review_pathway);
}

export function getPathwayPhotoKeys(pathway: PatientReviewPathway): readonly string[] {
  const pack = PATHWAY_EVIDENCE_PACKS[pathway];
  return [...pack.requiredPhotoKeys, ...pack.recommendedPhotoKeys, ...pack.optionalPhotoKeys];
}

export function getPathwayUploadTier(
  photoKey: string,
  pathway: PatientReviewPathway
): PathwayEvidenceTier | null {
  const pack = PATHWAY_EVIDENCE_PACKS[pathway];
  if (pack.requiredPhotoKeys.includes(photoKey)) return "required";
  if (pack.recommendedPhotoKeys.includes(photoKey)) return "recommended";
  if (pack.optionalPhotoKeys.includes(photoKey)) return "optional";
  return null;
}

export function isPathwayRelevantPhotoKey(photoKey: string, pathway: PatientReviewPathway): boolean {
  return getPathwayUploadTier(photoKey, pathway) != null;
}

export function filterUploadCategoriesForPathway<T extends { key: string; phase?: string }>(
  categories: readonly T[],
  pathway: PatientReviewPathway
): T[] {
  const allowed = new Set(getPathwayPhotoKeys(pathway));
  return categories.filter((c) => allowed.has(c.key));
}

export type PathwayPhotoSlotDef = {
  key: string;
  title: string;
  help: string;
  quickTips?: readonly string[];
  min: number;
  max: number;
  accept: string;
  tier: PathwayEvidenceTier;
  labelKey: string;
  descriptionKey: string;
};

export function resolvePathwayPhotoSlotDef(
  pathway: PatientReviewPathway,
  photoKey: string,
  fallbackTitle?: string,
  fallbackHelp?: string
): PathwayPhotoSlotDef | null {
  const tier = getPathwayUploadTier(photoKey, pathway);
  if (!tier) return null;

  const uploadDef = uploadDefByKey.get(photoKey);
  if (uploadDef) {
    return {
      key: photoKey,
      title: fallbackTitle ?? uploadDef.label,
      help: fallbackHelp ?? uploadDef.description,
      quickTips: uploadDef.tips,
      min: tier === "required" ? Math.max(1, uploadDef.minFiles) : uploadDef.minFiles,
      max: uploadDef.maxFiles,
      accept: uploadDef.accept,
      tier,
      labelKey: pathwayPhotoLabelKey(pathway, photoKey, "title"),
      descriptionKey: pathwayPhotoLabelKey(pathway, photoKey, "description"),
    };
  }

  const auditDef = auditBucketByKey.get(photoKey);
  if (auditDef) {
    return {
      key: photoKey,
      title: fallbackTitle ?? auditDef.title,
      help: fallbackHelp ?? auditDef.help ?? "",
      quickTips: auditDef.quickTips,
      min: tier === "required" ? Math.max(1, auditDef.min) : auditDef.min,
      max: auditDef.max,
      accept: auditDef.accept ?? "image/*",
      tier,
      labelKey: pathwayPhotoLabelKey(pathway, photoKey, "title"),
      descriptionKey: pathwayPhotoLabelKey(pathway, photoKey, "description"),
    };
  }

  return null;
}

export function resolvePathwayPhotoSlotDefs(pathway: PatientReviewPathway): PathwayPhotoSlotDef[] {
  const groups = uploadGroupsByPathway[pathway];
  const out: PathwayPhotoSlotDef[] = [];
  for (const group of groups) {
    for (const key of group.keys) {
      const def = resolvePathwayPhotoSlotDef(pathway, key);
      if (def) out.push(def);
    }
  }
  return out;
}

function parsePatientPhotoStorageKey(type: string | null | undefined): string | null {
  const t = String(type ?? "").trim().toLowerCase();
  if (!t.startsWith("patient_photo:")) return null;
  const raw = t.slice("patient_photo:".length).trim().toLowerCase();
  return raw || null;
}

/** Count uploads per exact storage key (patient_photo suffix). */
export function countPathwayUploadKeys(
  photos: Array<{ type?: string | null; photo_key?: string; submitter_type?: string }>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of photos) {
    const k = parsePatientPhotoStorageKey(p.type ?? "");
    if (!k) continue;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export function getCompletedPathwayUploadKeys(
  pathway: PatientReviewPathway,
  photos: Array<{ type?: string | null }>
): Set<string> {
  const counts = countPathwayUploadKeys(photos);
  const completed = new Set<string>();
  for (const key of getPathwayPhotoKeys(pathway)) {
    const def = resolvePathwayPhotoSlotDef(pathway, key);
    const min = def?.min ?? 1;
    const count = counts[key] ?? 0;
    if (min > 0 ? count >= min : count > 0) completed.add(key);
  }
  return completed;
}

export function getMissingPathwayRequiredUploadKeys(
  pathway: PatientReviewPathway,
  photos: Array<{ type?: string | null }>
): string[] {
  const completed = getCompletedPathwayUploadKeys(pathway, photos);
  return requiredPhotoKeys[pathway].filter((k) => !completed.has(k));
}

export function isPathwayRequiredUploadComplete(
  pathway: PatientReviewPathway,
  photos: Array<{ type?: string | null }>
): boolean {
  return getMissingPathwayRequiredUploadKeys(pathway, photos).length === 0;
}

export type PathwayUploadProgress = {
  completed: number;
  total: number;
  percent: number;
  recommendedCompleted: number;
  recommendedTotal: number;
  recommendedPercent: number;
  optionalAvailable: number;
};

export function computePathwayUploadProgress(
  pathway: PatientReviewPathway,
  photos: Array<{ type?: string | null }>
): PathwayUploadProgress {
  const completed = getCompletedPathwayUploadKeys(pathway, photos);
  const required = requiredPhotoKeys[pathway];
  const recommended = recommendedPhotoKeys[pathway];
  const optional = optionalPhotoKeys[pathway];

  const requiredDone = required.filter((k) => completed.has(k)).length;
  const recommendedDone = recommended.filter((k) => completed.has(k)).length;

  return {
    completed: requiredDone,
    total: required.length,
    percent: required.length > 0 ? Math.round((requiredDone / required.length) * 100) : 0,
    recommendedCompleted: recommendedDone,
    recommendedTotal: recommended.length,
    recommendedPercent:
      recommended.length > 0 ? Math.round((recommendedDone / recommended.length) * 100) : 0,
    optionalAvailable: optional.length,
  };
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

/** Resolve upload category def when present (for extended UI). */
export function getPathwayUploadCategoryDef(key: string): PatientUploadCategoryDef | undefined {
  return uploadDefByKey.get(key);
}
