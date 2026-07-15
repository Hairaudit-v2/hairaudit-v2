/**
 * Auditor-only image-limited regeneration when required patient photos are missing.
 * Patient submit gate remains strict — override applies only via explicit auditor rerun reason.
 */

import { getCompletedCategories, PATIENT_REQUIRED_KEYS } from "@/lib/auditPhotoSchemas";
import { auditorPatientPhotoCategoryLabel } from "@/lib/auditor/auditorPatientPhotoCategories";
import { hasMeaningfulClinicalHistory } from "@/lib/hairaudit/clinical-history/clinicalHistoryUtils";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import {
  DEFAULT_PATIENT_REVIEW_PATHWAY,
  getMissingPathwayRequiredUploadKeys,
  normalizePatientReviewPathway,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import { readMonthsSinceFromPatientAnswers } from "@/lib/patientPhoto/patientPhotoReadinessPolicy";
import { filterPatientPhotosForAuditUse } from "@/lib/uploads/patientPhotoAuditMeta";

/** Must match `AUDITOR_RERUN_REASONS` in queueAuditorRerun.ts and DB constraint. */
export const AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED = "document_assisted_image_limited";

export const IMAGE_LIMITED_AUDIT_PATIENT_NOTICE =
  "Image-limited audit: This report was generated using the available submitted images and clinician-entered supporting information. Some required photo views were not available, so image-based assessment is limited in those areas.";

export type PatientPhotoUploadRow = { type?: string | null; metadata?: unknown };

export type MissingPatientPhotoOpts = {
  patientReviewPathway?: PatientReviewPathway | null;
  patientAnswers?: Record<string, unknown> | null;
};

function activePatientPhotoPayload(uploadRows: PatientPhotoUploadRow[]) {
  const patientRows = filterPatientPhotosForAuditUse(
    uploadRows.filter((u) => String(u.type ?? "").toLowerCase().startsWith("patient_photo:"))
  );
  return patientRows.map((u) => ({ type: u.type ?? undefined }));
}

/**
 * Missing required keys using canonical pathway satisfaction when pathway is known.
 * Falls back to legacy three-bucket model only when pathway is omitted.
 */
export function getMissingRequiredPatientPhotoKeys(
  uploadRows: PatientPhotoUploadRow[],
  opts?: MissingPatientPhotoOpts
): string[] {
  const photoPayload = activePatientPhotoPayload(uploadRows);
  if (opts?.patientReviewPathway != null || opts?.patientAnswers != null) {
    const pathway = normalizePatientReviewPathway(
      opts.patientReviewPathway ?? DEFAULT_PATIENT_REVIEW_PATHWAY
    );
    const monthsSinceBand = readMonthsSinceFromPatientAnswers(opts.patientAnswers ?? null);
    return getMissingPathwayRequiredUploadKeys(pathway, photoPayload, { monthsSinceBand });
  }
  const completed = getCompletedCategories("patient", photoPayload);
  return PATIENT_REQUIRED_KEYS.filter((k) => !completed.has(k));
}

export function getMissingRequiredPatientPhotoLabels(
  uploadRows: PatientPhotoUploadRow[],
  opts?: MissingPatientPhotoOpts
): string[] {
  const pathway =
    opts?.patientReviewPathway != null
      ? normalizePatientReviewPathway(opts.patientReviewPathway)
      : undefined;
  return getMissingRequiredPatientPhotoKeys(uploadRows, opts).map((k) =>
    auditorPatientPhotoCategoryLabel(k, pathway)
  );
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

export function isAuditorImageLimitedOverrideActor(args: {
  triggeredRole?: string | null;
  rerunSource?: string | null;
}): boolean {
  const role = String(args.triggeredRole ?? "").trim().toLowerCase();
  const source = String(args.rerunSource ?? "").trim().toLowerCase();
  return (
    role === "auditor" ||
    role === "admin" ||
    role === "operator" ||
    source === "auditor" ||
    source === "admin" ||
    source === "internal"
  );
}

/**
 * True when an auditor rerun may bypass the strict patient photo submit gate.
 * Requires explicit override reason plus at least one patient image or meaningful clinical history.
 */
export function evaluateImageLimitedPhotoOverride(args: {
  auditorRerunReason: string | null | undefined;
  photoGateAllowed: boolean;
  uploadRows: PatientPhotoUploadRow[];
  clinicalHistory: ClinicalHistorySnapshot | null;
  triggeredRole?: string | null;
  rerunSource?: string | null;
  allowImageLimitedOverride?: boolean;
  patientReviewPathway?: PatientReviewPathway | null;
  patientAnswers?: Record<string, unknown> | null;
}): ImageLimitedPhotoOverrideEval {
  const missingRequiredPhotoLabels = getMissingRequiredPatientPhotoLabels(args.uploadRows, {
    patientReviewPathway: args.patientReviewPathway,
    patientAnswers: args.patientAnswers,
  });
  const hasPatientImages = hasActivePatientPhotosForImageLimitedOverride(args.uploadRows);
  const hasClinicalHistory = hasMeaningfulClinicalHistory(args.clinicalHistory);

  const reasonMatches =
    args.auditorRerunReason === AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED;
  const actorAuthorized =
    args.allowImageLimitedOverride === true ||
    isAuditorImageLimitedOverrideActor({
      triggeredRole: args.triggeredRole,
      rerunSource: args.rerunSource,
    });

  const allowed =
    reasonMatches &&
    actorAuthorized &&
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
