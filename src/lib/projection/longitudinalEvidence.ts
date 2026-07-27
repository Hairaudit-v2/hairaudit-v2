/**
 * HA-PROJECTION-1E — Canonical follow-up evidence role + stage provenance.
 *
 * Accepts patient_photo postop_month* aliases and clinic/doctor img_followup_*.
 * Does not rewrite stored categories or move storage objects.
 * Does not trust category names blindly when capture timing contradicts them.
 */

import type {
  LongitudinalEvidenceContext,
  LongitudinalEvidenceRole,
  LongitudinalOutcomeStage,
  ObservationConfidence,
  ProjectionUploadInput,
} from "./types";

export const LONGITUDINAL_OUTCOME_STAGES = [
  "month_3",
  "month_6",
  "month_9",
  "month_12",
] as const satisfies readonly LongitudinalOutcomeStage[];

/** Minimum evidence role for any stage. */
export const LONGITUDINAL_MINIMUM_ROLE: LongitudinalEvidenceRole = "followup_front";

/** Strongly recommended roles (treatment-aware crown handled separately). */
export const LONGITUDINAL_RECOMMENDED_ROLES: readonly LongitudinalEvidenceRole[] = [
  "followup_top",
  "followup_recipient_closeup",
  "followup_donor_rear",
];

/**
 * Category key (no prefix) → evidence role.
 * Month-banded patient keys carry stage separately via resolveLongitudinalOutcomeStage.
 */
const CATEGORY_ROLE_MAP: Readonly<Record<string, LongitudinalEvidenceRole>> = {
  // Patient milestone — month 3
  postop_month3_front: "followup_front",
  postop_month3_top: "followup_top",
  postop_month3_crown: "followup_crown",
  postop_month3_donor: "followup_donor_rear",
  // Patient milestone — month 6
  postop_month6_front: "followup_front",
  postop_month6_top: "followup_top",
  postop_month6_crown: "followup_crown",
  postop_month6_donor: "followup_donor_rear",
  // Patient milestone — month 9
  postop_month9_front: "followup_front",
  postop_month9_top: "followup_top",
  postop_month9_crown: "followup_crown",
  postop_month9_donor: "followup_donor_rear",
  // Patient milestone — month 12
  postop_month12_front: "followup_front",
  postop_month12_top: "followup_top",
  postop_month12_crown: "followup_crown",
  postop_month12_donor: "followup_donor_rear",

  // Patient close-ups (stage from timing / declared context)
  current_recipient_closeup: "followup_recipient_closeup",
  postop_wet_recipient: "followup_recipient_closeup",
  preop_donor_closeup: "followup_donor_closeup", // only when follow-up context; stage resolver gates

  // Patient current views (stage from timing / months_since)
  patient_current_front: "followup_front",
  patient_current_top: "followup_top",
  patient_current_donor_rear: "followup_donor_rear",
  patient_current_left: "followup_left",
  patient_current_right: "followup_right",

  // Clinic / doctor follow-up (not month-banded — stage from timing)
  img_followup_front: "followup_front",
  img_followup_top: "followup_top",
  img_followup_crown: "followup_crown",
  img_followup_donor: "followup_donor_rear",
};

const CATEGORY_STAGE_MAP: Readonly<Record<string, LongitudinalOutcomeStage>> = {
  postop_month3_front: "month_3",
  postop_month3_top: "month_3",
  postop_month3_crown: "month_3",
  postop_month3_donor: "month_3",
  postop_month6_front: "month_6",
  postop_month6_top: "month_6",
  postop_month6_crown: "month_6",
  postop_month6_donor: "month_6",
  postop_month9_front: "month_9",
  postop_month9_top: "month_9",
  postop_month9_crown: "month_9",
  postop_month9_donor: "month_9",
  postop_month12_front: "month_12",
  postop_month12_top: "month_12",
  postop_month12_crown: "month_12",
  postop_month12_donor: "month_12",
};

const MONTHS_BAND_TO_STAGE: Readonly<Record<string, LongitudinalOutcomeStage | null>> = {
  under_3: null,
  "3_6": "month_3",
  "6_9": "month_6",
  "9_12": "month_9",
  "12_plus": "month_12",
};

const STAGE_MONTH_CENTER: Readonly<Record<LongitudinalOutcomeStage, number>> = {
  month_3: 3,
  month_6: 6,
  month_9: 9,
  month_12: 12,
};

/** Inclusive month windows for stage acceptance from capture timing. */
const STAGE_MONTH_WINDOW: Readonly<
  Record<LongitudinalOutcomeStage, { min: number; max: number }>
> = {
  month_3: { min: 2, max: 4.5 },
  month_6: { min: 4.5, max: 7.5 },
  month_9: { min: 7.5, max: 10.5 },
  month_12: { min: 10.5, max: 18 },
};

export type ResolvedLongitudinalEvidence = {
  uploadId: string | null;
  rawType: string;
  prefix: string | null;
  categoryKey: string;
  role: LongitudinalEvidenceRole | null;
  /** Category-implied stage when month-banded; null for generic follow-up keys. */
  categoryStage: LongitudinalOutcomeStage | null;
};

export type ResolvedLongitudinalStage = {
  stage: LongitudinalOutcomeStage | null;
  /** Exact-stage use allowed when moderate or high. */
  stageConfidence: ObservationConfidence;
  /** When false, do not use this upload for exact-stage observation. */
  usableForExactStage: boolean;
  sources: string[];
  conflictReason: string | null;
};

export type LongitudinalEvidenceAssessment = {
  stage: LongitudinalOutcomeStage;
  sufficient: boolean;
  confidence: ObservationConfidence;
  presentRoles: LongitudinalEvidenceRole[];
  missingMinimumRoles: LongitudinalEvidenceRole[];
  missingRecommendedRoles: LongitudinalEvidenceRole[];
  limitations: string[];
  crownRelevant: boolean;
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
  return { prefix: null, categoryKey: raw };
}

function parseDateMs(value: unknown): number | null {
  if (value == null || value === "") return null;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

function readMetadataString(
  meta: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!meta) return null;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function monthsBetween(procedureMs: number, captureMs: number): number {
  return (captureMs - procedureMs) / (1000 * 60 * 60 * 24 * 30.4375);
}

function stageFromMonths(months: number): LongitudinalOutcomeStage | null {
  for (const stage of LONGITUDINAL_OUTCOME_STAGES) {
    const w = STAGE_MONTH_WINDOW[stage];
    if (months >= w.min && months < w.max) return stage;
  }
  return null;
}

function stagesAgree(
  a: LongitudinalOutcomeStage | null,
  b: LongitudinalOutcomeStage | null
): boolean {
  if (a == null || b == null) return true;
  return a === b;
}

/**
 * Normalize an upload into a canonical longitudinal evidence role.
 * Does not mutate storage.
 */
export function resolveLongitudinalEvidenceRole(
  upload: ProjectionUploadInput,
  _caseContext?: LongitudinalEvidenceContext // reserved for future treatment-aware role gates
): ResolvedLongitudinalEvidence {
  void _caseContext;
  const rawType = String(upload.type ?? "").trim();
  const { prefix, categoryKey } = parseUploadType(upload.type);
  const key = categoryKey.toLowerCase();
  const role = CATEGORY_ROLE_MAP[key] ?? CATEGORY_ROLE_MAP[categoryKey] ?? null;
  const categoryStage = CATEGORY_STAGE_MAP[key] ?? CATEGORY_STAGE_MAP[categoryKey] ?? null;

  return {
    uploadId: upload.id ?? null,
    rawType,
    prefix,
    categoryKey,
    role,
    categoryStage,
  };
}

/**
 * Resolve the longitudinal outcome stage for an upload.
 * Category names are hints only — timing provenance can reject exact-stage use.
 */
export function resolveLongitudinalOutcomeStage(
  upload: ProjectionUploadInput,
  caseContext: LongitudinalEvidenceContext = {}
): ResolvedLongitudinalStage {
  const resolved = resolveLongitudinalEvidenceRole(upload, caseContext);
  const meta = (upload.metadata ?? null) as Record<string, unknown> | null;
  const sources: string[] = [];

  const categoryStage = resolved.categoryStage;
  if (categoryStage) sources.push("category");

  let timingStage: LongitudinalOutcomeStage | null = null;
  const captureMs =
    parseDateMs(upload.captured_at) ??
    parseDateMs(meta?.captured_at) ??
    parseDateMs(meta?.capture_timestamp) ??
    parseDateMs(meta?.taken_at) ??
    parseDateMs(upload.created_at);

  const procedureMs = parseDateMs(caseContext.procedureDate);
  if (captureMs != null && procedureMs != null) {
    if (captureMs < procedureMs) {
      return {
        stage: null,
        stageConfidence: "low",
        usableForExactStage: false,
        sources: [...sources, "capture_before_procedure"],
        conflictReason: "Capture date is before procedure date — not usable as follow-up evidence.",
      };
    }
    const months = monthsBetween(procedureMs, captureMs);
    timingStage = stageFromMonths(months);
    if (timingStage) sources.push("capture_timing");
    else sources.push("capture_timing_out_of_window");
  }

  let bandStage: LongitudinalOutcomeStage | null = null;
  const band =
    caseContext.monthsSinceBand ??
    readMetadataString(meta, ["months_since", "monthsSince", "intake_months_since"]);
  if (band && band in MONTHS_BAND_TO_STAGE) {
    bandStage = MONTHS_BAND_TO_STAGE[band] ?? null;
    if (bandStage) sources.push("months_since_band");
    else sources.push("months_since_under_3");
  }

  let numericStage: LongitudinalOutcomeStage | null = null;
  if (
    caseContext.monthsSinceProcedure != null &&
    Number.isFinite(caseContext.monthsSinceProcedure)
  ) {
    numericStage = stageFromMonths(caseContext.monthsSinceProcedure);
    if (numericStage) sources.push("months_since_numeric");
  }

  const declaredStage = caseContext.declaredStage ?? null;
  if (declaredStage) sources.push("declared_stage");

  const candidates: Array<LongitudinalOutcomeStage | null> = [
    timingStage,
    categoryStage,
    bandStage,
    numericStage,
    declaredStage,
  ];

  // Detect hard conflicts between category and capture timing.
  if (categoryStage && timingStage && categoryStage !== timingStage) {
    return {
      stage: timingStage,
      stageConfidence: "low",
      usableForExactStage: false,
      sources,
      conflictReason: `Category implies ${categoryStage} but capture timing indicates ${timingStage}.`,
    };
  }

  if (categoryStage && bandStage && categoryStage !== bandStage && !timingStage) {
    return {
      stage: null,
      stageConfidence: "low",
      usableForExactStage: false,
      sources,
      conflictReason: `Category implies ${categoryStage} but months_since band indicates ${bandStage}.`,
    };
  }

  // Clinic/doctor generic follow-up without timing → uncertain
  const isGenericFollowup =
    !categoryStage &&
    (resolved.categoryKey.toLowerCase().startsWith("img_followup") ||
      resolved.categoryKey.toLowerCase().startsWith("patient_current_") ||
      resolved.categoryKey.toLowerCase() === "current_recipient_closeup");

  // Prefer timing when available; else category; else band/numeric/declared.
  const stage: LongitudinalOutcomeStage | null =
    timingStage ?? categoryStage ?? bandStage ?? numericStage ?? declaredStage;

  if (!stage) {
    return {
      stage: null,
      stageConfidence: "low",
      usableForExactStage: false,
      sources,
      conflictReason: isGenericFollowup
        ? "Generic follow-up category without timing provenance — exact stage cannot be determined."
        : "Unable to resolve a canonical longitudinal stage.",
    };
  }

  // Cross-check remaining signals for soft confidence reduction
  const disagreeing = candidates.filter(
    (c) => c != null && c !== stage
  ) as LongitudinalOutcomeStage[];

  if (disagreeing.length > 0) {
    return {
      stage,
      stageConfidence: "low",
      usableForExactStage: false,
      sources,
      conflictReason: `Stage signals disagree (resolved ${stage}; also saw ${disagreeing.join(", ")}).`,
    };
  }

  let stageConfidence: ObservationConfidence = "moderate";
  if (timingStage && categoryStage && stagesAgree(timingStage, categoryStage)) {
    stageConfidence = "high";
  } else if (timingStage && !categoryStage) {
    stageConfidence = "moderate";
  } else if (categoryStage && !timingStage && (bandStage === categoryStage || !bandStage)) {
    stageConfidence = "moderate";
  } else if (!timingStage && !categoryStage) {
    stageConfidence = "low";
  }

  // Reject very early postop for exact milestone use when only generic keys
  if (isGenericFollowup && stageConfidence === "low") {
    return {
      stage,
      stageConfidence: "low",
      usableForExactStage: false,
      sources,
      conflictReason: "Stage provenance is uncertain for exact-stage observation.",
    };
  }

  const usableForExactStage = stageConfidence !== "low";

  return {
    stage,
    stageConfidence,
    usableForExactStage,
    sources,
    conflictReason: usableForExactStage
      ? null
      : "Stage confidence is low — upload rejected for exact-stage use.",
  };
}

/** Whether crown follow-up is relevant given treated zones. */
export function isCrownRelevant(treatedAreas: string[] | null | undefined): boolean {
  if (!treatedAreas || treatedAreas.length === 0) return false;
  return treatedAreas.some((z) => /crown|vertex/i.test(String(z)));
}

/**
 * Assess evidence sufficiency for a resolved stage (treatment-aware).
 */
export function assessLongitudinalEvidence(args: {
  stage: LongitudinalOutcomeStage;
  presentRoles: LongitudinalEvidenceRole[];
  treatedAreas?: string[] | null;
  stageConfidence?: ObservationConfidence;
  imageQualityNotes?: string[];
}): LongitudinalEvidenceAssessment {
  const present = [...new Set(args.presentRoles)];
  const crownRelevant = isCrownRelevant(args.treatedAreas);
  const missingMinimum: LongitudinalEvidenceRole[] = [];
  if (!present.includes(LONGITUDINAL_MINIMUM_ROLE)) {
    missingMinimum.push(LONGITUDINAL_MINIMUM_ROLE);
  }

  const recommended = [...LONGITUDINAL_RECOMMENDED_ROLES];
  if (crownRelevant) recommended.push("followup_crown");

  const missingRecommended = recommended.filter((r) => !present.includes(r));

  const limitations: string[] = [];
  if (missingMinimum.length) {
    limitations.push("Minimum follow-up front view is missing.");
  }
  if (missingRecommended.length) {
    limitations.push(
      `Recommended follow-up views not present: ${missingRecommended.join(", ")}.`
    );
  }
  if (args.stageConfidence === "low") {
    limitations.push("Stage provenance confidence is low.");
  }
  for (const note of args.imageQualityNotes ?? []) {
    if (note.trim()) limitations.push(note.trim());
  }

  const viewCount = present.length;
  let confidence: ObservationConfidence = "low";
  if (
    missingMinimum.length === 0 &&
    missingRecommended.length === 0 &&
    args.stageConfidence !== "low" &&
    viewCount >= 4
  ) {
    confidence = "high";
  } else if (missingMinimum.length === 0 && viewCount >= 2 && args.stageConfidence !== "low") {
    confidence = "moderate";
  } else if (missingMinimum.length === 0 && viewCount === 1) {
    confidence = args.stageConfidence === "high" ? "moderate" : "low";
  } else {
    confidence = "low";
  }

  if (args.stageConfidence === "low") {
    confidence = "low";
  }

  return {
    stage: args.stage,
    sufficient: missingMinimum.length === 0,
    confidence,
    presentRoles: present,
    missingMinimumRoles: missingMinimum,
    missingRecommendedRoles: missingRecommended,
    limitations,
    crownRelevant,
  };
}

/** List accepted category aliases for documentation / tests. */
export function listLongitudinalCategoryAliases(): Readonly<
  Record<string, LongitudinalEvidenceRole>
> {
  return CATEGORY_ROLE_MAP;
}

export function listLongitudinalCategoryStages(): Readonly<
  Record<string, LongitudinalOutcomeStage>
> {
  return CATEGORY_STAGE_MAP;
}

export function stageMonthCenter(stage: LongitudinalOutcomeStage): number {
  return STAGE_MONTH_CENTER[stage];
}
