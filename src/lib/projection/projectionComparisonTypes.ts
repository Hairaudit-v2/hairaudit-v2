/**
 * HA-PROJECTION-1F — Projected vs observed comparison snapshot domain types.
 *
 * Identity:
 * - projectionSnapshotId = frozen 1D projection
 * - observationSnapshotId = frozen 1E observation (must already belong to the projection)
 */

import type {
  LongitudinalOutcomeStage,
  ProjectionObservedComparison,
} from "./types";
import type { ComparisonSchemaVersion } from "./versions";

export type ProjectionComparisonStatusRow = "active" | "superseded";

export type ProjectionComparisonSupersessionReasonCode =
  | "observation_correction"
  | "comparison_rule_revision"
  | "manual_clinical_correction";

export const PROJECTION_COMPARISON_SUPERSESSION_REASON_CODES = [
  "observation_correction",
  "comparison_rule_revision",
  "manual_clinical_correction",
] as const satisfies readonly ProjectionComparisonSupersessionReasonCode[];

/**
 * Immutable comparison snapshot linking a frozen projection to a frozen observation.
 */
export type ProjectionComparisonSnapshot = {
  id: string;
  projectionSnapshotId: string;
  observationSnapshotId: string;
  caseId: string;
  patientId: string;
  stage: LongitudinalOutcomeStage;

  comparisonStatus: ProjectionComparisonStatusRow;
  comparisonSchemaVersion: ComparisonSchemaVersion | string;
  /** Frozen 1D snapshot schema / lineage version at comparison time. */
  projectionSchemaVersion: string;
  /** Frozen 1E observation schema version at comparison time. */
  observationSchemaVersion: string;
  comparisonChecksum: string;

  comparisonPayload: ProjectionObservedComparison;

  createdAt: string;
  createdBy: string | null;

  supersedesComparisonId: string | null;
  supersededByComparisonId: string | null;
  supersessionReasonCode: ProjectionComparisonSupersessionReasonCode | null;
};

export type ProjectionComparisonMutableMetadata = {
  comparisonStatus?: ProjectionComparisonStatusRow;
  supersededByComparisonId?: string | null;
};

export type CreateProjectionComparisonInput = {
  projectionSnapshotId: string;
  observationSnapshotId: string;
  caseId: string;
  patientId: string;
  createdBy?: string | null;
  supersedesComparisonId?: string | null;
  supersessionReasonCode?: ProjectionComparisonSupersessionReasonCode | null;
  now?: string;
  id?: string;
};

export type CreateProjectionComparisonResult =
  | {
      ok: true;
      created: boolean;
      reused: boolean;
      snapshot: ProjectionComparisonSnapshot;
      supersededPreviousId: string | null;
    }
  | {
      ok: false;
      reason: string;
      code:
        | "PROJECTION_NOT_FOUND"
        | "OBSERVATION_NOT_FOUND"
        | "LINEAGE_MISMATCH"
        | "OWNERSHIP_MISMATCH"
        | "INVALID_STAGE"
        | "INVALID_COMPARISON"
        | "UNSAFE_COMPARISON"
        | "SUPERSESSION_INVALID"
        | "MUTATION_FORBIDDEN"
        | "NOT_FOUND"
        | "INTEGRITY_FAILED";
    };
