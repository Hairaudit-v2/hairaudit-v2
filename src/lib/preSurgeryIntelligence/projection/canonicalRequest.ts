/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Canonical immutable projection request snapshot.
 * Freezes exact clinical inputs for every generation; no PHI beyond required refs.
 */

import { createHash } from "node:crypto";
import { stableStringifyForChecksum } from "@/lib/projection/canonicalChecksum";
import type { ClinicalImageAnnotation, ClinicalObservation, PreSurgeryGraftPlan } from "../types";
import type { PreSurgeryProjectionMode } from "../types";
import type { ClinicalImageReview } from "../types";
import {
  PRE_SURGERY_PROJECTION_ENGINE_VERSION,
  PRE_SURGERY_PROJECTION_GENERATION_POLICY_VERSION,
  PRE_SURGERY_PROJECTION_SAFETY_LABEL_VERSION,
} from "../versions";
import { deriveProjectionModeAllocation } from "./modes";

export type CanonicalProjectionGeometry = {
  hairlineAnnotationIds: string[];
  recipientZoneAnnotationIds: string[];
  deferredZones: string[];
  excludedZones: string[];
  zoneGraftTargets: Array<{ zone: string; grafts: number; priority: string }>;
};

export type CanonicalProjectionRequestSnapshot = {
  schemaVersion: "ha-pre-surgery-canonical-projection-request-v1";
  caseId: string;
  sourceImageIds: string[];
  primarySourceImageId: string;
  imageRoles: Array<{
    imageId: string;
    assignedRole: string;
    orientationDegrees: number;
    mirrored: boolean;
  }>;
  approvedObservationIds: string[];
  approvedGraftPlanId: string;
  approvedGraftPlanVersion: number;
  approvedGraftPlanChecksum: string;
  projectionMode: PreSurgeryProjectionMode;
  geometry: CanonicalProjectionGeometry;
  providerId: string;
  modelVersion: string;
  safetyLabelVersion: string;
  generationPolicyVersion: string;
  engineVersion: string;
  /** Opaque storage refs only — never signed URLs or patient names. */
  sourceImageRefs: Array<{ imageId: string; storageRef: string }>;
  approvedAnnotationIds: string[];
};

export type BuildCanonicalProjectionRequestInput = {
  caseId: string;
  plan: PreSurgeryGraftPlan;
  mode: PreSurgeryProjectionMode;
  sourceReviews: ClinicalImageReview[];
  primarySourceImageId: string;
  sourceImageRefs: Array<{ imageId: string; storageRef: string }>;
  approvedAnnotations: ClinicalImageAnnotation[];
  approvedObservations: ClinicalObservation[];
  providerId: string;
  modelVersion: string;
};

/**
 * Build the frozen clinical input set. Callers must pre-filter to approved,
 * non-deleted annotations and approved observations only.
 */
export function buildCanonicalProjectionRequest(
  input: BuildCanonicalProjectionRequestInput
): CanonicalProjectionRequestSnapshot {
  const allocation = deriveProjectionModeAllocation(input.plan, input.mode);
  const approvedAnnotations = input.approvedAnnotations.filter((a) => a.approved && !a.deletedAt);
  const hairlineAnnotationIds = approvedAnnotations
    .filter((a) => a.annotationType === "proposed_hairline" || a.annotationType === "existing_hairline")
    .map((a) => a.id)
    .sort();
  const recipientZoneAnnotationIds = approvedAnnotations
    .filter((a) =>
      [
        "recipient_zone",
        "frontal_tuft",
        "forelock",
        "temple_left",
        "temple_right",
        "mid_scalp",
        "crown",
      ].includes(a.annotationType)
    )
    .map((a) => a.id)
    .sort();

  const imageRoles = input.sourceReviews.map((r) => ({
    imageId: r.imageId,
    assignedRole: r.assignedRole,
    orientationDegrees: r.orientationDegrees,
    mirrored: r.mirrored,
  }));

  return {
    schemaVersion: "ha-pre-surgery-canonical-projection-request-v1",
    caseId: input.caseId,
    sourceImageIds: [...new Set(input.sourceReviews.map((r) => r.imageId))].sort(),
    primarySourceImageId: input.primarySourceImageId,
    imageRoles: imageRoles.sort((a, b) => a.imageId.localeCompare(b.imageId)),
    approvedObservationIds: input.approvedObservations
      .filter((o) => o.status === "confirmed" || o.status === "corrected")
      .map((o) => o.id)
      .sort(),
    approvedGraftPlanId: input.plan.id,
    approvedGraftPlanVersion: input.plan.version,
    approvedGraftPlanChecksum: input.plan.checksum,
    projectionMode: input.mode,
    geometry: {
      hairlineAnnotationIds,
      recipientZoneAnnotationIds,
      deferredZones: [...input.plan.deferredZones].sort(),
      excludedZones: input.plan.zones
        .filter((z) => z.priority === "defer")
        .map((z) => z.zone)
        .sort(),
      zoneGraftTargets: allocation.zoneGraftTargets,
    },
    providerId: input.providerId,
    modelVersion: input.modelVersion,
    safetyLabelVersion: PRE_SURGERY_PROJECTION_SAFETY_LABEL_VERSION,
    generationPolicyVersion: PRE_SURGERY_PROJECTION_GENERATION_POLICY_VERSION,
    engineVersion: PRE_SURGERY_PROJECTION_ENGINE_VERSION,
    sourceImageRefs: input.sourceImageRefs
      .map((r) => ({ imageId: r.imageId, storageRef: r.storageRef }))
      .sort((a, b) => a.imageId.localeCompare(b.imageId)),
    approvedAnnotationIds: approvedAnnotations.map((a) => a.id).sort(),
  };
}

export function checksumCanonicalProjectionRequest(
  snapshot: CanonicalProjectionRequestSnapshot
): string {
  return createHash("sha256").update(stableStringifyForChecksum(snapshot), "utf8").digest("hex");
}

/** Provider-facing payload — strips free-text clinician notes and patient identifiers. */
export function toProviderSafeCanonicalPayload(
  snapshot: CanonicalProjectionRequestSnapshot
): Omit<CanonicalProjectionRequestSnapshot, never> {
  // Snapshot is already PHI-minimised by construction.
  return { ...snapshot };
}
