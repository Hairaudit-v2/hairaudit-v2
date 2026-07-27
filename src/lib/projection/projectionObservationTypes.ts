/**
 * HA-PROJECTION-1E — Longitudinal observation snapshot domain types.
 *
 * Identity:
 * - projectionSnapshotId = frozen 1D projection identity (immutable lineage target)
 * - caseId = procedure identity
 * - patientId = ownership subject
 */

import type { LongitudinalOutcomeObservation, LongitudinalOutcomeStage } from "./types";
import type { ObservationLineageVersion, ObservationSchemaVersion } from "./versions";

export type ProjectionObservationStatus = "active" | "superseded";

export type ProjectionObservationSupersessionReasonCode =
  | "source_correction"
  | "late_followup_data"
  | "observation_rule_revision"
  | "manual_clinical_correction";

export const PROJECTION_OBSERVATION_SUPERSESSION_REASON_CODES = [
  "source_correction",
  "late_followup_data",
  "observation_rule_revision",
  "manual_clinical_correction",
] as const satisfies readonly ProjectionObservationSupersessionReasonCode[];

/**
 * Immutable observed outcome snapshot attached to a frozen projection.
 */
export type ProjectionObservationSnapshot = {
  id: string;
  projectionSnapshotId: string;
  caseId: string;
  patientId: string;
  stage: LongitudinalOutcomeStage;
  observedAt: string;
  observationStatus: ProjectionObservationStatus;

  observationSchemaVersion: ObservationSchemaVersion | string;
  observationLineageVersion: ObservationLineageVersion | string;
  observationChecksum: string;

  observationPayload: LongitudinalOutcomeObservation;

  createdAt: string;
  createdBy: string | null;

  supersedesObservationId: string | null;
  supersededByObservationId: string | null;
  supersessionReasonCode: ProjectionObservationSupersessionReasonCode | null;

  sourceReportId: string | null;
  sourceAuditId: string | null;
};

export type ProjectionObservationMutableMetadata = {
  observationStatus?: ProjectionObservationStatus;
  supersededByObservationId?: string | null;
};

export type CreateProjectionObservationInput = {
  projectionSnapshotId: string;
  caseId: string;
  patientId: string;
  stage: LongitudinalOutcomeStage;
  observation: LongitudinalOutcomeObservation;
  observedAt?: string;
  sourceReportId?: string | null;
  sourceAuditId?: string | null;
  createdBy?: string | null;
  supersedesObservationId?: string | null;
  supersessionReasonCode?: ProjectionObservationSupersessionReasonCode | null;
  now?: string;
  id?: string;
};

export type CreateProjectionObservationResult =
  | {
      ok: true;
      created: boolean;
      reused: boolean;
      snapshot: ProjectionObservationSnapshot;
      supersededPreviousId: string | null;
    }
  | {
      ok: false;
      reason: string;
      code:
        | "INVALID_OBSERVATION"
        | "INVALID_STAGE"
        | "INVALID_EVIDENCE"
        | "PROJECTION_NOT_FOUND"
        | "OWNERSHIP_MISMATCH"
        | "SUPERSESSION_INVALID"
        | "MUTATION_FORBIDDEN"
        | "NOT_FOUND"
        | "INTEGRITY_FAILED";
    };
