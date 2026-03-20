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

  /* ----- Stage 2: optional, backend-ready, hidden from UI until release ----- */

  {
    key: "preop_donor_left",
    label: "Pre-op — Donor (left)",
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
    label: "Pre-op — Donor (right)",
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
    label: "Pre-op — Donor close-up",
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
    label: "Day 0 — Donor (rear)",
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
    label: "Day 0 — Donor (left)",
    description: "Left donor periphery on surgery day.",
    phase: "day_of_surgery",
    region: "donor_left",
    purpose: "Lateral donor healing and punch pattern context.",
    required: false,
    visibleInUi: false,
    tips: ["Match angle to pre-op left donor if possible"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "day0_donor_right",
    label: "Day 0 — Donor (right)",
    description: "Right donor periphery on surgery day.",
    phase: "day_of_surgery",
    region: "donor_right",
    purpose: "Lateral donor healing and punch pattern context.",
    required: false,
    visibleInUi: false,
    tips: ["Match angle to pre-op right donor if possible"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "day0_donor_closeup",
    label: "Day 0 — Donor close-up",
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
    label: "Post-op Day 1 — Donor",
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
  },
  {
    key: "postop_week1_donor",
    label: "Post-op Week 1 — Donor",
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
  },
  {
    key: "postop_month3_donor",
    label: "Post-op Month 3 — Donor",
    description: "Donor region at roughly three months.",
    phase: "follow_up",
    region: "donor_surgical",
    purpose: "Intermediate donor outcome and density contrast.",
    required: false,
    visibleInUi: false,
    tips: ["Consistent lighting vs baseline"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
  {
    key: "postop_month6_donor",
    label: "Post-op Month 6 — Donor",
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
    label: "Post-op Month 9 — Donor",
    description: "Donor region at roughly nine months.",
    phase: "follow_up",
    region: "donor_surgical",
    purpose: "Extended donor monitoring for certification-grade records.",
    required: false,
    visibleInUi: false,
    tips: ["Same angles as prior milestones"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
  {
    key: "postop_month12_donor",
    label: "Post-op Month 12 — Donor",
    description: "Donor region at roughly twelve months.",
    phase: "follow_up",
    region: "donor_surgical",
    purpose: "Long-term donor outcome documentation.",
    required: false,
    visibleInUi: false,
    tips: ["Document color and texture match to baseline"],
    accept: "image/*",
    maxFiles: 6,
    minFiles: 0,
  },
  {
    key: "postop_day1_recipient",
    label: "Post-op Day 1 — Recipient",
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
  },
  {
    key: "postop_week1_recipient",
    label: "Post-op Week 1 — Recipient",
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
  },
  {
    key: "intraop_extraction",
    label: "Intra-op — Extraction",
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
    label: "Intra-op — Donor close-up",
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
    label: "Intra-op — Recipient sites",
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
    label: "Intra-op — Implantation",
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
    label: "Post-op Month 3 — Front",
    description: "Frontal outcome at ~3 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Early growth and styling camouflage assessment.",
    required: false,
    visibleInUi: false,
    tips: ["Same pose as pre-op front"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month3_top",
    label: "Post-op Month 3 — Top",
    description: "Vertex/top outcome at ~3 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Midscalp density emergence tracking.",
    required: false,
    visibleInUi: false,
    tips: ["Overhead consistent with pre-op top"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month3_crown",
    label: "Post-op Month 3 — Crown",
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
    label: "Post-op Month 6 — Front",
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
    label: "Post-op Month 6 — Top",
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
    label: "Post-op Month 6 — Crown",
    description: "Crown outcome at ~6 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Crown fill-in trajectory for longitudinal scoring.",
    required: false,
    visibleInUi: false,
    tips: ["Compare to month 3 crown if available"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month9_front",
    label: "Post-op Month 9 — Front",
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
    label: "Post-op Month 9 — Top",
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
    label: "Post-op Month 9 — Crown",
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
    label: "Post-op Month 12 — Front",
    description: "Frontal outcome at ~12 months.",
    phase: "follow_up",
    region: "outcome_documentation",
    purpose: "Primary annual outcome benchmark (frontal).",
    required: false,
    visibleInUi: false,
    tips: ["Match pre-op front pose"],
    accept: "image/*",
    maxFiles: 4,
    minFiles: 0,
  },
  {
    key: "postop_month12_top",
    label: "Post-op Month 12 — Top",
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
    label: "Post-op Month 12 — Crown",
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
