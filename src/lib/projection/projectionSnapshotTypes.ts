/**
 * HA-PROJECTION-1D — Projection snapshot domain types.
 *
 * Identity mapping (HairAudit case-centric):
 * - caseId ≡ procedure key (no separate procedures table)
 * - patientId ≡ ownership subject (cases.patient_id / cases.user_id at create time)
 * - No tenant_id column; isolation is case + patient ownership at the domain layer
 */

import type {
  ProjectionConfidence,
  ReconstructionConfidence,
  SurgeryDayProcedureReconstruction,
  SurgeryDayProjectedOutcome,
  SurgeryDayProjectionAssessmentType,
} from "./types";
import type {
  ProjectionEngineVersion,
  ProjectionSnapshotSchemaVersion,
  ReconstructionContractVersion,
} from "./versions";

export type ProjectionSnapshotStatus = "active" | "superseded";

export type ProjectionSupersessionReasonCode =
  | "source_correction"
  | "late_surgery_data"
  | "projection_rule_revision"
  | "manual_clinical_correction";

export const PROJECTION_SUPERSESSION_REASON_CODES = [
  "source_correction",
  "late_surgery_data",
  "projection_rule_revision",
  "manual_clinical_correction",
] as const satisfies readonly ProjectionSupersessionReasonCode[];

export type ProjectionConfidenceSummary = {
  reconstructionConfidence: ReconstructionConfidence;
  projectionConfidence: ProjectionConfidence;
  characteristicCount: number;
  limitationCount: number;
};

export type ProjectionEvidenceSummary = {
  presentRoles: string[];
  baselineAvailable: boolean;
  assessmentType: SurgeryDayProjectionAssessmentType;
  reconstructionAssessmentType: SurgeryDayProcedureReconstruction["assessmentType"];
};

/**
 * Immutable projection snapshot (domain shape).
 * Once committed, reconstruction/projection payloads and checksums must not mutate.
 */
export type ProjectionSnapshot = {
  id: string;
  caseId: string;
  patientId: string;
  /** HairAudit procedure key — same as caseId (documented alias). */
  procedureId: string;
  projectionType: SurgeryDayProjectionAssessmentType;
  projectionStatus: ProjectionSnapshotStatus;

  reconstructionVersion: ReconstructionContractVersion | string;
  projectionEngineVersion: ProjectionEngineVersion | string;
  snapshotSchemaVersion: ProjectionSnapshotSchemaVersion | string;
  reportTemplateVersion: number;

  reconstructionInputChecksum: string;
  projectionInputChecksum: string;
  projectionOutputChecksum: string;

  reconstructionSnapshot: SurgeryDayProcedureReconstruction;
  projectionSnapshot: SurgeryDayProjectedOutcome;

  confidenceSummary: ProjectionConfidenceSummary;
  evidenceSummary: ProjectionEvidenceSummary;

  createdAt: string;
  createdBy: string | null;

  supersedesProjectionId: string | null;
  supersededByProjectionId: string | null;
  lineageRootId: string;
  supersessionReasonCode: ProjectionSupersessionReasonCode | null;

  sourceReportId: string | null;
  sourceAssessmentId: string | null;
};

/** Mutable metadata allowed after commit (lineage pointers only). */
export type ProjectionSnapshotMutableMetadata = {
  projectionStatus?: ProjectionSnapshotStatus;
  supersededByProjectionId?: string | null;
};

export type CreateProjectionSnapshotInput = {
  caseId: string;
  patientId: string;
  reconstruction: SurgeryDayProcedureReconstruction;
  projectedOutcome: SurgeryDayProjectedOutcome;
  sourceReportId?: string | null;
  sourceAssessmentId?: string | null;
  reportTemplateVersion?: number;
  createdBy?: string | null;
  /** When set, prior active snapshot is superseded (must match case/patient). */
  supersedesProjectionId?: string | null;
  supersessionReasonCode?: ProjectionSupersessionReasonCode | null;
  /** Optional fixed clock for tests. */
  now?: string;
  /** Optional fixed id for tests. */
  id?: string;
};

export type CreateProjectionSnapshotResult =
  | {
      ok: true;
      created: boolean;
      reused: boolean;
      snapshot: ProjectionSnapshot;
      supersededPreviousId: string | null;
    }
  | {
      ok: false;
      reason: string;
      code:
        | "INVALID_RECONSTRUCTION"
        | "INVALID_PROJECTION"
        | "OWNERSHIP_MISMATCH"
        | "SUPERSESSION_INVALID"
        | "MUTATION_FORBIDDEN"
        | "NOT_FOUND"
        | "INTEGRITY_FAILED";
    };

/**
 * Future longitudinal observation attachment contract (not fully implemented).
 * Observations must reference a frozen projection_id — never recalculate day-0.
 */
export type LongitudinalObservationTimepoint =
  | "month_3"
  | "month_6"
  | "month_9"
  | "month_12";

export type LongitudinalObservationReference = {
  projectionId: string;
  procedureId: string;
  caseId: string;
  observationTimepoint: LongitudinalObservationTimepoint;
  observationDate: string;
  measurementVersion?: string | null;
};
