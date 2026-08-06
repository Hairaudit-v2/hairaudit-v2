/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Auditor projection corrections.
 *
 * Professional/auditor layer: mark incorrect illustrative projection regions/zones.
 * Does NOT mutate immutable approved projection bytes. Corrections are versioned rows
 * and never leak into patient Pre-Surgery Review by default.
 */

import { PRE_SURGERY_INTELLIGENCE_SCHEMA_VERSION } from "./versions";
import type { ClinicalAnnotationGeometryType, NormalisedPoint, PreSurgeryProjectionMode } from "./types";
import { validateAnnotationCoordinates } from "./annotations";

export const PRE_SURGERY_PROJECTION_CORRECTION_VERSION =
  "ha-pre-surgery-projection-correction-v1" as const;

export const PROJECTION_CORRECTION_CODES = [
  "incorrect_coverage",
  "incorrect_hairline",
  "excessive_density_implication",
  "deferred_zone_filled",
  "wrong_mode",
  "zone_boundary_error",
  "identity_or_anatomy_distortion",
  "donor_implication_misleading",
  "other_clinical_error",
] as const;

export type ProjectionCorrectionCode = (typeof PROJECTION_CORRECTION_CODES)[number];

export type ProjectionCorrectionStatus = "open" | "adjusted" | "resolved" | "withdrawn";

export type PreSurgeryProjectionCorrection = {
  id: string;
  caseId: string;
  /** Immutable approved projection snapshot this correction refers to. */
  projectionSnapshotId: string;
  projectionVersion: number;
  schemaVersion: typeof PRE_SURGERY_PROJECTION_CORRECTION_VERSION | string;
  correctionCodes: ProjectionCorrectionCode[];
  /** Clinic/auditor-facing free-text note (not patient-facing). */
  clinicalNote: string;
  zoneRefs: string[];
  geometryType: ClinicalAnnotationGeometryType | null;
  coordinates: NormalisedPoint[];
  suggestedMode: PreSurgeryProjectionMode | null;
  status: ProjectionCorrectionStatus;
  /** Soft supersession for post-review adjustments — prior row retained. */
  supersedesCorrectionId: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
  /** Learning signal id when emitted. */
  learningSignalId: string | null;
};

export type CreateProjectionCorrectionInput = {
  caseId: string;
  projectionSnapshotId: string;
  projectionVersion: number;
  correctionCodes: ProjectionCorrectionCode[];
  clinicalNote: string;
  zoneRefs?: string[];
  geometryType?: ClinicalAnnotationGeometryType | null;
  coordinates?: NormalisedPoint[];
  suggestedMode?: PreSurgeryProjectionMode | null;
  createdBy: string;
  supersedesCorrectionId?: string | null;
  now?: string;
  id?: string;
};

export function isProjectionCorrectionCode(v: string): v is ProjectionCorrectionCode {
  return (PROJECTION_CORRECTION_CODES as readonly string[]).includes(v);
}

export function createProjectionCorrection(
  input: CreateProjectionCorrectionInput
): PreSurgeryProjectionCorrection {
  const note = input.clinicalNote.trim();
  if (note.length < 8) {
    throw new Error("clinicalNote must be at least 8 characters");
  }
  if (!input.correctionCodes.length) {
    throw new Error("At least one correction code is required");
  }
  for (const code of input.correctionCodes) {
    if (!isProjectionCorrectionCode(code)) {
      throw new Error(`Invalid correction code: ${code}`);
    }
  }

  const geometryType = input.geometryType ?? null;
  const coordinates = input.coordinates ?? [];
  if (geometryType) {
    const err = validateAnnotationCoordinates(geometryType, coordinates);
    if (err) throw new Error(err);
  } else if (coordinates.length > 0) {
    throw new Error("coordinates require geometryType");
  }

  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id ?? crypto.randomUUID(),
    caseId: input.caseId,
    projectionSnapshotId: input.projectionSnapshotId,
    projectionVersion: input.projectionVersion,
    schemaVersion: PRE_SURGERY_PROJECTION_CORRECTION_VERSION,
    correctionCodes: [...input.correctionCodes],
    clinicalNote: note.slice(0, 4000),
    zoneRefs: [...(input.zoneRefs ?? [])],
    geometryType,
    coordinates: coordinates.map((p) => ({ x: p.x, y: p.y })),
    suggestedMode: input.suggestedMode ?? null,
    status: input.supersedesCorrectionId ? "adjusted" : "open",
    supersedesCorrectionId: input.supersedesCorrectionId ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedBy: null,
    updatedAt: null,
    learningSignalId: null,
  };
}

/**
 * Post-review adjustment: create a new correction row that supersedes a prior one.
 * Never mutates the projection snapshot imagery.
 */
export function adjustProjectionCorrection(
  prior: PreSurgeryProjectionCorrection,
  patch: {
    correctionCodes?: ProjectionCorrectionCode[];
    clinicalNote?: string;
    zoneRefs?: string[];
    geometryType?: ClinicalAnnotationGeometryType | null;
    coordinates?: NormalisedPoint[];
    suggestedMode?: PreSurgeryProjectionMode | null;
    status?: Exclude<ProjectionCorrectionStatus, "withdrawn">;
    updatedBy: string;
    now?: string;
    id?: string;
  }
): { superseding: PreSurgeryProjectionCorrection; priorWithdrawn: PreSurgeryProjectionCorrection } {
  if (prior.status === "withdrawn") {
    throw new Error("Cannot adjust a withdrawn correction");
  }

  const superseding = createProjectionCorrection({
    caseId: prior.caseId,
    projectionSnapshotId: prior.projectionSnapshotId,
    projectionVersion: prior.projectionVersion,
    correctionCodes: patch.correctionCodes ?? prior.correctionCodes,
    clinicalNote: patch.clinicalNote ?? prior.clinicalNote,
    zoneRefs: patch.zoneRefs ?? prior.zoneRefs,
    geometryType:
      patch.geometryType !== undefined ? patch.geometryType : prior.geometryType,
    coordinates:
      patch.coordinates !== undefined ? patch.coordinates : prior.coordinates,
    suggestedMode:
      patch.suggestedMode !== undefined ? patch.suggestedMode : prior.suggestedMode,
    createdBy: patch.updatedBy,
    supersedesCorrectionId: prior.id,
    now: patch.now,
    id: patch.id,
  });

  if (patch.status) {
    superseding.status = patch.status;
  }

  const priorWithdrawn: PreSurgeryProjectionCorrection = {
    ...prior,
    status: "withdrawn",
    updatedBy: patch.updatedBy,
    updatedAt: patch.now ?? new Date().toISOString(),
  };

  return { superseding, priorWithdrawn };
}

/** Patient report safety: corrections are internal-only by default. */
export function projectionCorrectionsArePatientVisible(): false {
  return false;
}

export function assertProjectionSnapshotImmutable(
  before: { storagePath: string | null; outputChecksum: string | null; id: string },
  after: { storagePath: string | null; outputChecksum: string | null; id: string }
): void {
  if (before.id !== after.id) {
    throw new Error("Correction must target the same projection snapshot id");
  }
  if (before.storagePath !== after.storagePath || before.outputChecksum !== after.outputChecksum) {
    throw new Error("Projection snapshot bytes/path must not mutate when recording corrections");
  }
}

export type ProjectionCorrectionAuditMetadata = {
  correctionId: string;
  projectionSnapshotId: string;
  projectionVersion: number;
  correctionCodes: ProjectionCorrectionCode[];
  status: ProjectionCorrectionStatus;
  supersedesCorrectionId: string | null;
  learningSignalId: string | null;
  schemaVersion: string;
};

export function buildProjectionCorrectionAuditMetadata(
  correction: PreSurgeryProjectionCorrection
): ProjectionCorrectionAuditMetadata {
  return {
    correctionId: correction.id,
    projectionSnapshotId: correction.projectionSnapshotId,
    projectionVersion: correction.projectionVersion,
    correctionCodes: [...correction.correctionCodes],
    status: correction.status,
    supersedesCorrectionId: correction.supersedesCorrectionId,
    learningSignalId: correction.learningSignalId,
    schemaVersion: String(correction.schemaVersion),
  };
}

// silence unused schema version import usage for consumers
void PRE_SURGERY_INTELLIGENCE_SCHEMA_VERSION;
