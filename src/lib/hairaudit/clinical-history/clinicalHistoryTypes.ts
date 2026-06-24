export const DONOR_DEPLETION_LEVELS = ["none", "mild", "moderate", "severe", "unknown"] as const;
export type DonorDepletionLevel = (typeof DONOR_DEPLETION_LEVELS)[number];

export const VISIBLE_SCARRING_LEVELS = ["none", "mild", "moderate", "severe", "unknown"] as const;
export type VisibleScarringLevel = (typeof VISIBLE_SCARRING_LEVELS)[number];

export const PRIOR_PROCEDURE_TYPES = ["fue", "fut", "dhi", "repair", "unknown"] as const;
export type PriorProcedureType = (typeof PRIOR_PROCEDURE_TYPES)[number];

export const EXTRACTION_METHODS = ["manual_punch", "motorised_punch", "robotic", "unknown"] as const;
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];

export const IMPLANTATION_METHODS = ["forceps", "implanter_pen", "dhi", "unknown"] as const;
export type ImplantationMethod = (typeof IMPLANTATION_METHODS)[number];

export const PUNCH_SIZE_PRESETS = ["0.75", "0.80", "0.85", "0.90", "1.00", "unknown"] as const;
export type PunchSizePreset = (typeof PUNCH_SIZE_PRESETS)[number];

export const RECIPIENT_ZONES = [
  "frontal_hairline",
  "temples",
  "mid_scalp",
  "crown",
  "donor",
  "unknown",
] as const;
export type RecipientZone = (typeof RECIPIENT_ZONES)[number];

export const MEDICATION_HISTORY_KEYS = [
  "finasteride",
  "dutasteride",
  "topical_minoxidil",
  "oral_minoxidil",
  "saw_palmetto",
  "prp",
  "exosomes",
  "none_unknown",
  "other",
] as const;
export type MedicationHistoryKey = (typeof MEDICATION_HISTORY_KEYS)[number];

export type MedicationHistory = Partial<Record<MedicationHistoryKey, boolean | string>>;

export type CaseClinicalHistoryRow = {
  id: string;
  case_id: string;
  prior_surgery_count: number | null;
  prior_procedure_type: string | null;
  prior_surgery_date: string | null;
  prior_surgery_timing_note: string | null;
  prior_clinic_name: string | null;
  prior_surgeon_name: string | null;
  prior_graft_count: number | null;
  estimated_hair_count: number | null;
  average_hairs_per_graft: number | null;
  single_hair_grafts: number | null;
  double_hair_grafts: number | null;
  triple_hair_grafts: number | null;
  quadruple_hair_grafts: number | null;
  donor_grafts_removed: number | null;
  punch_size_mm: number | null;
  extraction_method: string | null;
  implantation_method: string | null;
  transection_rate_percent: number | null;
  survival_estimate_percent: number | null;
  recipient_zones: string[];
  donor_depletion_level: string | null;
  donor_reserve_assessment: string | null;
  visible_scarring_level: string | null;
  surgical_technique_notes: string | null;
  medication_history: MedicationHistory;
  supporting_document_notes: string | null;
  clinician_summary: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicalHistorySnapshot = {
  priorSurgeryCount: number | null;
  priorProcedureType: string | null;
  priorSurgeryDate: string | null;
  priorSurgeryTimingNote: string | null;
  priorClinicName: string | null;
  priorSurgeonName: string | null;
  priorGraftCount: number | null;
  estimatedHairCount: number | null;
  averageHairsPerGraft: number | null;
  singleHairGrafts: number | null;
  doubleHairGrafts: number | null;
  tripleHairGrafts: number | null;
  quadrupleHairGrafts: number | null;
  donorGraftsRemoved: number | null;
  punchSizeMm: number | null;
  extractionMethod: ExtractionMethod | null;
  implantationMethod: ImplantationMethod | null;
  transectionRatePercent: number | null;
  survivalEstimatePercent: number | null;
  recipientZones: RecipientZone[];
  donorDepletionLevel: DonorDepletionLevel | null;
  donorReserveAssessment: string | null;
  visibleScarringLevel: VisibleScarringLevel | null;
  surgicalTechniqueNotes: string | null;
  medicationHistory: MedicationHistory;
  supportingDocumentNotes: string | null;
  clinicianSummary: string | null;
};

export type ClinicalHistoryUpsertPayload = {
  priorSurgeryCount?: number | null;
  priorProcedureType?: string | null;
  priorSurgeryDate?: string | null;
  priorSurgeryTimingNote?: string | null;
  priorClinicName?: string | null;
  priorSurgeonName?: string | null;
  priorGraftCount?: number | null;
  estimatedHairCount?: number | null;
  averageHairsPerGraft?: number | null;
  singleHairGrafts?: number | null;
  doubleHairGrafts?: number | null;
  tripleHairGrafts?: number | null;
  quadrupleHairGrafts?: number | null;
  donorGraftsRemoved?: number | null;
  punchSizeMm?: number | null;
  extractionMethod?: ExtractionMethod | null;
  implantationMethod?: ImplantationMethod | null;
  transectionRatePercent?: number | null;
  survivalEstimatePercent?: number | null;
  recipientZones?: RecipientZone[];
  donorDepletionLevel?: DonorDepletionLevel | null;
  donorReserveAssessment?: string | null;
  visibleScarringLevel?: VisibleScarringLevel | null;
  surgicalTechniqueNotes?: string | null;
  medicationHistory?: MedicationHistory;
  supportingDocumentNotes?: string | null;
  clinicianSummary?: string | null;
};
