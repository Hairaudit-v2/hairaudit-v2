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
  | "early_postoperative"
  | "intraoperative"
  | "follow_up";

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
  | "supplemental"
  | "donor_left"
  | "donor_right"
  | "donor_closeup"
  | "recipient_healing"
  | "operative_field"
  | "graft_handling"
  | "outcome_documentation";

/** Target key after normalizeToPatientKey() in auditPhotoSchemas (legacy map). Omit for Stage-2-only categories until audit buckets exist. */
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
  /** If omitted, this upload key is accepted by API/Zod but does not map into legacy audit buckets. */
  readonly mapsToAuditEvidenceKey?: PatientAuditNormalizationTarget | null;
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
    label: "Before Surgery — Front View",
    description:
      "These are photos taken before your hair transplant. Face and hairline, straight on. Use bright indoor light.",
    phase: "preoperative",
    region: "front",
    purpose: "Anterior scalp and hairline documentation.",
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
    label: "Before Surgery — Left Side",
    description:
      "These are photos taken before your hair transplant. Your left side so we can see your hair from the side.",
    phase: "preoperative",
    region: "left_profile",
    purpose: "Left temple and side profile documentation.",
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
    label: "Before Surgery — Right Side",
    description:
      "These are photos taken before your hair transplant. Your right side so we can see your hair from the side.",
    phase: "preoperative",
    region: "right_profile",
    purpose: "Right temple and side profile documentation.",
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
    label: "Before Surgery — Top View",
    description:
      "These are photos taken before your hair transplant. Hold the camera above your head, looking down at your scalp.",
    phase: "preoperative",
    region: "vertex",
    purpose: "Top of scalp documentation.",
    required: true,
    visibleInUi: true,
    tips: ["Take from above your head", "Use a mirror or ask someone to help"],
    accept: "image/*",
    maxFiles: 3,
    minFiles: 1,
    mapsToAuditEvidenceKey: "patient_current_top",
  },
  {
    key: "preop_crown",
    label: "Before Surgery — Crown",
    description:
      "These are photos taken before your hair transplant. The top-back of your head (the swirl), if that area was treated.",
    phase: "preoperative",
    region: "crown",
    purpose: "Crown area documentation when applicable.",
    required: true,
    visibleInUi: true,
    tips: ["Tilt your head so the swirl is easy to see"],
    accept: "image/*",
    maxFiles: 3,
    minFiles: 1,
    mapsToAuditEvidenceKey: "patient_current_crown",
  },
  {
    key: "preop_donor_rear",
    label: "Before Surgery — Back of Head",
    description:
      "These are photos taken before your hair transplant. The back of your head where hair was taken or will be taken.",
    phase: "preoperative",
    region: "donor_posterior",
    purpose: "Back of head before surgery.",
    required: true,
    visibleInUi: true,
    tips: ["Show the full back of the head", "One closer photo is helpful if you can"],
    accept: "image/*",
    maxFiles: 5,
    minFiles: 1,
    mapsToAuditEvidenceKey: "patient_current_donor_rear",
  },
  {
    key: "day0_recipient",
    label: "Surgery Day — Hairline",
    description: "The hairline area on surgery day or the next day.",
    phase: "day_of_surgery",
    region: "recipient_surgical",
    purpose: "Hairline area on surgery day.",
    required: true,
    visibleInUi: true,
    tips: ["Show the area clearly in good light"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 1,
    mapsToAuditEvidenceKey: "any_day0",
  },
  {
    key: "day0_donor",
    label: "Surgery Day — Back of Head",
    description: "The back of your head on surgery day or the next day.",
    phase: "day_of_surgery",
    region: "donor_surgical",
    purpose: "Back of head on surgery day.",
    required: true,
    visibleInUi: true,
    tips: ["Show the back of the head clearly"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 1,
    mapsToAuditEvidenceKey: "any_day0",
  },
  {
    key: "intraop",
    label: "Surgery Day — During Procedure",
    description: "Photos from during the procedure, if you have them.",
    phase: "perioperative",
    region: "supplemental",
    purpose: "Optional photos from during surgery.",
    required: false,
    visibleInUi: true,
    tips: ["Close-ups of the hairline area if your clinic shared them"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
    mapsToAuditEvidenceKey: "any_day0",
  },
  {
    key: "postop_day0",
    label: "Early Healing — First Few Days",
    description: "Photos from the first few days after surgery.",
    phase: "early_postoperative",
    region: "supplemental",
    purpose: "Optional early healing photos.",
    required: false,
    visibleInUi: true,
    tips: ["Same angles as your surgery-day photos if you can"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
    mapsToAuditEvidenceKey: "any_early_postop_day0_3",
  },

  /* ----- Stage 2: optional, backend-ready, hidden from UI until release ----- */

  {
    key: "preop_donor_left",
    label: "Before Surgery — Donor (left)",
    description: "Left lateral donor and posterior scalp prior to surgery.",
    phase: "preoperative",
    region: "donor_left",
    purpose: "Donor zone baseline and symmetry for monitoring.",
    required: false,
    visibleInUi: false,
    tips: ["Include full left donor transition", "Even lighting"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "preop_donor_right",
    label: "Before Surgery — Donor (right)",
    description: "Right lateral donor and posterior scalp prior to surgery.",
    phase: "preoperative",
    region: "donor_right",
    purpose: "Donor zone baseline and symmetry for monitoring.",
    required: false,
    visibleInUi: false,
    tips: ["Include full right donor transition", "Even lighting"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "preop_donor_closeup",
    label: "Before Surgery — Donor close-up",
    description: "Close-up of donor hair density and calibre before extraction.",
    phase: "preoperative",
    region: "donor_closeup",
    purpose: "Supports graft quality and donor physics estimation.",
    required: false,
    visibleInUi: false,
    tips: ["Fill frame with donor scalp", "Avoid motion blur"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "day0_donor_rear",
    label: "Surgery Day — Back of Head (center)",
    description: "Posterior donor immediately after extraction.",
    phase: "day_of_surgery",
    region: "donor_posterior",
    purpose: "Document extraction pattern and acute donor healing.",
    required: false,
    visibleInUi: false,
    tips: ["Show complete harvested area", "Neutral angle"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
  {
    key: "day0_donor_left",
    label: "Surgery Day — Back of Head (left)",
    description: "Left donor periphery on surgery day.",
    phase: "day_of_surgery",
    region: "donor_left",
    purpose: "Lateral donor healing and punch pattern context.",
    required: false,
    visibleInUi: false,
    tips: ["Same angle as your before-surgery left-side photo if you can"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "day0_donor_right",
    label: "Surgery Day — Back of Head (right)",
    description: "Right donor periphery on surgery day.",
    phase: "day_of_surgery",
    region: "donor_right",
    purpose: "Lateral donor healing and punch pattern context.",
    required: false,
    visibleInUi: false,
    tips: ["Same angle as your before-surgery right-side photo if you can"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "day0_donor_closeup",
    label: "Surgery Day — Back of Head (close-up)",
    description: "Close-up of follicle sites or donor crusting day of surgery.",
    phase: "day_of_surgery",
    region: "donor_closeup",
    purpose: "Fine-detail donor recovery and technique signals.",
    required: false,
    visibleInUi: false,
    tips: ["Steady hand", "Macro mode if available"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
  {
    key: "postop_day1_donor",
    label: "Day After Surgery — Back of Head",
    description: "Donor area approximately one day after surgery.",
    phase: "early_postoperative",
    region: "donor_surgical",
    purpose: "Early donor monitoring and complications screening.",
    required: false,
    visibleInUi: false,
    tips: ["Same angles as day 0 when possible"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
    mapsToAuditEvidenceKey: "any_early_postop_day0_3",
  },
  {
    key: "postop_week1_donor",
    label: "1 Week Photos — Back of Head",
    description: "Donor healing around one week post-op.",
    phase: "early_postoperative",
    region: "donor_surgical",
    purpose: "Track donor recovery trajectory and scarring risk.",
    required: false,
    visibleInUi: false,
    tips: ["Document erythema, crusting, or irregularity"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
    mapsToAuditEvidenceKey: "any_early_postop_day0_3",
  },
  {
    key: "postop_month3_donor",
    label: "3 Month Photos — Back of Head",
    description: "Donor region at roughly three months.",
    phase: "follow_up",
    region: "donor_surgical",
    purpose: "Intermediate donor outcome and density contrast.",
    required: false,
    visibleInUi: false,
    tips: ["Use the same lighting as your earlier photos if you can"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
  {
    key: "postop_month6_donor",
    label: "6 Month Photos — Back of Head",
    description: "Donor region at roughly six months.",
    phase: "follow_up",
    region: "donor_surgical",
    purpose: "Donor maturation and scar assessment window.",
    required: false,
    visibleInUi: false,
    tips: ["Wide plus close-up"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
  {
    key: "postop_month9_donor",
    label: "9 Month Photos — Back of Head",
    description: "Donor region at roughly nine months.",
    phase: "follow_up",
    region: "donor_surgical",
    purpose: "Extended donor monitoring for certification-grade records.",
    required: false,
    visibleInUi: false,
    tips: ["Same angles as your earlier month photos if you can"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
  {
    key: "postop_month12_donor",
    label: "12 Month Photos — Back of Head",
    description: "Donor region at roughly twelve months.",
    phase: "follow_up",
    region: "donor_surgical",
    purpose: "Long-term donor outcome documentation.",
    required: false,
    visibleInUi: false,
    tips: ["Show color and texture clearly in good light"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
  {
    key: "postop_day1_recipient",
    label: "Day After Surgery — Hairline",
    description: "Recipient sites approximately one day after implantation.",
    phase: "early_postoperative",
    region: "recipient_healing",
    purpose: "Early graft retention and crust pattern review.",
    required: false,
    visibleInUi: false,
    tips: ["Avoid harsh flash", "Show hairline and midscalp if treated"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
    mapsToAuditEvidenceKey: "any_early_postop_day0_3",
  },
  {
    key: "postop_week1_recipient",
    label: "1 Week Photos — Hairline",
    description: "Recipient zone around one week post-op.",
    phase: "early_postoperative",
    region: "recipient_healing",
    purpose: "Early recovery trajectory and shock-loss baseline.",
    required: false,
    visibleInUi: false,
    tips: ["Repeat standard photo angles"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
    mapsToAuditEvidenceKey: "any_early_postop_day0_3",
  },
  {
    key: "intraop_extraction",
    label: "Surgery Day — Hair removal step",
    description: "Extraction phase documentation (devices, depth cues, field).",
    phase: "intraoperative",
    region: "operative_field",
    purpose: "AI-assisted extraction technique and follicle handling context.",
    required: false,
    visibleInUi: false,
    tips: ["No patient identifiers in frame", "Steady exposure"],
    accept: "image/*",
    maxFiles: 8,
    minFiles: 0,
  },
  {
    key: "intraop_donor_closeup",
    label: "Surgery Day — Back of Head (close-up)",
    description: "Close-up donor during extraction.",
    phase: "intraoperative",
    region: "donor_closeup",
    purpose: "Transection and spacing cues for graft handling review.",
    required: false,
    visibleInUi: false,
    tips: ["Macro focus on punch/sites"],
    accept: "image/*",
    maxFiles: 8,
    minFiles: 0,
  },
  {
    key: "intraop_recipient_sites",
    label: "Surgery Day — Before grafts are placed",
    description: "Sites or slits prior to implantation.",
    phase: "intraoperative",
    region: "recipient_surgical",
    purpose: "Density, angle, and pattern design review.",
    required: false,
    visibleInUi: false,
    tips: ["Capture hairline transition zone if treated"],
    accept: "image/*",
    maxFiles: 8,
    minFiles: 0,
  },
  {
    key: "intraop_implantation",
    label: "Surgery Day — Grafts going in",
    description: "Grafts placed or placement in progress.",
    phase: "intraoperative",
    region: "operative_field",
    purpose: "Implantation technique and graft seating documentation.",
    required: false,
    visibleInUi: false,
    tips: ["Avoid glare from surgical lights"],
    accept: "image/*",
    maxFiles: 8,
    minFiles: 0,
  },
  {
    key: "graft_tray_overview",
    label: "Graft tray — Overview",
    description: "Tray-level organization, grouping, and hydration.",
    phase: "intraoperative",
    region: "graft_handling",
    purpose: "Sorting quality, dehydration risk, and throughput signals.",
    required: false,
    visibleInUi: false,
    tips: ["Top-down, even lighting across tray"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "graft_tray_closeup",
    label: "Graft tray — Close-up",
    description: "Macro view of grafts on tray or in medium.",
    phase: "intraoperative",
    region: "graft_handling",
    purpose: "Graft integrity, bulb/stem visuals, forensic audit support.",
    required: false,
    visibleInUi: false,
    tips: ["Fill frame with representative grafts"],
    accept: "image/*",
    maxFiles: 8,
    minFiles: 0,
  },
  {
    key: "graft_sorting",
    label: "Graft handling — Sorting",
    description: "Sorting singles, doubles, or groupings.",
    phase: "intraoperative",
    region: "graft_handling",
    purpose: "Labor discipline and graft class consistency.",
    required: false,
    visibleInUi: false,
    tips: ["Label reference if visible in clinic workflow"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
  {
    key: "graft_hydration_solution",
    label: "Graft handling — Hydration / holding solution",
    description: "Holding solution, temperature cues, or irrigation.",
    phase: "intraoperative",
    region: "graft_handling",
    purpose: "Dehydration and tissue burden risk indicators.",
    required: false,
    visibleInUi: false,
    tips: ["Capture fluid level and graft submersion"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "graft_count_board",
    label: "Graft handling — Count board",
    description: "Graft counts, boards, or tally documentation.",
    phase: "intraoperative",
    region: "graft_handling",
    purpose: "Reconciliation between claimed and documented grafts.",
    required: false,
    visibleInUi: false,
    tips: ["Legible numbers; no PHI"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month3_front",
    label: "3 Month Photos — Front",
    description: "Frontal outcome at ~3 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Early growth and styling camouflage assessment.",
    required: false,
    visibleInUi: false,
    tips: ["Same pose as your front photo before surgery"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month3_top",
    label: "3 Month Photos — Top",
    description: "Vertex/top outcome at ~3 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Midscalp density emergence tracking.",
    required: false,
    visibleInUi: false,
    tips: ["Same overhead angle as your top photo before surgery"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month3_crown",
    label: "3 Month Photos — Crown",
    description: "Crown outcome at ~3 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Crown coverage progression.",
    required: false,
    visibleInUi: false,
    tips: ["Tilt to expose swirl if needed"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month6_front",
    label: "6 Month Photos — Front",
    description: "Frontal outcome at ~6 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Mid-cycle growth and hairline maturation.",
    required: false,
    visibleInUi: false,
    tips: ["Natural indoor light preferred"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month6_top",
    label: "6 Month Photos — Top",
    description: "Vertex/top outcome at ~6 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Assess midscalp cosmetic density.",
    required: false,
    visibleInUi: false,
    tips: ["Pull hair to reveal scalp if long"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month6_crown",
    label: "6 Month Photos — Crown",
    description: "Crown outcome at ~6 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Crown fill-in trajectory for longitudinal scoring.",
    required: false,
    visibleInUi: false,
    tips: ["Same angle as your 3-month crown photo, if you have one"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month9_front",
    label: "9 Month Photos — Front",
    description: "Frontal outcome at ~9 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Late-cycle refinement and styling density.",
    required: false,
    visibleInUi: false,
    tips: ["Document hairline softness"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month9_top",
    label: "9 Month Photos — Top",
    description: "Vertex/top outcome at ~9 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Vertex cosmetic completeness prior to 12m benchmark.",
    required: false,
    visibleInUi: false,
    tips: ["Consistent focal length"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month9_crown",
    label: "9 Month Photos — Crown",
    description: "Crown outcome at ~9 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Crown outcomes prior to annual review.",
    required: false,
    visibleInUi: false,
    tips: ["Even overhead lighting"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month12_front",
    label: "12 Month Photos — Front",
    description: "Frontal outcome at ~12 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Primary annual outcome benchmark (frontal).",
    required: false,
    visibleInUi: false,
    tips: ["Same pose as your front photo before surgery"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month12_top",
    label: "12 Month Photos — Top",
    description: "Vertex/top outcome at ~12 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Primary annual outcome benchmark (vertex).",
    required: false,
    visibleInUi: false,
    tips: ["Document part/density"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month12_crown",
    label: "12 Month Photos — Crown",
    description: "Crown outcome at ~12 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Primary annual outcome benchmark (crown).",
    required: false,
    visibleInUi: false,
    tips: ["Full crown in frame"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
] as const satisfies readonly PatientUploadCategoryDef[];

export type PatientUploadCategoryKey = (typeof PATIENT_UPLOAD_CATEGORY_DEFS)[number]["key"];

/** Ordered keys required for the Basic patient photo set (storage / UI gating). */
export const REQUIRED_PATIENT_UPLOAD_CATEGORY_KEYS = PATIENT_UPLOAD_CATEGORY_DEFS.filter(
  (d) => d.required
).map((d) => d.key) as [PatientUploadCategoryKey, ...PatientUploadCategoryKey[]];

/** Stage-2 optional keys accepted by API/config but hidden from default patient UI. */
export const STAGE2_HIDDEN_PATIENT_UPLOAD_KEYS = PATIENT_UPLOAD_CATEGORY_DEFS.filter(
  (d) => !d.visibleInUi
).map((d) => d.key) as readonly PatientUploadCategoryKey[];

/**
 * Extra legacy upload raw keys (not primary UI categories) → audit normalization target.
 * Kept here beside PATIENT_UPLOAD_CATEGORY_DEFS so all patient legacy routing lives in one module.
 */
/** Raw upload keys not covered by PATIENT_UPLOAD_CATEGORY_DEFS (historical type strings). */
export const PATIENT_UPLOAD_LEGACY_EXTRA_KEYS: Readonly<
  Record<string, PatientAuditNormalizationTarget>
> = {
  donor_rear: "patient_current_donor_rear",
};

/** Build the patient legacy map consumed by auditPhotoSchemas (lowercase keys). */
export function buildPatientUploadToAuditKeyMap(): Record<string, PatientAuditNormalizationTarget> {
  const m: Record<string, PatientAuditNormalizationTarget> = {};
  for (const d of PATIENT_UPLOAD_CATEGORY_DEFS) {
    if (!("mapsToAuditEvidenceKey" in d) || d.mapsToAuditEvidenceKey == null) continue;
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
    title: "Your Hair Today — Front View (Required)",
    help: "These photos should show your hair as it looks today. Stand under bright indoor light, hold your phone at eye level, straight-on to your hairline. No filters.",
    quickTips: ["Neutral background", "Show full hairline", "No filters"],
    min: 1,
    max: 3,
    required: true,
  },
  {
    key: "patient_current_top",
    title: "Your Hair Today — Top View (Required)",
    help: "These photos should show your hair as it looks today. Take a photo from above your head showing the top of your scalp.",
    quickTips: ["Bright room lighting", "Tilt head slightly forward", "Show whole top area"],
    min: 1,
    max: 3,
    required: true,
  },
  {
    key: "patient_current_donor_rear",
    title: "Your Hair Today — Back of Head (Required)",
    help: "These photos should show your hair as it looks today. Show the full back of your head where grafts were taken or will be taken.",
    quickTips: ["One wide photo", "One closer photo if possible", "Good lighting, no shadows"],
    min: 1,
    max: 3,
    required: true,
  },
  {
    key: "patient_current_left",
    title: "Your Hair Today — Left Side",
    help: "These photos should show your hair as it looks today. Turn slightly and take a clear photo of your left side and hairline.",
    min: 0,
    max: 2,
    required: false,
  },
  {
    key: "patient_current_right",
    title: "Your Hair Today — Right Side",
    help: "These photos should show your hair as it looks today. Turn slightly and take a clear photo of your right side and hairline.",
    min: 0,
    max: 2,
    required: false,
  },
  {
    key: "patient_current_crown",
    title: "Your Hair Today — Crown",
    help: "These photos should show your hair as it looks today. If the top-back of your head was treated, take a photo of the swirl area.",
    min: 0,
    max: 3,
    required: false,
  },
  {
    key: "any_preop",
    title: "Before Surgery Photos (Optional)",
    help: "These are photos taken before your hair transplant. Casual photos are fine.",
    min: 0,
    max: 10,
    required: false,
  },
  {
    key: "any_day0",
    title: "Surgery Day Photos (Optional)",
    help: "Photos from surgery day: hairline or back of head.",
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
