import {
  DONOR_DEPLETION_LEVELS,
  EXTRACTION_METHODS,
  IMPLANTATION_METHODS,
  MEDICATION_HISTORY_KEYS,
  PRIOR_PROCEDURE_TYPES,
  RECIPIENT_ZONES,
  VISIBLE_SCARRING_LEVELS,
  type ClinicalHistoryUpsertPayload,
  type DonorDepletionLevel,
  type ExtractionMethod,
  type ImplantationMethod,
  type MedicationHistory,
  type PriorProcedureType,
  type RecipientZone,
  type VisibleScarringLevel,
} from "./clinicalHistoryTypes";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizePositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function normalizeNonNegativeInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

function normalizeOptionalText(value: unknown, maxLen = 5000): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function normalizeAllowlist<T extends string>(value: unknown, allowlist: readonly T[]): T | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).trim().toLowerCase();
  return (allowlist as readonly string[]).includes(s) ? (s as T) : null;
}

function normalizeProcedureType(value: unknown): string | null {
  const allowlisted = normalizeAllowlist<PriorProcedureType>(value, PRIOR_PROCEDURE_TYPES);
  if (allowlisted) return allowlisted;
  return normalizeOptionalText(value, 200);
}

function normalizeRecipientZones(value: unknown): RecipientZone[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<RecipientZone>();
  for (const item of value) {
    const z = normalizeAllowlist(item, RECIPIENT_ZONES);
    if (z) out.add(z);
  }
  return Array.from(out);
}

function normalizeMedicationHistory(value: unknown): MedicationHistory {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const out: MedicationHistory = {};
  for (const key of MEDICATION_HISTORY_KEYS) {
    if (key === "other") {
      const otherVal = raw.other;
      if (typeof otherVal === "string" && otherVal.trim()) {
        out.other = otherVal.trim().slice(0, 500);
      } else if (otherVal === true) {
        out.other = true;
      }
      continue;
    }
    if (raw[key] === true) out[key] = true;
    else if (raw[key] === false) out[key] = false;
  }
  if (out.none_unknown) {
    for (const key of MEDICATION_HISTORY_KEYS) {
      if (key !== "none_unknown" && key !== "other") delete out[key];
    }
  }
  return out;
}

function normalizeHairsPerGraft(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  if (rounded < 1.0 || rounded > 4.5) return null;
  return rounded;
}

function normalizePunchSizeMm(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  if (rounded < 0.5 || rounded > 1.5) return null;
  return rounded;
}

function normalizePercent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  if (rounded < 0 || rounded > 100) return null;
  return rounded;
}

export type ClinicalHistoryValidationResult =
  | { ok: true; payload: ClinicalHistoryUpsertPayload; dbRow: Record<string, unknown> }
  | { ok: false; error: string };

export function normalizeClinicalHistoryPayload(body: unknown): ClinicalHistoryValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const input = body as Record<string, unknown>;

  const priorSurgeryDateRaw = input.priorSurgeryDate ?? input.prior_surgery_date;
  let priorSurgeryDate: string | null = null;
  if (priorSurgeryDateRaw != null && String(priorSurgeryDateRaw).trim()) {
    const d = String(priorSurgeryDateRaw).trim();
    if (!DATE_RE.test(d)) return { ok: false, error: "priorSurgeryDate must be YYYY-MM-DD" };
    priorSurgeryDate = d;
  }

  const donorDepletion = normalizeAllowlist<DonorDepletionLevel>(
    input.donorDepletionLevel ?? input.donor_depletion_level,
    DONOR_DEPLETION_LEVELS
  );
  const visibleScarring = normalizeAllowlist<VisibleScarringLevel>(
    input.visibleScarringLevel ?? input.visible_scarring_level,
    VISIBLE_SCARRING_LEVELS
  );
  const extractionMethod = normalizeAllowlist<ExtractionMethod>(
    input.extractionMethod ?? input.extraction_method,
    EXTRACTION_METHODS
  );
  const implantationMethod = normalizeAllowlist<ImplantationMethod>(
    input.implantationMethod ?? input.implantation_method,
    IMPLANTATION_METHODS
  );

  const rawDonorDepletion = input.donorDepletionLevel ?? input.donor_depletion_level;
  if (rawDonorDepletion != null && String(rawDonorDepletion).trim() && !donorDepletion) {
    return { ok: false, error: `donorDepletionLevel must be one of: ${DONOR_DEPLETION_LEVELS.join(", ")}` };
  }
  const rawScarring = input.visibleScarringLevel ?? input.visible_scarring_level;
  if (rawScarring != null && String(rawScarring).trim() && !visibleScarring) {
    return { ok: false, error: `visibleScarringLevel must be one of: ${VISIBLE_SCARRING_LEVELS.join(", ")}` };
  }
  const rawExtraction = input.extractionMethod ?? input.extraction_method;
  if (rawExtraction != null && String(rawExtraction).trim() && !extractionMethod) {
    return { ok: false, error: `extractionMethod must be one of: ${EXTRACTION_METHODS.join(", ")}` };
  }
  const rawImplantation = input.implantationMethod ?? input.implantation_method;
  if (rawImplantation != null && String(rawImplantation).trim() && !implantationMethod) {
    return { ok: false, error: `implantationMethod must be one of: ${IMPLANTATION_METHODS.join(", ")}` };
  }

  const avgHairs = normalizeHairsPerGraft(input.averageHairsPerGraft ?? input.average_hairs_per_graft);
  const rawAvg = input.averageHairsPerGraft ?? input.average_hairs_per_graft;
  if (rawAvg != null && String(rawAvg).trim() && avgHairs === null) {
    return { ok: false, error: "averageHairsPerGraft must be between 1.0 and 4.5" };
  }

  const punchSize = normalizePunchSizeMm(input.punchSizeMm ?? input.punch_size_mm);
  const rawPunch = input.punchSizeMm ?? input.punch_size_mm;
  if (rawPunch != null && String(rawPunch).trim() && punchSize === null) {
    return { ok: false, error: "punchSizeMm must be between 0.5 and 1.5" };
  }

  const transection = normalizePercent(input.transectionRatePercent ?? input.transection_rate_percent);
  const rawTransection = input.transectionRatePercent ?? input.transection_rate_percent;
  if (rawTransection != null && String(rawTransection).trim() && transection === null) {
    return { ok: false, error: "transectionRatePercent must be between 0 and 100" };
  }

  const survival = normalizePercent(input.survivalEstimatePercent ?? input.survival_estimate_percent);
  const rawSurvival = input.survivalEstimatePercent ?? input.survival_estimate_percent;
  if (rawSurvival != null && String(rawSurvival).trim() && survival === null) {
    return { ok: false, error: "survivalEstimatePercent must be between 0 and 100" };
  }

  const payload: ClinicalHistoryUpsertPayload = {
    priorSurgeryCount: normalizePositiveInt(input.priorSurgeryCount ?? input.prior_surgery_count),
    priorProcedureType: normalizeProcedureType(input.priorProcedureType ?? input.prior_procedure_type),
    priorSurgeryDate,
    priorSurgeryTimingNote: normalizeOptionalText(
      input.priorSurgeryTimingNote ?? input.prior_surgery_timing_note,
      200
    ),
    priorClinicName: normalizeOptionalText(input.priorClinicName ?? input.prior_clinic_name, 300),
    priorSurgeonName: normalizeOptionalText(input.priorSurgeonName ?? input.prior_surgeon_name, 300),
    priorGraftCount: normalizePositiveInt(input.priorGraftCount ?? input.prior_graft_count),
    estimatedHairCount: normalizePositiveInt(input.estimatedHairCount ?? input.estimated_hair_count),
    averageHairsPerGraft: avgHairs,
    singleHairGrafts: normalizeNonNegativeInt(input.singleHairGrafts ?? input.single_hair_grafts),
    doubleHairGrafts: normalizeNonNegativeInt(input.doubleHairGrafts ?? input.double_hair_grafts),
    tripleHairGrafts: normalizeNonNegativeInt(input.tripleHairGrafts ?? input.triple_hair_grafts),
    quadrupleHairGrafts: normalizeNonNegativeInt(input.quadrupleHairGrafts ?? input.quadruple_hair_grafts),
    donorGraftsRemoved: normalizePositiveInt(input.donorGraftsRemoved ?? input.donor_grafts_removed),
    punchSizeMm: punchSize,
    extractionMethod,
    implantationMethod,
    transectionRatePercent: transection,
    survivalEstimatePercent: survival,
    recipientZones: normalizeRecipientZones(input.recipientZones ?? input.recipient_zones),
    donorDepletionLevel: donorDepletion,
    donorReserveAssessment: normalizeOptionalText(
      input.donorReserveAssessment ?? input.donor_reserve_assessment,
      500
    ),
    visibleScarringLevel: visibleScarring,
    surgicalTechniqueNotes: normalizeOptionalText(
      input.surgicalTechniqueNotes ?? input.surgical_technique_notes,
      5000
    ),
    medicationHistory: normalizeMedicationHistory(input.medicationHistory ?? input.medication_history),
    supportingDocumentNotes: normalizeOptionalText(
      input.supportingDocumentNotes ?? input.supporting_document_notes,
      10000
    ),
    clinicianSummary: normalizeOptionalText(input.clinicianSummary ?? input.clinician_summary, 10000),
  };

  const dbRow: Record<string, unknown> = {
    prior_surgery_count: payload.priorSurgeryCount,
    prior_procedure_type: payload.priorProcedureType,
    prior_surgery_date: payload.priorSurgeryDate,
    prior_surgery_timing_note: payload.priorSurgeryTimingNote,
    prior_clinic_name: payload.priorClinicName,
    prior_surgeon_name: payload.priorSurgeonName,
    prior_graft_count: payload.priorGraftCount,
    estimated_hair_count: payload.estimatedHairCount,
    average_hairs_per_graft: payload.averageHairsPerGraft,
    single_hair_grafts: payload.singleHairGrafts,
    double_hair_grafts: payload.doubleHairGrafts,
    triple_hair_grafts: payload.tripleHairGrafts,
    quadruple_hair_grafts: payload.quadrupleHairGrafts,
    donor_grafts_removed: payload.donorGraftsRemoved,
    punch_size_mm: payload.punchSizeMm,
    extraction_method: payload.extractionMethod,
    implantation_method: payload.implantationMethod,
    transection_rate_percent: payload.transectionRatePercent,
    survival_estimate_percent: payload.survivalEstimatePercent,
    recipient_zones: payload.recipientZones ?? [],
    donor_depletion_level: payload.donorDepletionLevel,
    donor_reserve_assessment: payload.donorReserveAssessment,
    visible_scarring_level: payload.visibleScarringLevel,
    surgical_technique_notes: payload.surgicalTechniqueNotes,
    medication_history: payload.medicationHistory ?? {},
    supporting_document_notes: payload.supportingDocumentNotes,
    clinician_summary: payload.clinicianSummary,
  };

  return { ok: true, payload, dbRow };
}
