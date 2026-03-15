/**
 * Canonical category and field mappings for the audit test harness.
 * Re-exports or mirrors app constants so tests use the same naming as production.
 */

import {
  DOCTOR_REQUIRED_KEYS,
  PATIENT_REQUIRED_KEYS,
  type SubmitterType,
} from "@/lib/auditPhotoSchemas";
import { REQUIRED_PATIENT_PHOTO_CATEGORIES } from "@/lib/photoCategories";
import { DOCTOR_PHOTO_CATEGORIES } from "@/lib/doctorPhotoCategories";
import { CLINIC_PHOTO_CATEGORIES } from "@/lib/clinicPhotoCategories";

export const SUBMISSION_TYPES = ["patient", "doctor", "clinic"] as const;
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

/** Patient: upload category keys (photoCategories) — stored as patient_photo:{key} */
export const PATIENT_UPLOAD_CATEGORIES_REQUIRED = [
  "preop_front",
  "preop_left",
  "preop_right",
  "preop_top",
  "preop_crown",
  "preop_donor_rear",
  "day0_recipient",
  "day0_donor",
] as const;

/** Submit readiness uses PATIENT_REQUIRED_KEYS (patient_current_*) — legacy map in auditPhotoSchemas maps preop_* → these */
export const PATIENT_REQUIRED_FOR_SUBMIT = [...PATIENT_REQUIRED_KEYS];

/** Doctor/Clinic: required photo keys for canSubmit (img_*) */
export const DOCTOR_REQUIRED_FOR_SUBMIT = [...DOCTOR_REQUIRED_KEYS];

/** Evidence manifest required categories (prepareCaseEvidence) */
export const REQUIRED_EVIDENCE_CATEGORIES = [
  "preop_front",
  "preop_top",
  "preop_donor_rear",
  "day0_recipient",
  "day0_donor",
] as const;

/** Patient legacy aliases accepted by app (photoCategories + auditPhotoSchemas) */
export const PATIENT_LEGACY_ALIASES = [
  "preop-front",
  "donor_rear",
  "donor",
  "postop",
] as const;

/** Upload type prefix per submission type */
export function uploadTypePrefix(submissionType: SubmissionType): string {
  switch (submissionType) {
    case "patient":
      return "patient_photo:";
    case "doctor":
      return "doctor_photo:";
    case "clinic":
      return "clinic_photo:";
    default:
      return "patient_photo:";
  }
}

/** Required keys for canSubmit by submission type. Clinic uses same as doctor for photo check in harness (app may treat clinic as patient for submit). */
export function getRequiredKeysForSubmit(type: SubmissionType): readonly string[] {
  if (type === "doctor" || type === "clinic") return DOCTOR_REQUIRED_FOR_SUBMIT;
  return PATIENT_REQUIRED_FOR_SUBMIT;
}

/** All category keys for doctor/clinic (img_* + file_*) */
export const DOCTOR_CLINIC_CATEGORY_KEYS = DOCTOR_PHOTO_CATEGORIES.map((c) => c.key);
export const CLINIC_CATEGORY_KEYS = CLINIC_PHOTO_CATEGORIES.map((c) => c.key);

/** SubmitterType for auditPhotoSchemas (doctor | patient | clinic). Clinic uses same schema as doctor. */
export function toSubmitterTypeForPhotos(type: SubmissionType): SubmitterType {
  return type as SubmitterType;
}
