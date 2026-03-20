/**
 * Single source of truth for patient-facing upload categories (storage keys patient_photo:{key})
 * and patient audit bucket definitions (patient_current_* / any_* keys used by auditPhotoSchemas).
 *
 * Do not add new visible upload categories here without product approval; optional future-only
 * rows may use visibleInUi: false until released.
 */

/** Clinical time window for the photo set */
export type PatientPhotoPhase =
  | "preoperative"
  | "day_of_surgery"
  | "perioperative"
  | "early_postoperative";

/** Anatomic / view region (audit documentation, not clinical diagnosis) */
export type PatientPhotoRegion =
  | "front"
  | "left_profile"
  | "right_profile"
  | "vertex"
  | "crown"
  | "donor_posterior"
  | "recipient_surgical"
  | "donor_surgical"
  | "supplemental";

/** Target key after normalizeToPatientKey() in auditPhotoSchemas (legacy map). */
export type PatientAuditNormalizationTarget =
  | "patient_current_front"
  | "patient_current_top"
  | "patient_current_donor_rear"
  | "patient_current_left"
  | "patient_current_right"
  | "patient_current_crown"
  | "any_day0"
  | "any_early_postop_day0_3";

export type PatientUploadCategoryDef = {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly phase: PatientPhotoPhase;
  readonly region: PatientPhotoRegion;
  readonly purpose: string;
  readonly required: boolean;
  /** When false, UI lists should omit this category until explicitly enabled. */
  readonly visibleInUi: boolean;
  readonly tips: readonly string[];
  readonly accept: string;
  readonly maxFiles: number;
  readonly minFiles: number;
  readonly mapsToAuditEvidenceKey: PatientAuditNormalizationTarget;
};

/** Mirrors PhotoCategoryDef in photoSchemas (patient audit buckets / PhotoUploader evidence UI). */
export type PatientAuditPhotoBucketDef = {
  key: string;
  title: string;
  help?: string;
  quickTips?: readonly string[];
  min: number;
  max: number;
  required: boolean;
  accept?: string;
};

export const PATIENT_UPLOAD_CATEGORY_DEFS = [
  {
    key: "preop_front",
    label: "Pre-op — Front",
    description: "Front-facing scalp/hairline in good lighting.",
    phase: "preoperative",
    region: "front",
    purpose: "Baseline anterior scalp and hairline for comparison and design review.",
    required: true,
    visibleInUi: true,
    tips: ["Stand under bright indoor light", "Hold camera at eye level", "No filters"],
    accept: "image/*",
    maxFiles: 3,
    minFiles: 1,
    mapsToAuditEvidenceKey: "patient_current_front",
  },
  {
    key: "preop_left",
    label: "Pre-op — Left side",
    description: "Left temple / side profile view.",
    phase: "preoperative",
    region: "left_profile",
    purpose: "Document left temporal and lateral baseline.",
    required: true,
    visibleInUi: true,
    tips: ["Keep background plain", "Good lighting"],
    accept: "image/*",
    maxFiles: 2,
    minFiles: 1,
    mapsToAuditEvidenceKey: "patient_current_left",
  },
  {
    key: "preop_right",
    label: "Pre-op — Right side",
    description: "Right temple / side profile view.",
    phase: "preoperative",
    region: "right_profile",
    purpose: "Document right temporal and lateral baseline.",
    required: true,
    visibleInUi: true,
    tips: ["Keep background plain", "Good lighting"],
    accept: "image/*",
    maxFiles: 2,
    minFiles: 1,
    mapsToAuditEvidenceKey: "patient_current_right",
  },
  {
    key: "preop_top",
    label: "Pre-op — Top",
    description: "Top-down view of scalp.",
    phase: "preoperative",
    region: "vertex",
    purpose: "Baseline midscalp/vertex density and coverage.",
    required: true,
    visibleInUi: true,
    tips: ["Take from above head", "Use mirror or helper if needed"],
    accept: "image/*",
    maxFiles: 3,
    minFiles: 1,
    mapsToAuditEvidenceKey: "patient_current_top",
  },
  {
    key: "preop_crown",
    label: "Pre-op — Crown",
    description: "Crown area coverage.",
    phase: "preoperative",
    region: "crown",
    purpose: "Baseline crown involvement when applicable.",
    required: true,
    visibleInUi: true,
    tips: ["Include crown region if involved in procedure"],
    accept: "image/*",
    maxFiles: 3,
    minFiles: 1,
    mapsToAuditEvidenceKey: "patient_current_crown",
  },
  {
    key: "preop_donor_rear",
    label: "Pre-op — Donor (rear)",
    description: "Back of head and donor zone coverage.",
    phase: "preoperative",
    region: "donor_posterior",
    purpose: "Document donor reserve and extraction zone before surgery.",
    required: true,
    visibleInUi: true,
    tips: ["Include whole donor region", "Add one close-up if possible"],
    accept: "image/*",
    maxFiles: 5,
    minFiles: 1,
    mapsToAuditEvidenceKey: "patient_current_donor_rear",
  },
  {
    key: "day0_recipient",
    label: "Day-of surgery — Recipient",
    description: "Recipient area (day of procedure or day after is fine).",
    phase: "day_of_surgery",
    region: "recipient_surgical",
    purpose: "Immediate post-implantation recipient documentation.",
    required: true,
    visibleInUi: true,
    tips: ["Clear view of graft placement"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 1,
    mapsToAuditEvidenceKey: "any_day0",
  },
  {
    key: "day0_donor",
    label: "Day-of surgery — Donor",
    description: "Donor area (day of procedure or day after is fine).",
    phase: "day_of_surgery",
    region: "donor_surgical",
    purpose: "Immediate post-extraction donor documentation.",
    required: true,
    visibleInUi: true,
    tips: ["Shows extraction sites"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 1,
    mapsToAuditEvidenceKey: "any_day0",
  },
  {
    key: "intraop",
    label: "Intra-op (Optional)",
    description: "Any additional photos taken during surgery.",
    phase: "perioperative",
    region: "supplemental",
    purpose: "Optional intraoperative context for reviewers.",
    required: false,
    visibleInUi: true,
    tips: ["Include graft placement close-ups if you have them"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
    mapsToAuditEvidenceKey: "any_day0",
  },
  {
    key: "postop_day0",
    label: "Post-op Day 0–3 (Optional)",
    description: "Immediate post-op healing photos.",
    phase: "early_postoperative",
    region: "supplemental",
    purpose: "Optional early healing and placement verification.",
    required: false,
    visibleInUi: true,
    tips: ["Good for verifying placement + early healing"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
    mapsToAuditEvidenceKey: "any_early_postop_day0_3",
  },
] as const satisfies readonly PatientUploadCategoryDef[];

export type PatientUploadCategoryKey = (typeof PATIENT_UPLOAD_CATEGORY_DEFS)[number]["key"];

/** Ordered keys required for the Basic patient photo set (storage / UI gating). */
export const REQUIRED_PATIENT_UPLOAD_CATEGORY_KEYS = PATIENT_UPLOAD_CATEGORY_DEFS.filter(
  (d) => d.required
).map((d) => d.key) as [PatientUploadCategoryKey, ...PatientUploadCategoryKey[]];

/**
 * Extra legacy upload raw keys (not primary UI categories) → audit normalization target.
 * Kept here beside PATIENT_UPLOAD_CATEGORY_DEFS so all patient legacy routing lives in one module.
 */
export const PATIENT_UPLOAD_LEGACY_EXTRA_KEYS: Readonly<
  Record<string, PatientAuditNormalizationTarget>
> = {
  donor_rear: "patient_current_donor_rear",
  donor: "patient_current_donor_rear",
};

/** Build the patient legacy map consumed by auditPhotoSchemas (lowercase keys). */
export function buildPatientUploadToAuditKeyMap(): Record<string, PatientAuditNormalizationTarget> {
  const m: Record<string, PatientAuditNormalizationTarget> = {};
  for (const d of PATIENT_UPLOAD_CATEGORY_DEFS) {
    m[d.key] = d.mapsToAuditEvidenceKey;
  }
  for (const [k, v] of Object.entries(PATIENT_UPLOAD_LEGACY_EXTRA_KEYS)) {
    m[k] = v;
  }
  return m;
}

export const PATIENT_AUDIT_PHOTO_BUCKET_DEFS: readonly PatientAuditPhotoBucketDef[] = [
  {
    key: "patient_current_front",
    title: "Front View (Required)",
    help: "Stand under bright indoor light. Hold your phone at eye level and take a straight-on photo of your hairline and front scalp. No filters. No flash glare.",
    quickTips: ["Neutral background", "Show full hairline", "No filters"],
    min: 1,
    max: 3,
    required: true,
  },
  {
    key: "patient_current_top",
    title: "Top View (Required)",
    help: "Take a photo from above your head showing the top of your scalp. Use a mirror or ask someone to help if needed.",
    quickTips: ["Bright room lighting", "Tilt head slightly forward", "Show whole top area"],
    min: 1,
    max: 3,
    required: true,
  },
  {
    key: "patient_current_donor_rear",
    title: "Donor Area — Rear (Required)",
    help: "Take a photo of the back of your head where grafts were taken. Show the full donor region.",
    quickTips: ["One wide photo", "One closer photo if possible", "Good lighting, no shadows"],
    min: 1,
    max: 3,
    required: true,
  },
  {
    key: "patient_current_left",
    title: "Left Side (Optional)",
    help: "Turn slightly and take a clear photo of your left temple and side profile.",
    min: 0,
    max: 2,
    required: false,
  },
  {
    key: "patient_current_right",
    title: "Right Side (Optional)",
    help: "Turn slightly and take a clear photo of your right temple and side profile.",
    min: 0,
    max: 2,
    required: false,
  },
  {
    key: "patient_current_crown",
    title: "Crown (Optional)",
    help: "If your crown was treated, take a photo of the back/top swirl area.",
    min: 0,
    max: 3,
    required: false,
  },
  {
    key: "any_preop",
    title: "Pre-Surgery Photos (Optional)",
    help: "Upload any photos taken before surgery. Even casual photos help.",
    min: 0,
    max: 10,
    required: false,
  },
  {
    key: "any_day0",
    title: "Day-of Surgery Photos (Optional)",
    help: "Photos from the day of surgery (recipient or donor area) help us compare technique and healing.",
    min: 0,
    max: 10,
    required: false,
  },
  {
    key: "any_early_postop_day0_3",
    title: "Early Healing Photos (Optional)",
    help: "Photos from the first few days after surgery show graft placement and donor healing.",
    min: 0,
    max: 10,
    required: false,
  },
];
