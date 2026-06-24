/**
 * Auditor-only image-limited regeneration when required patient photos are missing.
 * Patient submit gate remains strict — override applies only via explicit auditor rerun reason.
 */

import { getCompletedCategories, PATIENT_REQUIRED_KEYS } from "@/lib/auditPhotoSchemas";
import { auditorPatientPhotoCategoryLabel } from "@/lib/auditor/auditorPatientPhotoCategories";
import { hasMeaningfulClinicalHistory } from "@/lib/hairaudit/clinical-history/clinicalHistoryUtils";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import { filterPatientPhotosForAuditUse } from "@/lib/uploads/patientPhotoAuditMeta";

/** Must match `AUDITOR_RERUN_REASONS` in queueAuditorRerun.ts and DB constraint. */
export const AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED = "document_assisted_image_limited";

export const IMAGE_LIMITED_AUDIT_PATIENT_NOTICE =
  "Image-limited audit: This report was generated using the available submitted images and clinician-entered supporting information. Some required photo views were not available, so image-based assessment is limited in those areas.";

export type PatientPhotoUploadRow = { type?: string | null; metadata?: unknown };

export function getMissingRequiredPatientPhotoKeys(uploadRows: PatientPhotoUploadRow[]): string[] {
  const patientRows = filterPatientPhotosForAuditUse(
    uploadRows.filter((u) => String(u.type ?? "").toLowerCase().startsWith("patient_photo:"))
  );
  const photoPayload = patientRows.map((u) => ({ type: u.type ?? undefined }));
  const completed = getCompletedCategories("patient", photoPayload);
  return PATIENT_REQUIRED_KEYS.filter((k) => !completed.has(k));
}

export function getMissingRequiredPatientPhotoLabels(uploadRows: PatientPhotoUploadRow[]): string[] {
  return getMissingRequiredPatientPhotoKeys(uploadRows).map((k) => auditorPatientPhotoCategoryLabel(k));
}

export function hasActivePatientPhotosForImageLimitedOverride(uploadRows: PatientPhotoUploadRow[]): boolean {
  const patientRows = filterPatientPhotosForAuditUse(
    uploadRows.filter((u) => String(u.type ?? "").toLowerCase().startsWith("patient_photo:"))
  );
  return patientRows.length > 0;
}

export type ImageLimitedPhotoOverrideEval = {
  allowed: boolean;
  missingRequiredPhotoLabels: string[];
  hasPatientImages: boolean;
  hasClinicalHistory: boolean;
};

/**
 * True when an auditor rerun may bypass the strict patient photo submit gate.
 * Requires explicit override reason plus at least one patient image or meaningful clinical history.
 */
export function evaluateImageLimitedPhotoOverride(args: {
  auditorRerunReason: string | null | undefined;
  photoGateAllowed: boolean;
  uploadRows: PatientPhotoUploadRow[];
  clinicalHistory: ClinicalHistorySnapshot | null;
}): ImageLimitedPhotoOverrideEval {
  const missingRequiredPhotoLabels = getMissingRequiredPatientPhotoLabels(args.uploadRows);
  const hasPatientImages = hasActivePatientPhotosForImageLimitedOverride(args.uploadRows);
  const hasClinicalHistory = hasMeaningfulClinicalHistory(args.clinicalHistory);

  const allowed =
    args.auditorRerunReason === AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED &&
    !args.photoGateAllowed &&
    (hasPatientImages || hasClinicalHistory);

  return {
    allowed,
    missingRequiredPhotoLabels,
    hasPatientImages,
    hasClinicalHistory,
  };
}

export function imageLimitedRerunSupportError(): string {
  return "Add at least one patient image or structured clinical history before using image-limited regeneration.";
}
