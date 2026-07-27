/**
 * HA-PROJECTION-1A — Provenance-aware procedure metadata resolution.
 *
 * Precedence for actual graft count:
 * clinic / surgery record → auditor-confirmed clinical history → patient reported → AI estimate
 *
 * Never silently average conflicting values.
 */

import type { ProvenancedNumber, ProvenancedNumberSource } from "./types";
import { normalizeZoneList, uniqueNormalizedZones, type NormalizedZone } from "./surgeryDayZones";

export type ProcedureContextSources = {
  clinicAnswers?: Record<string, unknown> | null;
  doctorAnswers?: Record<string, unknown> | null;
  patientAnswers?: Record<string, unknown> | null;
  surgeryUploadDetails?: Record<string, unknown> | null;
  clinicalHistory?: Record<string, unknown> | null;
};

export type ResolvedProcedureContext = {
  procedureDate: string | null;
  procedureType: string | null;
  reportedGraftCount: number | null;
  actualGraftCount: number | null;
  estimatedHairCount: number | null;
  averageHairsPerGraft: number | null;
  punchSizeMm: number | null;
  extractionMethod: string | null;
  implantationMethod: string | null;
  treatedAreas: string[];
  treatedAreaZones: NormalizedZone[];
  graftProvenance: ProvenancedNumber[];
  limitations: string[];
  hasStructuredMetadata: boolean;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function toPunchMm(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function firstString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (Array.isArray(c) && c.length) {
      const joined = c.map((x) => String(x)).filter(Boolean).join(", ");
      if (joined) return joined;
    }
  }
  return null;
}

function pushProvenance(
  list: ProvenancedNumber[],
  value: number | null,
  source: ProvenancedNumberSource
): void {
  if (value == null) return;
  if (list.some((p) => p.value === value && p.source === source)) return;
  list.push({ value, source });
}

function materialConflict(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  const rel = diff / Math.max(a, b, 1);
  return diff >= 150 || rel >= 0.08;
}

/**
 * Resolve procedure context with explicit provenance. Does not invent measurements.
 */
export function resolveSurgeryDayProcedureContext(
  sources: ProcedureContextSources
): ResolvedProcedureContext {
  const clinic = asRecord(sources.clinicAnswers) ?? {};
  const doctor = asRecord(sources.doctorAnswers) ?? {};
  const patient = asRecord(sources.patientAnswers) ?? {};
  const surgery = asRecord(sources.surgeryUploadDetails) ?? {};
  const clinical = asRecord(sources.clinicalHistory) ?? {};

  // Clinical history may be camelCase snapshot or snake_case row
  const clinicalGraft =
    toNumber(clinical.priorGraftCount) ??
    toNumber(clinical.prior_graft_count) ??
    toNumber(clinical.donorGraftsRemoved) ??
    toNumber(clinical.donor_grafts_removed);

  const clinicActual =
    toNumber(clinic.actual_graft_count) ??
    toNumber(doctor.actual_graft_count) ??
    toNumber(doctor.totalGraftsImplanted) ??
    toNumber(surgery.actual_grafts);

  const clinicPlanned =
    toNumber(clinic.planned_graft_count) ??
    toNumber(doctor.planned_graft_count) ??
    toNumber(surgery.planned_grafts);

  const patientReported =
    toNumber(patient.graft_number_received) ??
    toNumber(asRecord(patient.enhanced_patient_answers)?.grafts_claimed_total);

  const graftProvenance: ProvenancedNumber[] = [];
  pushProvenance(graftProvenance, clinicActual, "clinic_reported");
  pushProvenance(graftProvenance, clinicalGraft, "auditor_confirmed");
  pushProvenance(graftProvenance, patientReported, "patient_reported");

  // Prefer actual over planned for "actualGraftCount"; planned feeds reported if no actual
  let actualGraftCount: number | null = null;
  let actualSource: ProvenancedNumberSource | null = null;
  if (clinicActual != null) {
    actualGraftCount = clinicActual;
    actualSource = "clinic_reported";
  } else if (clinicalGraft != null) {
    actualGraftCount = clinicalGraft;
    actualSource = "auditor_confirmed";
  } else if (patientReported != null) {
    actualGraftCount = patientReported;
    actualSource = "patient_reported";
  }

  const reportedGraftCount =
    clinicPlanned ?? patientReported ?? (actualSource === "patient_reported" ? null : patientReported);

  const limitations: string[] = [];
  const valuesForConflict = graftProvenance.map((p) => p.value);
  for (let i = 0; i < valuesForConflict.length; i++) {
    for (let j = i + 1; j < valuesForConflict.length; j++) {
      if (materialConflict(valuesForConflict[i]!, valuesForConflict[j]!)) {
        const a = graftProvenance[i]!;
        const b = graftProvenance[j]!;
        limitations.push(
          `${labelSource(a.source)} reports ${a.value.toLocaleString()} grafts; ${labelSource(b.source)} reports ${b.value.toLocaleString()}.`
        );
      }
    }
  }

  const procedureDate = firstString(
    surgery.surgery_date,
    clinic.surgery_date,
    doctor.surgery_date,
    patient.procedure_date,
    clinical.priorSurgeryDate,
    clinical.prior_surgery_date
  );

  const procedureType = firstString(
    clinic.primary_procedure_type,
    Array.isArray(clinic.procedure_type) ? clinic.procedure_type[0] : clinic.procedure_type,
    doctor.primary_procedure_type,
    Array.isArray(doctor.procedure_type) ? doctor.procedure_type[0] : doctor.procedure_type,
    patient.procedure_type,
    clinical.priorProcedureType,
    clinical.prior_procedure_type,
    surgery.procedure_type
  );

  const estimatedHairCount =
    toNumber(clinic.estimated_hair_count) ??
    toNumber(doctor.estimated_hair_count) ??
    toNumber(clinical.estimatedHairCount) ??
    toNumber(clinical.estimated_hair_count);

  const averageHairsPerGraft =
    toNumber(clinic.avg_hairs_per_graft) ??
    toNumber(doctor.avg_hairs_per_graft) ??
    toNumber(clinical.averageHairsPerGraft) ??
    toNumber(clinical.average_hairs_per_graft) ??
    toNumber(asRecord(patient.enhanced_patient_answers)?.graft_ratio);

  const punchSizeMm =
    toPunchMm(clinic.primary_punch_size) ??
    toPunchMm(Array.isArray(clinic.punch_sizes_used) ? clinic.punch_sizes_used[0] : null) ??
    toPunchMm(doctor.primary_punch_size) ??
    toPunchMm(surgery.punch_size) ??
    toPunchMm(clinical.punchSizeMm) ??
    toPunchMm(clinical.punch_size_mm);

  const extractionMethod = firstString(
    Array.isArray(clinic.extraction_method) ? clinic.extraction_method.join(", ") : clinic.extraction_method,
    Array.isArray(doctor.extraction_method) ? doctor.extraction_method.join(", ") : doctor.extraction_method,
    clinical.extractionMethod,
    clinical.extraction_method,
    surgery.extraction_machine
  );

  const implantationMethod = firstString(
    Array.isArray(clinic.implantation_method) ? clinic.implantation_method.join(", ") : clinic.implantation_method,
    Array.isArray(doctor.implantation_method) ? doctor.implantation_method.join(", ") : doctor.implantation_method,
    clinical.implantationMethod,
    clinical.implantation_method,
    surgery.implantation_method
  );

  const zoneParts: NormalizedZone[] = [
    ...normalizeZoneList(clinic.areas_treated, "areas_treated"),
    ...normalizeZoneList(doctor.areas_treated, "areas_treated"),
    ...normalizeZoneList(clinic.zones_planned, "zones_planned"),
    ...normalizeZoneList(doctor.zones_planned, "zones_planned"),
    ...normalizeZoneList(clinical.recipientZones ?? clinical.recipient_zones, "clinical_history"),
  ];

  const treatedNormalized = uniqueNormalizedZones(zoneParts);

  const hasStructuredMetadata = Boolean(
    procedureDate ||
      procedureType ||
      actualGraftCount != null ||
      reportedGraftCount != null ||
      punchSizeMm != null ||
      extractionMethod ||
      implantationMethod ||
      treatedNormalized.length
  );

  return {
    procedureDate,
    procedureType,
    reportedGraftCount: reportedGraftCount ?? null,
    actualGraftCount,
    estimatedHairCount,
    averageHairsPerGraft,
    punchSizeMm,
    extractionMethod,
    implantationMethod,
    treatedAreas: treatedNormalized,
    treatedAreaZones: zoneParts,
    graftProvenance,
    limitations: [...new Set(limitations)],
    hasStructuredMetadata,
  };
}

function labelSource(source: ProvenancedNumberSource): string {
  switch (source) {
    case "clinic_reported":
      return "Clinic record";
    case "auditor_confirmed":
      return "Auditor-confirmed clinical history";
    case "patient_reported":
      return "Patient intake";
    case "ai_estimated":
      return "Image-derived estimate";
    default:
      return "Record";
  }
}
