import {
  DONOR_DEPLETION_LEVELS,
  MEDICATION_HISTORY_KEYS,
  RECIPIENT_ZONES,
  VISIBLE_SCARRING_LEVELS,
  type ClinicalHistoryUpsertPayload,
  type DonorDepletionLevel,
  type MedicationHistory,
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

  const rawDonorDepletion = input.donorDepletionLevel ?? input.donor_depletion_level;
  if (rawDonorDepletion != null && String(rawDonorDepletion).trim() && !donorDepletion) {
    return { ok: false, error: `donorDepletionLevel must be one of: ${DONOR_DEPLETION_LEVELS.join(", ")}` };
  }
  const rawScarring = input.visibleScarringLevel ?? input.visible_scarring_level;
  if (rawScarring != null && String(rawScarring).trim() && !visibleScarring) {
    return { ok: false, error: `visibleScarringLevel must be one of: ${VISIBLE_SCARRING_LEVELS.join(", ")}` };
  }

  const avgHairs = normalizeHairsPerGraft(input.averageHairsPerGraft ?? input.average_hairs_per_graft);
  const rawAvg = input.averageHairsPerGraft ?? input.average_hairs_per_graft;
  if (rawAvg != null && String(rawAvg).trim() && avgHairs === null) {
    return { ok: false, error: "averageHairsPerGraft must be between 1.0 and 4.5" };
  }

  const payload: ClinicalHistoryUpsertPayload = {
    priorSurgeryCount: normalizePositiveInt(input.priorSurgeryCount ?? input.prior_surgery_count),
    priorProcedureType: normalizeOptionalText(input.priorProcedureType ?? input.prior_procedure_type, 200),
    priorSurgeryDate,
    priorClinicName: normalizeOptionalText(input.priorClinicName ?? input.prior_clinic_name, 300),
    priorSurgeonName: normalizeOptionalText(input.priorSurgeonName ?? input.prior_surgeon_name, 300),
    priorGraftCount: normalizePositiveInt(input.priorGraftCount ?? input.prior_graft_count),
    estimatedHairCount: normalizePositiveInt(input.estimatedHairCount ?? input.estimated_hair_count),
    averageHairsPerGraft: avgHairs,
    donorGraftsRemoved: normalizePositiveInt(input.donorGraftsRemoved ?? input.donor_grafts_removed),
    recipientZones: normalizeRecipientZones(input.recipientZones ?? input.recipient_zones),
    donorDepletionLevel: donorDepletion,
    visibleScarringLevel: visibleScarring,
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
    prior_clinic_name: payload.priorClinicName,
    prior_surgeon_name: payload.priorSurgeonName,
    prior_graft_count: payload.priorGraftCount,
    estimated_hair_count: payload.estimatedHairCount,
    average_hairs_per_graft: payload.averageHairsPerGraft,
    donor_grafts_removed: payload.donorGraftsRemoved,
    recipient_zones: payload.recipientZones ?? [],
    donor_depletion_level: payload.donorDepletionLevel,
    visible_scarring_level: payload.visibleScarringLevel,
    medication_history: payload.medicationHistory ?? {},
    supporting_document_notes: payload.supportingDocumentNotes,
    clinician_summary: payload.clinicianSummary,
  };

  return { ok: true, payload, dbRow };
}
