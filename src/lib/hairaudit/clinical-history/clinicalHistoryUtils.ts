import {
  MEDICATION_HISTORY_KEYS,
  type CaseClinicalHistoryRow,
  type ClinicalHistorySnapshot,
  type ClinicalHistoryUpsertPayload,
  type RecipientZone,
} from "./clinicalHistoryTypes";

export function buildClinicalHistorySnapshot(row: CaseClinicalHistoryRow): ClinicalHistorySnapshot {
  return {
    priorSurgeryCount: row.prior_surgery_count,
    priorProcedureType: row.prior_procedure_type,
    priorSurgeryDate: row.prior_surgery_date,
    priorClinicName: row.prior_clinic_name,
    priorSurgeonName: row.prior_surgeon_name,
    priorGraftCount: row.prior_graft_count,
    estimatedHairCount: row.estimated_hair_count,
    averageHairsPerGraft:
      row.average_hairs_per_graft != null ? Number(row.average_hairs_per_graft) : null,
    donorGraftsRemoved: row.donor_grafts_removed,
    recipientZones: (row.recipient_zones ?? []) as RecipientZone[],
    donorDepletionLevel: row.donor_depletion_level as ClinicalHistorySnapshot["donorDepletionLevel"],
    visibleScarringLevel: row.visible_scarring_level as ClinicalHistorySnapshot["visibleScarringLevel"],
    medicationHistory: row.medication_history ?? {},
    supportingDocumentNotes: row.supporting_document_notes,
    clinicianSummary: row.clinician_summary,
  };
}

export function hasMeaningfulClinicalHistory(
  row: CaseClinicalHistoryRow | ClinicalHistorySnapshot | null
): boolean {
  if (!row) return false;
  const snap = "priorSurgeryCount" in row ? row : buildClinicalHistorySnapshot(row);
  if (snap.priorSurgeryCount != null) return true;
  if (snap.priorProcedureType) return true;
  if (snap.priorSurgeryDate) return true;
  if (snap.priorClinicName) return true;
  if (snap.priorSurgeonName) return true;
  if (snap.priorGraftCount != null) return true;
  if (snap.estimatedHairCount != null) return true;
  if (snap.averageHairsPerGraft != null) return true;
  if (snap.donorGraftsRemoved != null) return true;
  if (snap.recipientZones.length > 0) return true;
  if (snap.donorDepletionLevel && snap.donorDepletionLevel !== "unknown") return true;
  if (snap.visibleScarringLevel && snap.visibleScarringLevel !== "unknown") return true;
  if (snap.supportingDocumentNotes) return true;
  if (snap.clinicianSummary) return true;
  const meds = snap.medicationHistory ?? {};
  for (const key of MEDICATION_HISTORY_KEYS) {
    if (meds[key] === true || (key === "other" && typeof meds.other === "string" && meds.other.trim())) {
      return true;
    }
  }
  return false;
}

export function clinicalHistorySnapshotFromPayload(
  payload: ClinicalHistoryUpsertPayload
): ClinicalHistorySnapshot {
  return {
    priorSurgeryCount: payload.priorSurgeryCount ?? null,
    priorProcedureType: payload.priorProcedureType ?? null,
    priorSurgeryDate: payload.priorSurgeryDate ?? null,
    priorClinicName: payload.priorClinicName ?? null,
    priorSurgeonName: payload.priorSurgeonName ?? null,
    priorGraftCount: payload.priorGraftCount ?? null,
    estimatedHairCount: payload.estimatedHairCount ?? null,
    averageHairsPerGraft: payload.averageHairsPerGraft ?? null,
    donorGraftsRemoved: payload.donorGraftsRemoved ?? null,
    recipientZones: payload.recipientZones ?? [],
    donorDepletionLevel: payload.donorDepletionLevel ?? null,
    visibleScarringLevel: payload.visibleScarringLevel ?? null,
    medicationHistory: payload.medicationHistory ?? {},
    supportingDocumentNotes: payload.supportingDocumentNotes ?? null,
    clinicianSummary: payload.clinicianSummary ?? null,
  };
}
