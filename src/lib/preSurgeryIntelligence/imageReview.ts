/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Image review builders (preserve original AI values).
 */

import { PRE_SURGERY_IMAGE_REVIEW_VERSION } from "./versions";
import {
  isPreSurgeryImageRole,
  resolveImageRoleFromUploadKey,
  type PreSurgeryImageRole,
} from "./imageRoles";
import type {
  ClinicalImageReview,
  ClinicalImageReviewCorrection,
  ImageClinicianReviewStatus,
  ImageQualityFlag,
} from "./types";

export type UploadLikeForReview = {
  id: string;
  type?: string | null;
  metadata?: unknown;
  created_at?: string | null;
};

function metaRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function readConfidence(meta: Record<string, unknown>): number | null {
  const c =
    meta.ai_classification_confidence ??
    meta.classifier_confidence ??
    meta.confidence;
  return typeof c === "number" && Number.isFinite(c) ? c : null;
}

function readWarnings(meta: Record<string, unknown>): string[] {
  const w = meta.ai_classification_warnings ?? meta.classifier_warnings ?? meta.warnings;
  if (!Array.isArray(w)) return [];
  return w.map((x) => String(x)).filter(Boolean);
}

function readObservations(meta: Record<string, unknown>): string[] {
  const o = meta.ai_observations ?? meta.classifier_observations ?? meta.findings;
  if (!Array.isArray(o)) return [];
  return o.map((x) => (typeof x === "string" ? x : String((x as { title?: string }).title ?? ""))).filter(Boolean);
}

function detectSource(type: string): ClinicalImageReview["imageSource"] {
  if (type.startsWith("patient_photo:")) return "patient";
  if (type.startsWith("doctor_photo:")) return "doctor";
  if (type.startsWith("clinic_photo:")) return "clinic";
  if (type.startsWith("surgery_photo:")) return "clinician";
  return "unknown";
}

export function buildImageReviewFromUpload(
  caseId: string,
  upload: UploadLikeForReview,
  opts?: {
    requiredKeys?: readonly string[];
    now?: string;
    id?: string;
  }
): ClinicalImageReview {
  const now = opts?.now ?? new Date().toISOString();
  const type = String(upload.type ?? "");
  const meta = metaRecord(upload.metadata);
  const role = resolveImageRoleFromUploadKey(type);
  const key = type.includes(":") ? type.split(":").slice(1).join(":") : type;
  const required =
    opts?.requiredKeys != null
      ? opts.requiredKeys.includes(key)
        ? "required"
        : "optional"
      : "unknown";

  return {
    id: opts?.id ?? crypto.randomUUID(),
    caseId,
    imageId: upload.id,
    schemaVersion: PRE_SURGERY_IMAGE_REVIEW_VERSION,
    originalAiRole: role,
    originalAiConfidence: readConfidence(meta),
    originalAiWarnings: readWarnings(meta),
    originalAiObservations: readObservations(meta),
    classifierModelVersion:
      typeof meta.ai_classification_model === "string"
        ? meta.ai_classification_model
        : typeof meta.classifier_model_version === "string"
          ? meta.classifier_model_version
          : null,
    assignedRole: role,
    orientationDegrees: 0,
    mirrored: false,
    qualityFlags: [],
    reviewStatus: "pending_review",
    requiredOrOptional: required,
    imageSource: detectSource(type),
    captureDate:
      typeof meta.capture_date === "string"
        ? meta.capture_date
        : typeof meta.captured_at === "string"
          ? meta.captured_at
          : upload.created_at ?? null,
    uploaderId: typeof meta.uploaded_by === "string" ? meta.uploaded_by : null,
    clinicianNote: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export type ImageReviewPatch = {
  assignedRole?: PreSurgeryImageRole;
  orientationDegrees?: 0 | 90 | 180 | 270;
  mirrored?: boolean;
  qualityFlags?: ImageQualityFlag[];
  reviewStatus?: ImageClinicianReviewStatus;
  clinicianNote?: string | null;
  reason?: string | null;
};

export function applyImageReviewCorrection(
  review: ClinicalImageReview,
  patch: ImageReviewPatch,
  reviewedBy: string,
  opts?: { now?: string; correctionId?: string }
): { review: ClinicalImageReview; corrections: ClinicalImageReviewCorrection[] } {
  const now = opts?.now ?? new Date().toISOString();
  const corrections: ClinicalImageReviewCorrection[] = [];
  const next: ClinicalImageReview = { ...review, updatedAt: now, reviewedBy, reviewedAt: now };

  const track = <K extends keyof ClinicalImageReview>(
    field: ClinicalImageReviewCorrection["field"],
    key: K,
    value: ClinicalImageReview[K],
    originalAiValue: unknown
  ) => {
    if (review[key] === value) return;
    corrections.push({
      id: opts?.correctionId ?? crypto.randomUUID(),
      caseId: review.caseId,
      imageId: review.imageId,
      reviewId: review.id,
      field,
      previousValue: review[key],
      nextValue: value,
      originalAiValue,
      reviewedBy,
      reviewedAt: now,
      reason: patch.reason ?? null,
      modelOrRulesetVersion: review.classifierModelVersion ?? PRE_SURGERY_IMAGE_REVIEW_VERSION,
    });
    (next as Record<string, unknown>)[key] = value;
  };

  if (patch.assignedRole != null && isPreSurgeryImageRole(patch.assignedRole)) {
    track("assignedRole", "assignedRole", patch.assignedRole, review.originalAiRole);
  }
  if (patch.orientationDegrees != null) {
    track("orientationDegrees", "orientationDegrees", patch.orientationDegrees, 0);
  }
  if (patch.mirrored != null) {
    track("mirrored", "mirrored", patch.mirrored, false);
  }
  if (patch.qualityFlags != null) {
    track("qualityFlags", "qualityFlags", patch.qualityFlags, []);
  }
  if (patch.reviewStatus != null) {
    track("reviewStatus", "reviewStatus", patch.reviewStatus, "pending_review");
  }
  if (patch.clinicianNote !== undefined) {
    track("clinicianNote", "clinicianNote", patch.clinicianNote, null);
  }

  if (corrections.some((c) => c.field === "assignedRole") && next.reviewStatus === "pending_review") {
    next.reviewStatus = "corrected";
  } else if (
    patch.reviewStatus == null &&
    corrections.length > 0 &&
    next.reviewStatus === "pending_review"
  ) {
    next.reviewStatus = "corrected";
  }

  return { review: next, corrections };
}
