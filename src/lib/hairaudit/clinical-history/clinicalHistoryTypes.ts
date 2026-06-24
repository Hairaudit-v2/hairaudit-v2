export const DONOR_DEPLETION_LEVELS = ["none", "mild", "moderate", "severe", "unknown"] as const;
export type DonorDepletionLevel = (typeof DONOR_DEPLETION_LEVELS)[number];

export const VISIBLE_SCARRING_LEVELS = ["none", "mild", "moderate", "severe", "unknown"] as const;
export type VisibleScarringLevel = (typeof VISIBLE_SCARRING_LEVELS)[number];

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
  prior_clinic_name: string | null;
  prior_surgeon_name: string | null;
  prior_graft_count: number | null;
  estimated_hair_count: number | null;
  average_hairs_per_graft: number | null;
  donor_grafts_removed: number | null;
  recipient_zones: string[];
  donor_depletion_level: string | null;
  visible_scarring_level: string | null;
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
  priorClinicName: string | null;
  priorSurgeonName: string | null;
  priorGraftCount: number | null;
  estimatedHairCount: number | null;
  averageHairsPerGraft: number | null;
  donorGraftsRemoved: number | null;
  recipientZones: RecipientZone[];
  donorDepletionLevel: DonorDepletionLevel | null;
  visibleScarringLevel: VisibleScarringLevel | null;
  medicationHistory: MedicationHistory;
  supportingDocumentNotes: string | null;
  clinicianSummary: string | null;
};

export type ClinicalHistoryUpsertPayload = {
  priorSurgeryCount?: number | null;
  priorProcedureType?: string | null;
  priorSurgeryDate?: string | null;
  priorClinicName?: string | null;
  priorSurgeonName?: string | null;
  priorGraftCount?: number | null;
  estimatedHairCount?: number | null;
  averageHairsPerGraft?: number | null;
  donorGraftsRemoved?: number | null;
  recipientZones?: RecipientZone[];
  donorDepletionLevel?: DonorDepletionLevel | null;
  visibleScarringLevel?: VisibleScarringLevel | null;
  medicationHistory?: MedicationHistory;
  supportingDocumentNotes?: string | null;
  clinicianSummary?: string | null;
};
