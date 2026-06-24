/**
 * Shared patient photo gate decision for runAudit and regression tests.
 */

import { evaluatePatientPhotoSubmitGate } from "@/lib/patientPhoto/patientPhotoReadinessPolicy";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import {
  evaluateImageLimitedPhotoOverride,
  getMissingRequiredPatientPhotoLabels,
  type ImageLimitedPhotoOverrideEval,
  type PatientPhotoUploadRow,
} from "@/lib/patient/patientPhotoImageLimitedOverride";

const AUDITOR_RERUN_REASON_CORRECTED_PATIENT_PHOTOS = "corrected_patient_photos";

export type RunAuditPhotoGateLogFields = {
  caseId: string;
  rerunReason: string | null;
  imageLimitedOverrideEligible: boolean;
  imageLimitedOverrideAllowed: boolean;
  /** Diagnostic alias for Inngest `image_limited_override_gate` log. */
  overrideAllowed: boolean;
  hasPatientImages: boolean;
  hasMeaningfulClinicalHistory: boolean;
  missingRequiredPhotoLabels: string[];
  triggeredRole: string | null;
  rerunSource: string | null;
  allowImageLimitedOverride: boolean;
  photoSubmitGateAllowed: boolean;
  /** Diagnostic alias for Inngest `image_limited_override_gate` log. */
  normalPhotoGatePassed: boolean;
};

export type RunAuditPhotoGateResult = {
  allowed: boolean;
  photoSubmitGate: ReturnType<typeof evaluatePatientPhotoSubmitGate>;
  imageLimitedOverride: ImageLimitedPhotoOverrideEval;
  relaxedAuditorPatientPhotoGate: boolean;
  logFields: RunAuditPhotoGateLogFields;
};

export function evaluateRunAuditPatientPhotoGate(args: {
  caseId: string;
  uploadRows: PatientPhotoUploadRow[];
  patientAnswers: Record<string, unknown>;
  clinicalHistory: ClinicalHistorySnapshot | null;
  stageAwareSubmitEnabled: boolean;
  patientReviewPathway?: PatientReviewPathway | null;
  patientPhotosForAuditCount: number;
  auditorRerunReason: string | null;
  triggeredRole?: string | null;
  rerunSource?: string | null;
  allowImageLimitedOverride?: boolean;
  isPatientUploadAuditExcluded?: (row: PatientPhotoUploadRow) => boolean;
}): RunAuditPhotoGateResult {
  const photoSubmitGate = evaluatePatientPhotoSubmitGate({
    uploadRows: args.uploadRows,
    patientAnswers: args.patientAnswers,
    stageAwareSubmitEnabled: args.stageAwareSubmitEnabled,
    patientReviewPathway: args.patientReviewPathway ?? undefined,
  });

  const imageLimitedOverride = evaluateImageLimitedPhotoOverride({
    auditorRerunReason: args.auditorRerunReason,
    photoGateAllowed: photoSubmitGate.allowed,
    uploadRows: args.uploadRows,
    clinicalHistory: args.clinicalHistory,
    triggeredRole: args.triggeredRole,
    rerunSource: args.rerunSource,
    allowImageLimitedOverride: args.allowImageLimitedOverride,
  });

  const relaxedAuditorPatientPhotoGate =
    args.auditorRerunReason === AUDITOR_RERUN_REASON_CORRECTED_PATIENT_PHOTOS &&
    args.patientPhotosForAuditCount > 0;

  const allowed =
    photoSubmitGate.allowed || relaxedAuditorPatientPhotoGate || imageLimitedOverride.allowed;

  const missingRequiredPhotoLabels =
    imageLimitedOverride.missingRequiredPhotoLabels.length > 0
      ? imageLimitedOverride.missingRequiredPhotoLabels
      : getMissingRequiredPatientPhotoLabels(args.uploadRows);

  const imageLimitedOverrideEligible =
    imageLimitedOverride.hasPatientImages || imageLimitedOverride.hasClinicalHistory;

  return {
    allowed,
    photoSubmitGate,
    imageLimitedOverride,
    relaxedAuditorPatientPhotoGate,
    logFields: {
      caseId: args.caseId,
      rerunReason: args.auditorRerunReason,
      imageLimitedOverrideEligible,
      imageLimitedOverrideAllowed: imageLimitedOverride.allowed,
      overrideAllowed: imageLimitedOverride.allowed,
      hasPatientImages: imageLimitedOverride.hasPatientImages,
      hasMeaningfulClinicalHistory: imageLimitedOverride.hasClinicalHistory,
      missingRequiredPhotoLabels,
      triggeredRole: args.triggeredRole ?? null,
      rerunSource: args.rerunSource ?? null,
      allowImageLimitedOverride: args.allowImageLimitedOverride === true,
      photoSubmitGateAllowed: photoSubmitGate.allowed,
      normalPhotoGatePassed: photoSubmitGate.allowed,
    },
  };
}
