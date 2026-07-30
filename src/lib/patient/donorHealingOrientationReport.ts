/**
 * HA-DONOR-HEALING-1B — Report-side donor healing orientation mapping,
 * evidence sufficiency, stage-aware language, provenance, and patient-safe
 * projection. Longitudinal comparison / heatmaps remain out of scope (1C).
 */

import {
  DONOR_HEALING_ENTRY_CONTEXT,
  DONOR_HEALING_ORIENTATION_LABELS,
  DONOR_HEALING_ORIENTATION_STATES,
  DONOR_RED_FLAG_WARNING_COPY,
  answersIncludeDonorRedFlags,
  containsForbiddenDonorDiagnosticLanguage,
  donorHealingOrientationLabel,
  isDonorHealingEntryContext,
  parsePostSurgeryConcern,
  type DonorHealingOrientation,
} from "@/lib/patient/donorHealingEntry";
import { sanitizePatientReportText } from "@/lib/reports/postSurgeryPatientText";

export const DONOR_HEALING_ORIENTATION_REPORT_VERSION = 1 as const;

/** How the orientation currently shown was produced. */
export type DonorOrientationProvenanceSource =
  | "automated_preparation"
  | "clinician_confirmation"
  | "clinician_correction";

export type DonorOrientationEvidence = {
  sufficient: boolean;
  donorViewCount: number;
  hasDonorRear: boolean;
  hasDonorLeft: boolean;
  hasDonorRight: boolean;
  hasProcedureDate: boolean;
  hasMonthsSinceBand: boolean;
  hasTimingContext: boolean;
  monthsSinceBand: string | null;
  procedureDate: string | null;
  stageGroup: "under_3_months" | "3_months_or_more" | "unknown";
  reasons: string[];
};

export type DonorOrientationProvenanceEvent = {
  at: string;
  source: DonorOrientationProvenanceSource;
  state: DonorHealingOrientation;
  /** Auditor user id — internal only; never rendered to patients. */
  actorUserId?: string | null;
  previousState?: DonorHealingOrientation | null;
};

export type DonorOrientationProvenance = {
  source: DonorOrientationProvenanceSource;
  preparedAt: string;
  /** True when the first mapping was system-generated. */
  preparedBySystem: boolean;
  confirmedAt?: string | null;
  confirmedByUserId?: string | null;
  correctedFrom?: DonorHealingOrientation | null;
  history: DonorOrientationProvenanceEvent[];
};

/**
 * Full record stored on `reports.summary.donor_healing_orientation`.
 * Patient surfaces must use `toPatientSafeDonorOrientationSlice`.
 */
export type DonorHealingOrientationRecord = {
  version: typeof DONOR_HEALING_ORIENTATION_REPORT_VERSION;
  entryContext: typeof DONOR_HEALING_ENTRY_CONTEXT;
  state: DonorHealingOrientation;
  patientLabel: string;
  stageAwareNarrative: string;
  escalationCopy: string | null;
  evidence: DonorOrientationEvidence;
  provenance: DonorOrientationProvenance;
};

/** Patient / PDF-safe slice — no actor ids, no internal history details. */
export type PatientSafeDonorOrientationSlice = {
  state: DonorHealingOrientation;
  label: string;
  stageAwareNarrative: string;
  escalationCopy: string | null;
  evidenceSufficient: boolean;
  stageGroup: DonorOrientationEvidence["stageGroup"];
  /** Human-readable provenance without clinician identity. */
  provenanceLabel: string;
  provenanceSource: DonorOrientationProvenanceSource;
};

export type BuildDonorOrientationInput = {
  answers?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  uploadTypes?: readonly string[] | null;
  photosByCategory?: Record<string, unknown> | null;
  now?: Date;
};

const REAR_NEEDLES = ["donor_rear", "postop_healed_donor", "followup_donor"] as const;
const LEFT_NEEDLES = ["donor_left"] as const;
const RIGHT_NEEDLES = ["donor_right"] as const;

const EARLY_MONTHS_BANDS = new Set([
  "under_3",
  "days_1_3",
  "days_4_7",
  "days_8_14",
  "weeks_3_8",
]);

const STAGE_NARRATIVES: Record<
  DonorHealingOrientation,
  Record<"under_3_months" | "3_months_or_more" | "unknown", string>
> = {
  compatible_with_reported_stage: {
    under_3_months:
      "At this early healing stage, the available donor views appear broadly compatible with expected short-term healing change. Long-term uniformity still cannot be judged yet.",
    "3_months_or_more":
      "Relative to the reported healing stage, the available donor views appear broadly compatible with expected appearance. This is an orientation for discussion, not a diagnosis.",
    unknown:
      "Based on the available donor views, appearance appears broadly compatible with the reported healing stage. Timing context would strengthen this orientation.",
  },
  too_early_to_assess_homogeneity: {
    under_3_months:
      "It is still early in the healing timeline. Temporary redness, dotted texture, and shedding can dominate appearance, so long-term donor uniformity cannot be assessed reliably yet.",
    "3_months_or_more":
      "Even after several months, the available evidence still does not support a long-term uniformity conclusion. Additional comparable donor views and timing context would help.",
    unknown:
      "Long-term donor uniformity cannot be assessed reliably from the current materials and timing context.",
  },
  temporary_shedding_may_contribute: {
    under_3_months:
      "Early donor change often includes temporary shedding. The submitted views are consistent with shedding contributing to uneven appearance during this stage.",
    "3_months_or_more":
      "Temporary donor shedding may still contribute to uneven appearance at this stage. Structured follow-up photos over time help separate shedding from longer-term irregularity.",
    unknown:
      "Temporary donor shedding may be contributing to the appearance in the available views.",
  },
  persistent_irregularity_deserves_review: {
    under_3_months:
      "Even in early healing, the reported trend and available views suggest persistent irregularity that deserves structured clinical discussion rather than photo-only reassurance.",
    "3_months_or_more":
      "At this stage, persistent donor irregularity deserves structured review with your treating clinic or an independent clinician using the submitted evidence as discussion support.",
    unknown:
      "Persistent donor irregularity deserves structured review rather than photo-only conclusions.",
  },
  direct_clinical_assessment_recommended: {
    under_3_months:
      "Reported symptoms or concerning findings mean direct clinical assessment is recommended. Photograph review does not replace urgent or in-person care.",
    "3_months_or_more":
      "Reported symptoms or concerning findings mean direct clinical assessment is recommended. Photograph review does not replace urgent or in-person care.",
    unknown:
      "Direct clinical assessment is recommended. Photograph review does not replace urgent or in-person care.",
  },
  insufficient_evidence: {
    under_3_months:
      "Clear multi-angle donor photographs and a confirmed procedure timing are needed before a stage-aware orientation can be offered reliably.",
    "3_months_or_more":
      "Clear multi-angle donor photographs (rear, left, and right where possible) are needed before a reliable stage-aware orientation can be offered.",
    unknown:
      "The available photographs and timing context are insufficient to assess this reliably.",
  },
};

export function isDonorHealingOrientation(
  value: unknown
): value is DonorHealingOrientation {
  return (
    typeof value === "string" &&
    (DONOR_HEALING_ORIENTATION_STATES as readonly string[]).includes(value)
  );
}

export function caseHasDonorHealingEntryContext(input: {
  answers?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
}): boolean {
  const summary = input.summary ?? null;
  const answers = input.answers ?? null;
  if (isDonorHealingEntryContext(summary?.entry_context)) return true;
  if (isDonorHealingEntryContext(answers?.entry_context)) return true;
  if (parsePostSurgeryConcern(summary?.primary_donor_concern)) return true;
  if (parsePostSurgeryConcern(answers?.primary_donor_concern)) return true;
  return false;
}

function categoryHitsNeedle(category: string, needles: readonly string[]): boolean {
  const c = category.toLowerCase();
  return needles.some((n) => c.includes(n));
}

/** Detect donor rear / left / right presence from upload types or photo category maps. */
export function detectDonorPhotoPresence(input: {
  uploadTypes?: readonly string[] | null;
  photosByCategory?: Record<string, unknown> | null;
}): {
  hasDonorRear: boolean;
  hasDonorLeft: boolean;
  hasDonorRight: boolean;
  donorViewCount: number;
} {
  const cats = new Set<string>();
  for (const raw of input.uploadTypes ?? []) {
    const t = String(raw ?? "").toLowerCase();
    if (!t) continue;
    const stripped = t.startsWith("patient_photo:") ? t.slice("patient_photo:".length) : t;
    cats.add(stripped);
  }
  for (const key of Object.keys(input.photosByCategory ?? {})) {
    cats.add(key.toLowerCase());
  }

  let hasDonorRear = false;
  let hasDonorLeft = false;
  let hasDonorRight = false;
  for (const c of cats) {
    if (categoryHitsNeedle(c, REAR_NEEDLES)) hasDonorRear = true;
    if (categoryHitsNeedle(c, LEFT_NEEDLES)) hasDonorLeft = true;
    if (categoryHitsNeedle(c, RIGHT_NEEDLES)) hasDonorRight = true;
  }

  const donorViewCount =
    Number(hasDonorRear) + Number(hasDonorLeft) + Number(hasDonorRight);
  return { hasDonorRear, hasDonorLeft, hasDonorRight, donorViewCount };
}

export function resolveMonthsSinceBandFromAnswers(
  answers: Record<string, unknown> | null | undefined,
  now: Date = new Date()
): string | null {
  if (!answers) return null;
  const band = String(answers.months_since ?? answers.monthsSince ?? "")
    .trim()
    .toLowerCase();
  if (band) return band;

  const rawDate = answers.procedure_date ?? answers.procedureDate;
  if (typeof rawDate !== "string" || !rawDate.trim()) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const months =
    (now.getFullYear() - parsed.getFullYear()) * 12 +
    (now.getMonth() - parsed.getMonth());
  if (months < 3) return "under_3";
  if (months < 6) return "3_6";
  if (months < 9) return "6_9";
  if (months < 12) return "9_12";
  return "12_plus";
}

export function resolveStageGroup(
  monthsSinceBand: string | null
): DonorOrientationEvidence["stageGroup"] {
  if (!monthsSinceBand) return "unknown";
  if (EARLY_MONTHS_BANDS.has(monthsSinceBand.toLowerCase())) return "under_3_months";
  return "3_months_or_more";
}

export function evaluateDonorOrientationEvidence(
  input: BuildDonorOrientationInput
): DonorOrientationEvidence {
  const answers = input.answers ?? null;
  const photos = detectDonorPhotoPresence({
    uploadTypes: input.uploadTypes,
    photosByCategory: input.photosByCategory,
  });
  const procedureDateRaw = answers?.procedure_date ?? answers?.procedureDate;
  const procedureDate =
    typeof procedureDateRaw === "string" && procedureDateRaw.trim()
      ? procedureDateRaw.trim()
      : null;
  const monthsSinceBand = resolveMonthsSinceBandFromAnswers(answers, input.now ?? new Date());
  const hasProcedureDate = Boolean(procedureDate);
  const hasMonthsSinceBand = Boolean(
    String(answers?.months_since ?? answers?.monthsSince ?? "").trim()
  );
  const hasTimingContext = hasProcedureDate || Boolean(monthsSinceBand);
  const stageGroup = resolveStageGroup(monthsSinceBand);
  const reasons: string[] = [];

  if (!hasTimingContext) {
    reasons.push("Missing procedure date and months-since band");
  }
  if (!photos.hasDonorRear) {
    reasons.push("Missing rear donor view");
  }
  if (!photos.hasDonorLeft) {
    reasons.push("Missing left donor view");
  }
  if (!photos.hasDonorRight) {
    reasons.push("Missing right donor view");
  }
  if (photos.donorViewCount <= 1) {
    reasons.push("Single-photograph certainty is not supported");
  }

  const sufficient =
    hasTimingContext &&
    photos.hasDonorRear &&
    photos.donorViewCount >= 2 &&
    (stageGroup === "under_3_months" || photos.donorViewCount >= 3);

  return {
    sufficient,
    donorViewCount: photos.donorViewCount,
    hasDonorRear: photos.hasDonorRear,
    hasDonorLeft: photos.hasDonorLeft,
    hasDonorRight: photos.hasDonorRight,
    hasProcedureDate,
    hasMonthsSinceBand,
    hasTimingContext,
    monthsSinceBand,
    procedureDate,
    stageGroup,
    reasons,
  };
}

/**
 * Deterministic mapping to one of six approved orientation states.
 * Never diagnoses infection, overharvesting, normality, or graft capacity.
 */
export function mapDonorHealingOrientationState(input: {
  evidence: DonorOrientationEvidence;
  appearanceTrend?: string | null;
  hasRedFlagSymptoms?: boolean;
}): DonorHealingOrientation {
  if (input.hasRedFlagSymptoms) {
    return "direct_clinical_assessment_recommended";
  }

  const { evidence } = input;
  if (!evidence.hasTimingContext || evidence.donorViewCount < 1) {
    return "insufficient_evidence";
  }

  // One photograph alone must never produce a strong compatibility claim.
  if (evidence.donorViewCount === 1) {
    return evidence.stageGroup === "under_3_months"
      ? "too_early_to_assess_homogeneity"
      : "insufficient_evidence";
  }

  if (evidence.stageGroup === "under_3_months") {
    return "too_early_to_assess_homogeneity";
  }

  const trend = String(input.appearanceTrend ?? "").toLowerCase();
  if (trend === "worsening") {
    return "persistent_irregularity_deserves_review";
  }
  if (trend === "improving") {
    return "temporary_shedding_may_contribute";
  }

  if (!evidence.sufficient || evidence.donorViewCount < 3) {
    return "insufficient_evidence";
  }

  return "compatible_with_reported_stage";
}

export function buildStageAwareDonorNarrative(
  state: DonorHealingOrientation,
  stageGroup: DonorOrientationEvidence["stageGroup"]
): string {
  const text = STAGE_NARRATIVES[state][stageGroup];
  return sanitizePatientReportText(text);
}

export function provenanceLabelForPatient(
  source: DonorOrientationProvenanceSource
): string {
  switch (source) {
    case "clinician_confirmation":
      return "Confirmed by reviewing clinician";
    case "clinician_correction":
      return "Updated after clinician review";
    default:
      return "Prepared automatically for clinician review";
  }
}

export function assertPatientSafeDonorOrientationText(text: string): string {
  const cleaned = sanitizePatientReportText(text);
  if (containsForbiddenDonorDiagnosticLanguage(cleaned)) {
    return DONOR_HEALING_ORIENTATION_LABELS.insufficient_evidence;
  }
  return cleaned;
}

export function toPatientSafeDonorOrientationSlice(
  record: DonorHealingOrientationRecord
): PatientSafeDonorOrientationSlice {
  return {
    state: record.state,
    label: assertPatientSafeDonorOrientationText(record.patientLabel),
    stageAwareNarrative: assertPatientSafeDonorOrientationText(record.stageAwareNarrative),
    escalationCopy: record.escalationCopy
      ? assertPatientSafeDonorOrientationText(record.escalationCopy)
      : null,
    evidenceSufficient: record.evidence.sufficient,
    stageGroup: record.evidence.stageGroup,
    provenanceLabel: provenanceLabelForPatient(record.provenance.source),
    provenanceSource: record.provenance.source,
  };
}

export function collectPatientFacingDonorOrientationTexts(
  slice: PatientSafeDonorOrientationSlice
): string[] {
  return [slice.label, slice.stageAwareNarrative, slice.escalationCopy, slice.provenanceLabel].filter(
    (t): t is string => typeof t === "string" && t.length > 0
  );
}

export function patientFacingDonorOrientationContainsForbiddenLanguage(
  slice: PatientSafeDonorOrientationSlice
): boolean {
  return collectPatientFacingDonorOrientationTexts(slice).some((t) =>
    containsForbiddenDonorDiagnosticLanguage(t)
  );
}

/** Build a fresh automated orientation record (immutable history starts here). */
export function buildAutomatedDonorHealingOrientation(
  input: BuildDonorOrientationInput
): DonorHealingOrientationRecord | null {
  if (!caseHasDonorHealingEntryContext(input)) return null;

  const answers = input.answers ?? null;
  const evidence = evaluateDonorOrientationEvidence(input);
  const hasRedFlagSymptoms = answersIncludeDonorRedFlags(answers);
  const appearanceTrend =
    (answers?.donor_appearance_trend as string | undefined) ??
    (answers?.appearance_trend as string | undefined) ??
    null;
  const state = mapDonorHealingOrientationState({
    evidence,
    appearanceTrend,
    hasRedFlagSymptoms,
  });
  const preparedAt = (input.now ?? new Date()).toISOString();
  const patientLabel = donorHealingOrientationLabel(state);
  const stageAwareNarrative = buildStageAwareDonorNarrative(state, evidence.stageGroup);
  const escalationCopy = hasRedFlagSymptoms ? DONOR_RED_FLAG_WARNING_COPY : null;

  return {
    version: DONOR_HEALING_ORIENTATION_REPORT_VERSION,
    entryContext: DONOR_HEALING_ENTRY_CONTEXT,
    state,
    patientLabel: assertPatientSafeDonorOrientationText(patientLabel),
    stageAwareNarrative: assertPatientSafeDonorOrientationText(stageAwareNarrative),
    escalationCopy: escalationCopy
      ? assertPatientSafeDonorOrientationText(escalationCopy)
      : null,
    evidence,
    provenance: {
      source: "automated_preparation",
      preparedAt,
      preparedBySystem: true,
      confirmedAt: null,
      confirmedByUserId: null,
      correctedFrom: null,
      history: [
        {
          at: preparedAt,
          source: "automated_preparation",
          state,
          actorUserId: null,
          previousState: null,
        },
      ],
    },
  };
}

export function isDonorHealingOrientationRecord(
  value: unknown
): value is DonorHealingOrientationRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === DONOR_HEALING_ORIENTATION_REPORT_VERSION &&
    v.entryContext === DONOR_HEALING_ENTRY_CONTEXT &&
    isDonorHealingOrientation(v.state) &&
    typeof v.patientLabel === "string" &&
    typeof v.stageAwareNarrative === "string" &&
    v.evidence != null &&
    typeof v.evidence === "object" &&
    v.provenance != null &&
    typeof v.provenance === "object"
  );
}

/**
 * Clinician confirmation — freezes automated state as confirmed without changing it.
 * History is append-only.
 */
export function confirmDonorHealingOrientation(
  existing: DonorHealingOrientationRecord,
  opts: { actorUserId: string; at?: string }
): DonorHealingOrientationRecord {
  const at = opts.at ?? new Date().toISOString();
  return {
    ...existing,
    provenance: {
      ...existing.provenance,
      source: "clinician_confirmation",
      confirmedAt: at,
      confirmedByUserId: opts.actorUserId,
      history: [
        ...existing.provenance.history,
        {
          at,
          source: "clinician_confirmation",
          state: existing.state,
          actorUserId: opts.actorUserId,
          previousState: existing.state,
        },
      ],
    },
  };
}

/**
 * Clinician correction — must remain within the six approved states.
 * Prior provenance history is preserved (immutable append).
 */
export function correctDonorHealingOrientation(
  existing: DonorHealingOrientationRecord,
  opts: {
    nextState: DonorHealingOrientation;
    actorUserId: string;
    at?: string;
  }
): DonorHealingOrientationRecord {
  if (!isDonorHealingOrientation(opts.nextState)) {
    throw new Error("Invalid donor orientation state");
  }
  const at = opts.at ?? new Date().toISOString();
  const previousState = existing.state;
  const state = opts.nextState;
  const patientLabel = assertPatientSafeDonorOrientationText(
    donorHealingOrientationLabel(state)
  );
  const stageAwareNarrative = assertPatientSafeDonorOrientationText(
    buildStageAwareDonorNarrative(state, existing.evidence.stageGroup)
  );
  const escalationCopy =
    state === "direct_clinical_assessment_recommended"
      ? assertPatientSafeDonorOrientationText(DONOR_RED_FLAG_WARNING_COPY)
      : existing.escalationCopy;

  return {
    ...existing,
    state,
    patientLabel,
    stageAwareNarrative,
    escalationCopy,
    provenance: {
      ...existing.provenance,
      source: "clinician_correction",
      confirmedAt: at,
      confirmedByUserId: opts.actorUserId,
      correctedFrom: previousState,
      history: [
        ...existing.provenance.history,
        {
          at,
          source: "clinician_correction",
          state,
          actorUserId: opts.actorUserId,
          previousState,
        },
      ],
    },
  };
}

/**
 * Resolve orientation for report generation: clinician-reviewed records are
 * immutable; automated preparation is rebuilt from current evidence inputs.
 */
export function resolveDonorHealingOrientationForReport(
  input: BuildDonorOrientationInput & {
    stored?: unknown;
  }
): DonorHealingOrientationRecord | null {
  const fromStored = isDonorHealingOrientationRecord(input.stored)
    ? input.stored
    : isDonorHealingOrientationRecord(input.summary?.donor_healing_orientation)
      ? (input.summary!.donor_healing_orientation as DonorHealingOrientationRecord)
      : null;

  if (
    fromStored &&
    (fromStored.provenance.source === "clinician_confirmation" ||
      fromStored.provenance.source === "clinician_correction")
  ) {
    return fromStored;
  }

  return buildAutomatedDonorHealingOrientation(input);
}
