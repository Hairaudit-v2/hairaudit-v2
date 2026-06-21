import {
  DEFAULT_PATIENT_REVIEW_PATHWAY,
  getMissingPathwayRequiredUploadKeys,
  isPathwayRequiredUploadComplete,
  requiredPhotoKeys,
  resolvePathwayPhotoSlotDef,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

export type RequiredPhotoProgress = {
  completedCount: number;
  totalRequired: number;
  percent: number;
  missingKeys: string[];
  missingLabels: string[];
  isComplete: boolean;
};

function titleForPathwayKey(pathway: PatientReviewPathway, key: string): string {
  const def = resolvePathwayPhotoSlotDef(pathway, key);
  return def?.title ?? key.replace(/_/g, " ");
}

/**
 * Required-category completion for patient dashboard / progress UIs.
 * Uses pathway-specific required upload keys.
 */
export function computePatientRequiredPhotoProgress(
  uploads: Array<{ type?: string | null }>,
  patientReviewPathway: PatientReviewPathway = DEFAULT_PATIENT_REVIEW_PATHWAY
): RequiredPhotoProgress {
  const photos = uploads.map((u) => ({ type: u.type ?? undefined }));
  const totalRequired = requiredPhotoKeys[patientReviewPathway].length;
  const missingKeys = getMissingPathwayRequiredUploadKeys(patientReviewPathway, photos);
  const completedCount = totalRequired - missingKeys.length;
  const isComplete = isPathwayRequiredUploadComplete(patientReviewPathway, photos);

  return {
    completedCount,
    totalRequired,
    percent: totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 0,
    missingKeys,
    missingLabels: missingKeys.map((k) => titleForPathwayKey(patientReviewPathway, k)),
    isComplete,
  };
}
