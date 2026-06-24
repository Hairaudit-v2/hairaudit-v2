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
    priorSurgeryTimingNote: row.prior_surgery_timing_note ?? null,
    priorClinicName: row.prior_clinic_name,
    priorSurgeonName: row.prior_surgeon_name,
    priorGraftCount: row.prior_graft_count,
    estimatedHairCount: row.estimated_hair_count,
    averageHairsPerGraft:
      row.average_hairs_per_graft != null ? Number(row.average_hairs_per_graft) : null,
    singleHairGrafts: row.single_hair_grafts ?? null,
    doubleHairGrafts: row.double_hair_grafts ?? null,
    tripleHairGrafts: row.triple_hair_grafts ?? null,
    quadrupleHairGrafts: row.quadruple_hair_grafts ?? null,
    donorGraftsRemoved: row.donor_grafts_removed,
    punchSizeMm: row.punch_size_mm != null ? Number(row.punch_size_mm) : null,
    extractionMethod: row.extraction_method as ClinicalHistorySnapshot["extractionMethod"],
    implantationMethod: row.implantation_method as ClinicalHistorySnapshot["implantationMethod"],
    transectionRatePercent:
      row.transection_rate_percent != null ? Number(row.transection_rate_percent) : null,
    survivalEstimatePercent:
      row.survival_estimate_percent != null ? Number(row.survival_estimate_percent) : null,
    recipientZones: (row.recipient_zones ?? []) as RecipientZone[],
    donorDepletionLevel: row.donor_depletion_level as ClinicalHistorySnapshot["donorDepletionLevel"],
    donorReserveAssessment: row.donor_reserve_assessment ?? null,
    visibleScarringLevel: row.visible_scarring_level as ClinicalHistorySnapshot["visibleScarringLevel"],
    surgicalTechniqueNotes: row.surgical_technique_notes ?? null,
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
  if (snap.priorSurgeryTimingNote) return true;
  if (snap.priorClinicName) return true;
  if (snap.priorSurgeonName) return true;
  if (snap.priorGraftCount != null) return true;
  if (snap.estimatedHairCount != null) return true;
  if (snap.averageHairsPerGraft != null) return true;
  if (snap.singleHairGrafts != null) return true;
  if (snap.doubleHairGrafts != null) return true;
  if (snap.tripleHairGrafts != null) return true;
  if (snap.quadrupleHairGrafts != null) return true;
  if (snap.donorGraftsRemoved != null) return true;
  if (snap.punchSizeMm != null) return true;
  if (snap.extractionMethod && snap.extractionMethod !== "unknown") return true;
  if (snap.implantationMethod && snap.implantationMethod !== "unknown") return true;
  if (snap.transectionRatePercent != null) return true;
  if (snap.survivalEstimatePercent != null) return true;
  if (snap.recipientZones.length > 0) return true;
  if (snap.donorDepletionLevel && snap.donorDepletionLevel !== "unknown") return true;
  if (snap.donorReserveAssessment) return true;
  if (snap.visibleScarringLevel && snap.visibleScarringLevel !== "unknown") return true;
  if (snap.surgicalTechniqueNotes) return true;
  if (snap.supportingDocumentNotes) return true;
  if (snap.clinicianSummary) return true;
  const meds = snap.medicationHistory ?? {};
  for (const key of MEDICATION_HISTORY_KEYS) {
    if (key === "none_unknown") continue;
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
    priorSurgeryTimingNote: payload.priorSurgeryTimingNote ?? null,
    priorClinicName: payload.priorClinicName ?? null,
    priorSurgeonName: payload.priorSurgeonName ?? null,
    priorGraftCount: payload.priorGraftCount ?? null,
    estimatedHairCount: payload.estimatedHairCount ?? null,
    averageHairsPerGraft: payload.averageHairsPerGraft ?? null,
    singleHairGrafts: payload.singleHairGrafts ?? null,
    doubleHairGrafts: payload.doubleHairGrafts ?? null,
    tripleHairGrafts: payload.tripleHairGrafts ?? null,
    quadrupleHairGrafts: payload.quadrupleHairGrafts ?? null,
    donorGraftsRemoved: payload.donorGraftsRemoved ?? null,
    punchSizeMm: payload.punchSizeMm ?? null,
    extractionMethod: payload.extractionMethod ?? null,
    implantationMethod: payload.implantationMethod ?? null,
    transectionRatePercent: payload.transectionRatePercent ?? null,
    survivalEstimatePercent: payload.survivalEstimatePercent ?? null,
    recipientZones: payload.recipientZones ?? [],
    donorDepletionLevel: payload.donorDepletionLevel ?? null,
    donorReserveAssessment: payload.donorReserveAssessment ?? null,
    visibleScarringLevel: payload.visibleScarringLevel ?? null,
    surgicalTechniqueNotes: payload.surgicalTechniqueNotes ?? null,
    medicationHistory: payload.medicationHistory ?? {},
    supportingDocumentNotes: payload.supportingDocumentNotes ?? null,
    clinicianSummary: payload.clinicianSummary ?? null,
  };
}

const MEDICATION_PATIENT_LABELS: Record<string, string> = {
  finasteride: "finasteride",
  dutasteride: "dutasteride",
  topical_minoxidil: "topical minoxidil",
  oral_minoxidil: "oral minoxidil",
  saw_palmetto: "saw palmetto",
  prp: "PRP",
  exosomes: "exosomes",
};

/**
 * Patient-safe clinical context lines — excludes internal auditor notes.
 */
export function buildPatientSafeClinicalHistoryLines(
  snapshot: ClinicalHistorySnapshot | null
): string[] {
  if (!snapshot || !hasMeaningfulClinicalHistory(snapshot)) return [];

  const lines: string[] = [];

  const graftParts: string[] = [];
  if (snapshot.priorGraftCount != null) {
    graftParts.push(`approximately ${snapshot.priorGraftCount.toLocaleString()} grafts`);
  }
  if (snapshot.estimatedHairCount != null) {
    graftParts.push(`${snapshot.estimatedHairCount.toLocaleString()} hairs`);
  }
  if (snapshot.averageHairsPerGraft != null) {
    graftParts.push(`an average ratio of ${snapshot.averageHairsPerGraft.toFixed(2)} hairs per graft`);
  }
  if (graftParts.length) {
    lines.push(`Known graft data supplied for this review: ${graftParts.join(", ")}.`);
  }

  if (snapshot.priorProcedureType) {
    const proc = snapshot.priorProcedureType.replace(/_/g, " ").toUpperCase();
    lines.push(`Prior procedure type recorded: ${proc}.`);
  }
  if (snapshot.priorSurgeryDate || snapshot.priorSurgeryTimingNote) {
    const timing = [snapshot.priorSurgeryDate, snapshot.priorSurgeryTimingNote]
      .filter(Boolean)
      .join(" — ");
    lines.push(`Prior surgery timing: ${timing}.`);
  }
  if (snapshot.punchSizeMm != null) {
    lines.push(`Known punch size from prior procedure: ${snapshot.punchSizeMm.toFixed(2)} mm.`);
  }
  if (snapshot.donorDepletionLevel && snapshot.donorDepletionLevel !== "unknown") {
    const level = snapshot.donorDepletionLevel.replace(/_/g, " ");
    lines.push(`Donor depletion assessment noted: ${level}.`);
  }
  if (snapshot.donorReserveAssessment?.trim()) {
    lines.push(`Donor reserve note: ${snapshot.donorReserveAssessment.trim()}`);
  }
  if (snapshot.visibleScarringLevel && snapshot.visibleScarringLevel !== "unknown") {
    lines.push(
      `Visible scarring level recorded: ${snapshot.visibleScarringLevel.replace(/_/g, " ")}.`
    );
  }
  if (snapshot.supportingDocumentNotes?.trim()) {
    lines.push(snapshot.supportingDocumentNotes.trim());
  }

  const activeMeds = MEDICATION_HISTORY_KEYS.filter((k) => {
    if (k === "other" || k === "none_unknown") return false;
    return snapshot.medicationHistory?.[k] === true;
  });
  if (activeMeds.length) {
    const labels = activeMeds.map((k) => MEDICATION_PATIENT_LABELS[k] ?? k.replace(/_/g, " "));
    lines.push(`Medication support noted: ${labels.join(", ")}.`);
  } else if (snapshot.medicationHistory?.none_unknown) {
    lines.push("No medication support or status unknown.");
  }

  return lines;
}
