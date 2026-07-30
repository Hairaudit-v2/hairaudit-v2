/**
 * HA-DONOR-HEALING-1E — Future donor-capacity planning from clinical measurements.
 *
 * Qualitative planning bands only on patient surfaces (no graft numbers).
 * Patient self-report is supporting context only and never satisfies the gate alone.
 * Never derives capacity from photographs.
 */

import {
  DONOR_HEALING_ENTRY_CONTEXT,
  containsForbiddenDonorDiagnosticLanguage,
  type DonorHealingEntryContext,
} from "@/lib/patient/donorHealingEntry";
import { sanitizePatientReportText } from "@/lib/reports/postSurgeryPatientText";
import { caseHasDonorHealingEntryContext } from "@/lib/patient/donorHealingOrientationReport";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";

export const DONOR_CAPACITY_PLAN_VERSION = 1 as const;

export const DONOR_CAPACITY_PLAN_STATES = [
  "insufficient_clinical_measurements",
  "discussion_with_clinic_recommended",
  "limited_future_options_suggested",
  "further_measurement_recommended",
  "not_assessable",
] as const;

export type DonorCapacityPlanState = (typeof DONOR_CAPACITY_PLAN_STATES)[number];

export const DONOR_CAPACITY_PLAN_LABELS: Record<DonorCapacityPlanState, string> = {
  insufficient_clinical_measurements:
    "There are not enough clinical measurements to plan future donor use yet",
  discussion_with_clinic_recommended:
    "Future donor planning should be discussed with the treating clinic using clinical measurements",
  limited_future_options_suggested:
    "Available measurements suggest future options may be limited — confirm with clinic",
  further_measurement_recommended:
    "Additional clinical measurements (e.g. density mapping) are recommended before planning",
  not_assessable:
    "Future donor capacity cannot be assessed from the materials available",
};

export const DONOR_CAPACITY_MEASUREMENT_SOURCES = [
  "doctor_audit",
  "clinic_audit",
  "clinical_history",
  "auditor_entry",
  "patient_self_report",
] as const;

export type DonorCapacityMeasurementSource =
  (typeof DONOR_CAPACITY_MEASUREMENT_SOURCES)[number];

/** Sources that count toward the clinical measurement gate. */
export const DONOR_CAPACITY_QUALIFYING_SOURCES: readonly DonorCapacityMeasurementSource[] =
  ["doctor_audit", "clinic_audit", "clinical_history", "auditor_entry"];

export type SourcedMeasurement<T> = {
  value: T;
  source: DonorCapacityMeasurementSource;
};

export type DonorCapacityMeasurements = {
  densityCm2: SourcedMeasurement<number> | null;
  graftsRemoved: SourcedMeasurement<number> | null;
  punchSizeMm: SourcedMeasurement<number> | null;
  estimatedCapacityOrdinal: SourcedMeasurement<string> | null;
  estimatedCapacityNumeric: SourcedMeasurement<number> | null;
  safeZoneAssessed: SourcedMeasurement<string> | null;
};

export type DonorCapacityPatientHints = {
  graftNumberReported: string | null;
  punchSizeKnown: string | null;
};

export type DonorCapacitySufficiency = {
  sufficient: boolean;
  qualifyingCount: number;
  missing: string[];
  reasons: string[];
};

export type DonorCapacityProvenanceSource =
  | "automated_preparation"
  | "clinician_confirmation"
  | "clinician_correction";

export type DonorCapacityProvenanceEvent = {
  at: string;
  source: DonorCapacityProvenanceSource;
  state: DonorCapacityPlanState;
  actorUserId?: string | null;
  previousState?: DonorCapacityPlanState | null;
};

export type DonorCapacityProvenance = {
  source: DonorCapacityProvenanceSource;
  preparedAt: string;
  preparedBySystem: boolean;
  confirmedAt?: string | null;
  confirmedByUserId?: string | null;
  correctedFrom?: DonorCapacityPlanState | null;
  history: DonorCapacityProvenanceEvent[];
};

export type DonorCapacityPlanSnapshot = {
  id: string;
  at: string;
  actorUserId: string | null;
  source: DonorCapacityProvenanceSource;
  overallState: DonorCapacityPlanState;
  payloadDigest: string;
  payload: {
    overallState: DonorCapacityPlanState;
    qualifyingCount: number;
    sufficient: boolean;
    narrative: string;
    measurementKeys: string[];
  };
};

/**
 * Full record stored on `reports.summary.donor_capacity_plan`.
 */
export type DonorCapacityPlanRecord = {
  version: typeof DONOR_CAPACITY_PLAN_VERSION;
  entryContext: DonorHealingEntryContext;
  overallState: DonorCapacityPlanState;
  patientLabel: string;
  narrative: string;
  measurements: DonorCapacityMeasurements;
  patientHints: DonorCapacityPatientHints;
  sufficiency: DonorCapacitySufficiency;
  /** Auditor-only; never copied into patient slice as a graft number. */
  clinicianInternalNote: string | null;
  provenance: DonorCapacityProvenance;
  snapshots: DonorCapacityPlanSnapshot[];
};

/** Patient / PDF-safe — qualitative only; no measurement numbers. */
export type PatientSafeDonorCapacityPlanSlice = {
  overallState: DonorCapacityPlanState;
  label: string;
  narrative: string;
  caveat: string;
  provenanceLabel: string;
  provenanceSource: DonorCapacityProvenanceSource;
};

export type BuildDonorCapacityPlanInput = {
  answers?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  doctorAnswers?: Record<string, unknown> | null;
  clinicAnswers?: Record<string, unknown> | null;
  clinicalHistory?: ClinicalHistorySnapshot | null;
  /** Override / merge measurements (e.g. auditor upsert). */
  measurementsOverride?: Partial<DonorCapacityMeasurements> | null;
  clinicianInternalNote?: string | null;
  now?: Date;
};

export const DONOR_CAPACITY_PLAN_CAVEAT =
  "This planning note is based on clinical measurements when available. It does not estimate remaining graft counts from photographs and does not replace an in-person donor assessment with your treating clinic.";

const STATE_NARRATIVES: Record<DonorCapacityPlanState, string> = {
  insufficient_clinical_measurements:
    "Clinical measurements such as donor density mapping, verified graft counts, and punch size are needed before future donor use can be planned reliably. Photographs alone are not enough.",
  discussion_with_clinic_recommended:
    "Available clinical measurements support a structured discussion with your treating clinic about future donor options. This is planning guidance for that conversation, not a remaining-graft count.",
  limited_future_options_suggested:
    "Based on the clinical measurements on file, future donor options may be more limited than for an unused donor. Confirm interpretation and next steps with your treating clinic.",
  further_measurement_recommended:
    "Some clinical context is present, but additional measurements (for example density mapping) are recommended before firm future-donor planning.",
  not_assessable:
    "Future donor capacity cannot be assessed from the materials currently available for this review.",
};

export function isDonorCapacityPlanState(
  value: unknown
): value is DonorCapacityPlanState {
  return (
    typeof value === "string" &&
    (DONOR_CAPACITY_PLAN_STATES as readonly string[]).includes(value)
  );
}

export function isDonorCapacityMeasurementSource(
  value: unknown
): value is DonorCapacityMeasurementSource {
  return (
    typeof value === "string" &&
    (DONOR_CAPACITY_MEASUREMENT_SOURCES as readonly string[]).includes(value)
  );
}

export function isQualifyingCapacitySource(
  source: DonorCapacityMeasurementSource
): boolean {
  return (DONOR_CAPACITY_QUALIFYING_SOURCES as readonly string[]).includes(source);
}

export function donorCapacityPlanLabel(state: DonorCapacityPlanState): string {
  return DONOR_CAPACITY_PLAN_LABELS[state];
}

export function assertPatientSafeDonorCapacityText(text: string): string {
  const cleaned = sanitizePatientReportText(text);
  if (containsForbiddenDonorDiagnosticLanguage(cleaned)) {
    return DONOR_CAPACITY_PLAN_LABELS.insufficient_clinical_measurements;
  }
  // Strip digit runs that look like graft counts from patient narratives.
  if (/\b\d{3,5}\s*grafts?\b/i.test(cleaned)) {
    return DONOR_CAPACITY_PLAN_LABELS.discussion_with_clinic_recommended;
  }
  return cleaned;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function pickSourcedNumber(
  candidates: Array<{ value: unknown; source: DonorCapacityMeasurementSource }>
): SourcedMeasurement<number> | null {
  for (const c of candidates) {
    const n = asFiniteNumber(c.value);
    if (n == null) continue;
    if (c.source === "patient_self_report") continue; // never auto-qualify from patient
    return { value: n, source: c.source };
  }
  return null;
}

function pickSourcedString(
  candidates: Array<{ value: unknown; source: DonorCapacityMeasurementSource }>
): SourcedMeasurement<string> | null {
  for (const c of candidates) {
    const s = asNonEmptyString(c.value);
    if (!s) continue;
    if (c.source === "patient_self_report") continue;
    return { value: s, source: c.source };
  }
  return null;
}

/**
 * Prefill measurements from clinical sources. Patient self-report goes to hints only.
 */
export function collectDonorCapacityMeasurements(
  input: BuildDonorCapacityPlanInput
): {
  measurements: DonorCapacityMeasurements;
  patientHints: DonorCapacityPatientHints;
} {
  const doctor = input.doctorAnswers ?? {};
  const clinic = input.clinicAnswers ?? {};
  const history = input.clinicalHistory ?? null;
  const answers = input.answers ?? {};
  const summary = input.summary ?? {};

  // Prefer doctor, then clinic, then clinical history for each field.
  const densityCm2 = pickSourcedNumber([
    { value: doctor.donor_density_per_cm2, source: "doctor_audit" },
    { value: clinic.donor_density_per_cm2, source: "clinic_audit" },
  ]);

  const graftsRemoved = pickSourcedNumber([
    { value: doctor.actual_graft_count, source: "doctor_audit" },
    { value: clinic.actual_graft_count, source: "clinic_audit" },
    { value: history?.donorGraftsRemoved, source: "clinical_history" },
    { value: doctor.planned_graft_count, source: "doctor_audit" },
  ]);

  const punchSizeMm = pickSourcedNumber([
    { value: doctor.punch_size_mm, source: "doctor_audit" },
    { value: clinic.punch_size_mm, source: "clinic_audit" },
    { value: history?.punchSizeMm, source: "clinical_history" },
  ]);

  const estimatedCapacityOrdinal = pickSourcedString([
    { value: doctor.estimated_donor_capacity, source: "doctor_audit" },
    { value: clinic.estimated_donor_capacity, source: "clinic_audit" },
  ]);

  const estimatedCapacityNumeric = pickSourcedNumber([
    { value: doctor.estimated_donor_capacity_numeric, source: "doctor_audit" },
    { value: clinic.estimated_donor_capacity_numeric, source: "clinic_audit" },
  ]);

  const safeZoneAssessed = pickSourcedString([
    { value: doctor.safe_donor_zone_assessed, source: "doctor_audit" },
    { value: clinic.safe_donor_zone_assessed, source: "clinic_audit" },
  ]);

  let measurements: DonorCapacityMeasurements = {
    densityCm2,
    graftsRemoved,
    punchSizeMm,
    estimatedCapacityOrdinal,
    estimatedCapacityNumeric,
    safeZoneAssessed,
  };

  if (input.measurementsOverride) {
    measurements = {
      ...measurements,
      ...Object.fromEntries(
        Object.entries(input.measurementsOverride).filter(([, v]) => v !== undefined)
      ),
    } as DonorCapacityMeasurements;
  }

  const patientHints: DonorCapacityPatientHints = {
    graftNumberReported:
      asNonEmptyString(answers.donor_graft_number_reported) ??
      asNonEmptyString(summary.donor_graft_number_reported) ??
      null,
    punchSizeKnown:
      asNonEmptyString(answers.donor_punch_size_known) ??
      asNonEmptyString(summary.donor_punch_size_known) ??
      null,
  };

  return { measurements, patientHints };
}

/**
 * Count qualifying clinical measurement fields (≥2 required for sufficiency).
 * Patient self-report never counts. estimatedCapacity ordinal OR numeric counts as one slot.
 */
export function evaluateDonorCapacitySufficiency(
  measurements: DonorCapacityMeasurements
): DonorCapacitySufficiency {
  const missing: string[] = [];
  const reasons: string[] = [];
  let qualifyingCount = 0;

  const slots: Array<{
    key: string;
    present: boolean;
    source: DonorCapacityMeasurementSource | null;
  }> = [
    {
      key: "donor_density_per_cm2",
      present: measurements.densityCm2 != null,
      source: measurements.densityCm2?.source ?? null,
    },
    {
      key: "grafts_removed",
      present: measurements.graftsRemoved != null,
      source: measurements.graftsRemoved?.source ?? null,
    },
    {
      key: "punch_size_mm",
      present: measurements.punchSizeMm != null,
      source: measurements.punchSizeMm?.source ?? null,
    },
    {
      key: "estimated_donor_capacity",
      present:
        measurements.estimatedCapacityOrdinal != null ||
        measurements.estimatedCapacityNumeric != null,
      source:
        measurements.estimatedCapacityOrdinal?.source ??
        measurements.estimatedCapacityNumeric?.source ??
        null,
    },
  ];

  for (const slot of slots) {
    if (
      slot.present &&
      slot.source &&
      isQualifyingCapacitySource(slot.source)
    ) {
      qualifyingCount += 1;
    } else {
      missing.push(slot.key);
    }
  }

  if (qualifyingCount < 2) {
    reasons.push(
      `Only ${qualifyingCount} qualifying clinical measurement(s); need at least 2`
    );
    reasons.push("Patient self-report and photographs do not satisfy this gate");
  }

  return {
    sufficient: qualifyingCount >= 2,
    qualifyingCount,
    missing,
    reasons,
  };
}

/**
 * Deterministic qualitative mapping — never emits remaining-graft numbers.
 */
export function mapDonorCapacityPlanState(input: {
  sufficiency: DonorCapacitySufficiency;
  measurements: DonorCapacityMeasurements;
  patientHints?: DonorCapacityPatientHints | null;
}): DonorCapacityPlanState {
  const { sufficiency, measurements } = input;

  if (!sufficiency.sufficient) {
    // Hints alone still insufficient.
    if (
      input.patientHints?.graftNumberReported ||
      input.patientHints?.punchSizeKnown
    ) {
      return "insufficient_clinical_measurements";
    }
    return "insufficient_clinical_measurements";
  }

  // Limited options heuristic from ordinal capacity bands (not a number published to patients).
  const ordinal = String(measurements.estimatedCapacityOrdinal?.value ?? "").toLowerCase();
  if (
    ordinal.includes("low") ||
    ordinal.includes("poor") ||
    ordinal.includes("limited") ||
    ordinal === "under_2000" ||
    ordinal === "0_2000"
  ) {
    return "limited_future_options_suggested";
  }

  if (!measurements.densityCm2) {
    return "further_measurement_recommended";
  }

  return "discussion_with_clinic_recommended";
}

export function buildDonorCapacityNarrative(state: DonorCapacityPlanState): string {
  return sanitizePatientReportText(STATE_NARRATIVES[state]);
}

export function provenanceLabelForDonorCapacity(
  source: DonorCapacityProvenanceSource
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

function simpleDigest(parts: string[]): string {
  let h = 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `d${(h >>> 0).toString(16)}`;
}

function measurementKeysPresent(m: DonorCapacityMeasurements): string[] {
  const keys: string[] = [];
  if (m.densityCm2) keys.push("densityCm2");
  if (m.graftsRemoved) keys.push("graftsRemoved");
  if (m.punchSizeMm) keys.push("punchSizeMm");
  if (m.estimatedCapacityOrdinal) keys.push("estimatedCapacityOrdinal");
  if (m.estimatedCapacityNumeric) keys.push("estimatedCapacityNumeric");
  if (m.safeZoneAssessed) keys.push("safeZoneAssessed");
  return keys;
}

export function buildDonorCapacitySnapshot(args: {
  record: Pick<
    DonorCapacityPlanRecord,
    "overallState" | "sufficiency" | "narrative" | "measurements"
  >;
  source: DonorCapacityProvenanceSource;
  actorUserId: string | null;
  at?: string;
}): DonorCapacityPlanSnapshot {
  const at = args.at ?? new Date().toISOString();
  const keys = measurementKeysPresent(args.record.measurements);
  const payload = {
    overallState: args.record.overallState,
    qualifyingCount: args.record.sufficiency.qualifyingCount,
    sufficient: args.record.sufficiency.sufficient,
    narrative: args.record.narrative,
    measurementKeys: keys,
  };
  const payloadDigest = simpleDigest([
    payload.overallState,
    String(payload.qualifyingCount),
    String(payload.sufficient),
    keys.join(","),
  ]);
  return {
    id: `snap_${at.replace(/[:.]/g, "")}_${payloadDigest}`,
    at,
    actorUserId: args.actorUserId,
    source: args.source,
    overallState: args.record.overallState,
    payloadDigest,
    payload,
  };
}

/** Build a fresh automated capacity plan record. */
export function buildAutomatedDonorCapacityPlan(
  input: BuildDonorCapacityPlanInput
): DonorCapacityPlanRecord | null {
  if (!caseHasDonorHealingEntryContext(input)) return null;

  const { measurements, patientHints } = collectDonorCapacityMeasurements(input);
  const sufficiency = evaluateDonorCapacitySufficiency(measurements);
  const overallState = mapDonorCapacityPlanState({
    sufficiency,
    measurements,
    patientHints,
  });
  const preparedAt = (input.now ?? new Date()).toISOString();
  const patientLabel = assertPatientSafeDonorCapacityText(
    donorCapacityPlanLabel(overallState)
  );
  const narrative = assertPatientSafeDonorCapacityText(
    buildDonorCapacityNarrative(overallState)
  );

  return {
    version: DONOR_CAPACITY_PLAN_VERSION,
    entryContext: DONOR_HEALING_ENTRY_CONTEXT,
    overallState,
    patientLabel,
    narrative,
    measurements,
    patientHints,
    sufficiency,
    clinicianInternalNote: input.clinicianInternalNote?.trim()
      ? String(input.clinicianInternalNote).trim()
      : null,
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
          state: overallState,
          actorUserId: null,
          previousState: null,
        },
      ],
    },
    snapshots: [],
  };
}

export function isDonorCapacityPlanRecord(
  value: unknown
): value is DonorCapacityPlanRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === DONOR_CAPACITY_PLAN_VERSION &&
    v.entryContext === DONOR_HEALING_ENTRY_CONTEXT &&
    isDonorCapacityPlanState(v.overallState) &&
    typeof v.patientLabel === "string" &&
    typeof v.narrative === "string" &&
    v.measurements != null &&
    typeof v.measurements === "object" &&
    v.sufficiency != null &&
    typeof v.sufficiency === "object" &&
    v.provenance != null &&
    typeof v.provenance === "object" &&
    Array.isArray(v.snapshots)
  );
}

export function isClinicianReviewedDonorCapacityPlan(
  record: DonorCapacityPlanRecord
): boolean {
  return (
    record.provenance.source === "clinician_confirmation" ||
    record.provenance.source === "clinician_correction"
  );
}

export function confirmDonorCapacityPlan(
  existing: DonorCapacityPlanRecord,
  opts: { actorUserId: string; at?: string }
): DonorCapacityPlanRecord {
  const at = opts.at ?? new Date().toISOString();
  const next: DonorCapacityPlanRecord = {
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
          state: existing.overallState,
          actorUserId: opts.actorUserId,
          previousState: existing.overallState,
        },
      ],
    },
    snapshots: existing.snapshots,
  };
  const snapshot = buildDonorCapacitySnapshot({
    record: next,
    source: "clinician_confirmation",
    actorUserId: opts.actorUserId,
    at,
  });
  return { ...next, snapshots: [...existing.snapshots, snapshot] };
}

export function correctDonorCapacityPlan(
  existing: DonorCapacityPlanRecord,
  opts: {
    nextState: DonorCapacityPlanState;
    actorUserId: string;
    at?: string;
    measurements?: Partial<DonorCapacityMeasurements> | null;
    clinicianInternalNote?: string | null;
  }
): DonorCapacityPlanRecord {
  if (!isDonorCapacityPlanState(opts.nextState)) {
    throw new Error("Invalid donor capacity plan state");
  }
  const at = opts.at ?? new Date().toISOString();
  const previousState = existing.overallState;
  const measurements: DonorCapacityMeasurements = {
    ...existing.measurements,
    ...(opts.measurements ?? {}),
  };
  const sufficiency = evaluateDonorCapacitySufficiency(measurements);
  const overallState = opts.nextState;
  const patientLabel = assertPatientSafeDonorCapacityText(
    donorCapacityPlanLabel(overallState)
  );
  const narrative = assertPatientSafeDonorCapacityText(
    buildDonorCapacityNarrative(overallState)
  );

  const next: DonorCapacityPlanRecord = {
    ...existing,
    overallState,
    patientLabel,
    narrative,
    measurements,
    sufficiency,
    clinicianInternalNote:
      opts.clinicianInternalNote !== undefined
        ? opts.clinicianInternalNote?.trim()
          ? String(opts.clinicianInternalNote).trim()
          : null
        : existing.clinicianInternalNote,
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
          state: overallState,
          actorUserId: opts.actorUserId,
          previousState,
        },
      ],
    },
    snapshots: existing.snapshots,
  };

  const snapshot = buildDonorCapacitySnapshot({
    record: next,
    source: "clinician_correction",
    actorUserId: opts.actorUserId,
    at,
  });
  return { ...next, snapshots: [...existing.snapshots, snapshot] };
}

/**
 * Upsert auditor-entered measurements (source forced to auditor_entry for provided fields).
 */
export function upsertDonorCapacityMeasurements(
  existing: DonorCapacityPlanRecord,
  patch: {
    densityCm2?: number | null;
    graftsRemoved?: number | null;
    punchSizeMm?: number | null;
    estimatedCapacityOrdinal?: string | null;
    estimatedCapacityNumeric?: number | null;
    safeZoneAssessed?: string | null;
    clinicianInternalNote?: string | null;
  }
): DonorCapacityPlanRecord {
  const measurements: DonorCapacityMeasurements = { ...existing.measurements };

  const applyNum = (
    key: keyof Pick<
      DonorCapacityMeasurements,
      "densityCm2" | "graftsRemoved" | "punchSizeMm" | "estimatedCapacityNumeric"
    >,
    raw: number | null | undefined
  ) => {
    if (raw === undefined) return;
    if (raw == null || !Number.isFinite(raw)) {
      measurements[key] = null;
      return;
    }
    measurements[key] = { value: raw, source: "auditor_entry" };
  };

  applyNum("densityCm2", patch.densityCm2);
  applyNum("graftsRemoved", patch.graftsRemoved);
  applyNum("punchSizeMm", patch.punchSizeMm);
  applyNum("estimatedCapacityNumeric", patch.estimatedCapacityNumeric);

  if (patch.estimatedCapacityOrdinal !== undefined) {
    const s = asNonEmptyString(patch.estimatedCapacityOrdinal);
    measurements.estimatedCapacityOrdinal = s
      ? { value: s, source: "auditor_entry" }
      : null;
  }
  if (patch.safeZoneAssessed !== undefined) {
    const s = asNonEmptyString(patch.safeZoneAssessed);
    measurements.safeZoneAssessed = s
      ? { value: s, source: "auditor_entry" }
      : null;
  }

  const sufficiency = evaluateDonorCapacitySufficiency(measurements);
  const overallState = mapDonorCapacityPlanState({
    sufficiency,
    measurements,
    patientHints: existing.patientHints,
  });

  return {
    ...existing,
    measurements,
    sufficiency,
    overallState,
    patientLabel: assertPatientSafeDonorCapacityText(
      donorCapacityPlanLabel(overallState)
    ),
    narrative: assertPatientSafeDonorCapacityText(
      buildDonorCapacityNarrative(overallState)
    ),
    clinicianInternalNote:
      patch.clinicianInternalNote !== undefined
        ? patch.clinicianInternalNote?.trim()
          ? String(patch.clinicianInternalNote).trim()
          : null
        : existing.clinicianInternalNote,
    provenance: {
      ...existing.provenance,
      source:
        existing.provenance.source === "clinician_confirmation" ||
        existing.provenance.source === "clinician_correction"
          ? "clinician_correction"
          : existing.provenance.source,
    },
  };
}

export function resolveDonorCapacityPlanForReport(
  input: BuildDonorCapacityPlanInput & { stored?: unknown }
): DonorCapacityPlanRecord | null {
  const fromStored = isDonorCapacityPlanRecord(input.stored)
    ? input.stored
    : isDonorCapacityPlanRecord(input.summary?.donor_capacity_plan)
      ? (input.summary!.donor_capacity_plan as DonorCapacityPlanRecord)
      : null;

  if (fromStored && isClinicianReviewedDonorCapacityPlan(fromStored)) {
    return fromStored;
  }

  return buildAutomatedDonorCapacityPlan(input);
}

/**
 * Patient-facing slice — qualitative only; null unless clinician-reviewed.
 */
export function toPatientSafeDonorCapacityPlanSlice(
  record: DonorCapacityPlanRecord
): PatientSafeDonorCapacityPlanSlice | null {
  if (!isClinicianReviewedDonorCapacityPlan(record)) return null;

  return {
    overallState: record.overallState,
    label: assertPatientSafeDonorCapacityText(record.patientLabel),
    narrative: assertPatientSafeDonorCapacityText(record.narrative),
    caveat: DONOR_CAPACITY_PLAN_CAVEAT,
    provenanceLabel: provenanceLabelForDonorCapacity(record.provenance.source),
    provenanceSource: record.provenance.source,
  };
}

export function collectPatientFacingDonorCapacityTexts(
  slice: PatientSafeDonorCapacityPlanSlice
): string[] {
  return [slice.label, slice.narrative, slice.caveat, slice.provenanceLabel].filter(
    (t): t is string => typeof t === "string" && t.length > 0
  );
}

export function patientFacingDonorCapacityContainsForbiddenLanguage(
  slice: PatientSafeDonorCapacityPlanSlice
): boolean {
  return collectPatientFacingDonorCapacityTexts(slice).some((t) =>
    containsForbiddenDonorDiagnosticLanguage(t)
  );
}

/** True if patient slice accidentally includes graft-count style numbers. */
export function patientFacingDonorCapacityContainsGraftNumbers(
  slice: PatientSafeDonorCapacityPlanSlice
): boolean {
  return collectPatientFacingDonorCapacityTexts(slice).some((t) =>
    /\b\d{3,5}\s*grafts?\b/i.test(t)
  );
}
