/**
 * Gold-standard clinic answers that pass validateClinicAnswers / clinicAuditSchema.
 * Use for regression: full validation pass, readiness, manifest, scoring eligibility.
 * Set case_id at runtime (runner merges caseId into answers).
 */

import { getGoldDoctorAnswers } from "./goldDoctorAnswers";

/** Fully valid clinic payload (same required shape as doctor; submission_type = clinic). */
export function getGoldClinicAnswers(overrides?: Record<string, unknown>): Record<string, unknown> {
  return getGoldDoctorAnswers({
    submission_type: "clinic",
    ...overrides,
  });
}
