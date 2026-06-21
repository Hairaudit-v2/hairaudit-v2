/**
 * HA-UX-6C — pathway-specific encouragement after each required upload.
 * Deterministic mapping only — no AI generation.
 */

import type { TranslationKey } from "@/lib/i18n/translationKeys";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

/** Pause before auto-advancing after a successful required upload. */
export const PATIENT_UPLOAD_ENCOURAGEMENT_PAUSE_MS = 1200;

const ENCOURAGEMENT_KEYS: Record<PatientReviewPathway, Record<number, TranslationKey>> = {
  pre_surgery: {
    1: "patient.upload.encouragement.preSurgery.1",
    2: "patient.upload.encouragement.preSurgery.2",
    3: "patient.upload.encouragement.preSurgery.3",
    4: "patient.upload.encouragement.preSurgery.4",
    5: "patient.upload.encouragement.preSurgery.5",
  },
  post_surgery: {
    1: "patient.upload.encouragement.postSurgery.1",
    2: "patient.upload.encouragement.postSurgery.2",
    3: "patient.upload.encouragement.postSurgery.3",
    4: "patient.upload.encouragement.postSurgery.4",
    5: "patient.upload.encouragement.postSurgery.5",
  },
};

/**
 * Returns the i18n key for encouragement copy after `completedCount` required uploads
 * (1–5). Returns null when count is out of range.
 */
export function getPatientUploadEncouragementMessageKey(
  pathway: PatientReviewPathway,
  completedCount: number
): TranslationKey | null {
  if (!Number.isInteger(completedCount) || completedCount < 1 || completedCount > 5) {
    return null;
  }
  return ENCOURAGEMENT_KEYS[pathway][completedCount] ?? null;
}
