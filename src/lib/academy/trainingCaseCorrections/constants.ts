export const TRAINING_CASE_CORRECTION_TYPES = [
  "case_details_update",
  "metrics_update",
  "upload_category_update",
  "upload_delete",
  "case_archived",
  "case_voided",
  "case_restored",
  "case_deleted",
] as const;

export type TrainingCaseCorrectionType = (typeof TRAINING_CASE_CORRECTION_TYPES)[number];

export const TRAINING_CASE_STATUSES = ["draft", "in_review", "reviewed", "archived", "voided"] as const;

export type TrainingCaseStatus = (typeof TRAINING_CASE_STATUSES)[number];

export const CORRECTION_REASON_MIN_LENGTH = 8;

export const SENSITIVE_CASE_FIELDS = new Set([
  "surgery_date",
  "training_doctor_id",
  "trainer_id",
  "status",
  "procedure_type",
  "complexity_level",
]);

export const SENSITIVE_METRICS_FIELDS = new Set([
  "grafts_attempted",
  "grafts_extracted",
  "grafts_implanted",
  "total_hairs",
  "extraction_start_time",
  "extraction_end_time",
  "implantation_start_time",
  "implantation_end_time",
  "transected_grafts_count",
  "buried_grafts_count",
  "popped_grafts_count",
]);
