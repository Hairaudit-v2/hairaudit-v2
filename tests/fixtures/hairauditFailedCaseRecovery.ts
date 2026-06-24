/**
 * HA-QA-7B — deterministic failed post-surgery case fixture for image-limited recovery tests.
 *
 * Models a real-world failure: missing required patient views, partial images,
 * supporting graft-count document, and auditor-entered structured clinical history.
 */

import type { CaseClinicalHistoryRow } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

/** Stable ids for docs and optional E2E seeding. */
export const FAILED_CASE_RECOVERY_CASE_ID = "33333333-3333-4333-8333-333333333333";
export const FAILED_CASE_RECOVERY_EXTERNAL_CASE_ID = "test:failed-case-recovery:01";

export const FAILED_CASE_RECOVERY_PATHWAY: PatientReviewPathway = "post_surgery";

/** Post-op intake answers — required for stage-aware submit gate evaluation. */
export const FAILED_CASE_RECOVERY_PATIENT_ANSWERS = {
  months_since: "6_9" as const,
};

/**
 * One usable current front view + graft count board PDF category.
 * Missing PATIENT_REQUIRED_KEYS: patient_current_top, patient_current_donor_rear.
 */
export const FAILED_CASE_RECOVERY_UPLOAD_ROWS = [
  { type: "patient_photo:patient_current_front" },
  { type: "patient_photo:graft_count_board" },
] as const;

export const FAILED_CASE_RECOVERY_CLINICAL_HISTORY_ROW: CaseClinicalHistoryRow = {
  id: "44444444-4444-4444-8444-444444444444",
  case_id: FAILED_CASE_RECOVERY_CASE_ID,
  prior_surgery_count: 1,
  prior_procedure_type: "FUE",
  prior_surgery_date: "2024-08-20",
  prior_surgery_timing_note: null,
  prior_clinic_name: "Example Hair Clinic",
  prior_surgeon_name: "Dr Example",
  prior_graft_count: 3200,
  estimated_hair_count: 6400,
  average_hairs_per_graft: 2.0,
  single_hair_grafts: null,
  double_hair_grafts: null,
  triple_hair_grafts: null,
  quadruple_hair_grafts: null,
  donor_grafts_removed: 3100,
  punch_size_mm: 0.85,
  extraction_method: "motorised_punch",
  implantation_method: "implanter_pen",
  transection_rate_percent: null,
  survival_estimate_percent: null,
  recipient_zones: ["frontal_hairline", "mid_scalp", "crown"],
  donor_depletion_level: "mild",
  donor_reserve_assessment: null,
  visible_scarring_level: "none",
  surgical_technique_notes: null,
  medication_history: { finasteride: true },
  supporting_document_notes:
    "Operative PDF: 3200 grafts FUE, average 2.0 hairs/graft; crown and mid-scalp recipient zones documented.",
  clinician_summary:
    "Patient submitted front view only; graft board PDF confirms count. Donor rear and top views unavailable.",
  created_by: null,
  updated_by: null,
  created_at: "2026-06-24T12:00:00Z",
  updated_at: "2026-06-24T12:00:00Z",
};
