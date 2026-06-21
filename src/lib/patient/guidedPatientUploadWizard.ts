/**
 * HA-UX-6A — pure helpers for guided patient upload wizard step navigation.
 */

import {
  getCompletedPathwayUploadKeys,
  getMissingPathwayRequiredUploadKeys,
  isPathwayRequiredUploadComplete,
  requiredPhotoKeys,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

export type GuidedWizardView = { mode: "step"; stepIndex: number } | { mode: "complete" };

export function getGuidedWizardRequiredKeys(pathway: PatientReviewPathway): readonly string[] {
  return requiredPhotoKeys[pathway];
}

export function getGuidedWizardMaxAccessibleStepIndex(
  pathway: PatientReviewPathway,
  photos: Array<{ type?: string | null }>
): number {
  const required = requiredPhotoKeys[pathway];
  const missing = getMissingPathwayRequiredUploadKeys(pathway, photos);
  if (missing.length === 0) return required.length - 1;
  const firstMissing = required.findIndex((k) => missing.includes(k));
  return firstMissing >= 0 ? firstMissing : required.length - 1;
}

export function getGuidedWizardInitialView(
  pathway: PatientReviewPathway,
  photos: Array<{ type?: string | null }>
): GuidedWizardView {
  if (isPathwayRequiredUploadComplete(pathway, photos)) {
    return { mode: "complete" };
  }
  const max = getGuidedWizardMaxAccessibleStepIndex(pathway, photos);
  return { mode: "step", stepIndex: max };
}

export function canAccessGuidedWizardStep(
  stepIndex: number,
  pathway: PatientReviewPathway,
  photos: Array<{ type?: string | null }>
): boolean {
  const required = requiredPhotoKeys[pathway];
  if (stepIndex < 0 || stepIndex >= required.length) return false;
  return stepIndex <= getGuidedWizardMaxAccessibleStepIndex(pathway, photos);
}

export function isGuidedWizardStepComplete(
  pathway: PatientReviewPathway,
  photos: Array<{ type?: string | null }>,
  stepIndex: number
): boolean {
  const key = requiredPhotoKeys[pathway][stepIndex];
  if (!key) return false;
  return getCompletedPathwayUploadKeys(pathway, photos).has(key);
}

export function resolveGuidedWizardStepAfterUpload(
  pathway: PatientReviewPathway,
  photos: Array<{ type?: string | null }>
): GuidedWizardView {
  return getGuidedWizardInitialView(pathway, photos);
}
