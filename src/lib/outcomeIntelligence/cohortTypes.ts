/**
 * FI-OUTCOME-INTELLIGENCE-1A — De-identified longitudinal cohort types.
 *
 * Analytics-safe only. Never include raw patient/case IDs, PHI, narratives,
 * storage paths, or provider ranking dimensions.
 */

import type {
  ComparisonConfidence,
  LongitudinalOutcomeStage,
  ObservationConfidence,
  ProjectedOutcomeDomain,
  ProjectionComparisonStatus,
  ProjectionConfidence,
  SurgeryDayReconstructionMode,
} from "@/lib/projection/types";

/** Cohort schema / materialization contract version. */
export const COHORT_SCHEMA_VERSION = "fi-outcome-cohort-v1" as const;
export type CohortSchemaVersion = typeof COHORT_SCHEMA_VERSION;

export type CohortConfidenceBand = "low" | "moderate" | "high";

export type EvidenceCompletenessBand = "low" | "moderate" | "high";

export type GraftCountBand =
  | "under_1500"
  | "1500_2499"
  | "2500_3499"
  | "3500_4499"
  | "4500_plus"
  | "unknown";

export type HairsPerGraftBand =
  | "under_1_8"
  | "1_8_to_2_1"
  | "2_1_to_2_4"
  | "over_2_4"
  | "unknown";

export type PunchSizeBand =
  | "under_0_8"
  | "0_8_to_0_89"
  | "0_9_to_0_99"
  | "1_0_plus"
  | "unknown";

export type ProcedureTypeNormalized =
  | "fue"
  | "fut"
  | "combo"
  | "other"
  | "unknown";

export type CohortCalibrationReadiness =
  | "NOT_READY"
  | "FOUNDATION"
  | "GROWING"
  | "REVIEW_FOR_CALIBRATION";

/**
 * De-identified payload used for row content checksum.
 * Identity HMAC keys are stored separately and are NOT hashed into this payload.
 */
export type CohortRowChecksumPayload = {
  cohortSchemaVersion: CohortSchemaVersion;
  projectionSnapshotChecksum: string;
  observationSnapshotChecksum: string;
  comparisonSnapshotChecksum: string;
  projectionSchemaVersion: string;
  observationSchemaVersion: string;
  comparisonSchemaVersion: string;
  followupStage: LongitudinalOutcomeStage;
  comparisonStatus: ProjectionComparisonStatus;
  projectionDomain: ProjectedOutcomeDomain;
  projectionConfidenceBand: CohortConfidenceBand;
  observationConfidenceBand: CohortConfidenceBand;
  comparisonConfidenceBand: CohortConfidenceBand;
  assessmentMode: SurgeryDayReconstructionMode | "unknown";
  baselineAvailable: boolean;
  procedureTypeNormalized: ProcedureTypeNormalized;
  graftCountBand: GraftCountBand;
  hairsPerGraftBand: HairsPerGraftBand;
  punchSizeBand: PunchSizeBand;
  treatedHairline: boolean;
  treatedTemples: boolean;
  treatedFrontal: boolean;
  treatedForelock: boolean;
  treatedMidScalp: boolean;
  treatedCrown: boolean;
  donorEvidenceAvailable: boolean;
  evidenceCompletenessBand: EvidenceCompletenessBand;
  isCurrentSourceLineage: boolean;
};

/**
 * Analytics-safe cohort row grain:
 * procedure × projection snapshot × observation × comparison domain
 */
export type OutcomeLongitudinalCohortRow = CohortRowChecksumPayload & {
  id: string;
  cohortSubjectKey: string;
  cohortProcedureKey: string;
  /**
   * Deployment-local partition HMAC — never a raw tenant/clinic ID.
   * 1A uses a single HairAudit deployment partition (no provider dimensions).
   */
  cohortPartitionKey: string;
  rowChecksum: string;
  sourceGeneratedAt: string | null;
  sourceSupersededAt: string | null;
  createdAt: string;
};

/** Allowlisted keys that may appear on serialized cohort rows / checksum payloads. */
export const COHORT_ALLOWLISTED_KEYS = new Set([
  "id",
  "cohortSubjectKey",
  "cohortProcedureKey",
  "cohortPartitionKey",
  "cohortSchemaVersion",
  "projectionSnapshotChecksum",
  "observationSnapshotChecksum",
  "comparisonSnapshotChecksum",
  "projectionSchemaVersion",
  "observationSchemaVersion",
  "comparisonSchemaVersion",
  "followupStage",
  "comparisonStatus",
  "projectionDomain",
  "projectionConfidenceBand",
  "observationConfidenceBand",
  "comparisonConfidenceBand",
  "assessmentMode",
  "baselineAvailable",
  "procedureTypeNormalized",
  "graftCountBand",
  "hairsPerGraftBand",
  "punchSizeBand",
  "treatedHairline",
  "treatedTemples",
  "treatedFrontal",
  "treatedForelock",
  "treatedMidScalp",
  "treatedCrown",
  "donorEvidenceAvailable",
  "evidenceCompletenessBand",
  "isCurrentSourceLineage",
  "rowChecksum",
  "sourceGeneratedAt",
  "sourceSupersededAt",
  "createdAt",
]);

/** Keys that must never appear in cohort analytics payloads. */
export const COHORT_PROHIBITED_KEYS = [
  "patient_id",
  "patientId",
  "case_id",
  "caseId",
  "person_id",
  "personId",
  "email",
  "phone",
  "name",
  "firstName",
  "lastName",
  "fullName",
  "dob",
  "dateOfBirth",
  "address",
  "postcode",
  "postalCode",
  "zip",
  "storage_path",
  "storagePath",
  "url",
  "signedUrl",
  "signed_url",
  "filename",
  "fileName",
  "clinician_notes",
  "clinicianNotes",
  "prompt",
  "raw_ai",
  "rawAi",
  "surgeon_id",
  "surgeonId",
  "clinic_id",
  "clinicId",
  "doctor_id",
  "doctorId",
  "tenant_id",
  "tenantId",
  "report_id",
  "reportId",
  "sourceReportId",
  "procedureDate",
  "exact_procedure_date",
] as const;

export type CohortAggregateSuppressed = {
  ok: false;
  code: "insufficient_cohort_size";
  cohortSize: number;
  minCohortSize: number;
};

export type DomainComparisonDistribution = {
  ok: true;
  stage: LongitudinalOutcomeStage;
  domain: ProjectedOutcomeDomain;
  /**
   * Denominator: unique procedures with a current-lineage cohort row for this
   * stage + domain (all comparison statuses including not_yet_assessable /
   * insufficient_evidence).
   */
  cohortSize: number;
  consistentCount: number;
  partiallyConsistentCount: number;
  divergentCount: number;
  notYetAssessableCount: number;
  insufficientEvidenceCount: number;
  consistentProportion: number;
  partiallyConsistentProportion: number;
  divergentProportion: number;
  notYetAssessableProportion: number;
  insufficientEvidenceProportion: number;
  assessableCount: number;
  nonAssessableTimingCount: number;
  nonAssessableEvidenceCount: number;
};

export type CohortCoverageSummary = {
  totalCurrentProcedures: number;
  proceduresByStage: Record<LongitudinalOutcomeStage, number>;
  domainAssessabilityByStage: Record<
    LongitudinalOutcomeStage,
    {
      assessableProcedures: number;
      notYetAssessableProcedures: number;
      insufficientEvidenceProcedures: number;
    }
  >;
  evidenceCompletenessDistribution: Record<EvidenceCompletenessBand, number>;
};

export type CohortHealthSummary = {
  uniqueProcedures: number;
  month3Coverage: number;
  month6Coverage: number;
  month9Coverage: number;
  month12Coverage: number;
  highEvidenceShare: number;
  moderateEvidenceShare: number;
  lowEvidenceShare: number;
  baselineAvailableShare: number;
  currentLineageRows: number;
  supersededRows: number;
  eligibleForFutureCalibrationCount: number;
  calibrationReadiness: CohortCalibrationReadiness;
};

export type MaterializeCohortResult =
  | {
      ok: true;
      created: number;
      reused: number;
      supersededMarked: number;
      rows: OutcomeLongitudinalCohortRow[];
    }
  | {
      ok: false;
      code:
        | "FEATURE_DISABLED"
        | "MISSING_HMAC_SECRET"
        | "GOVERNANCE_BLOCKED"
        | "LINEAGE_MISMATCH"
        | "SOURCE_NOT_FOUND"
        | "DEIDENTIFICATION_REJECTED"
        | "INVALID_DOMAIN"
        | "INVALID_STAGE"
        | "INVALID_STATUS";
      reason: string;
    };

/** Re-export projection vocabularies used by cohort consumers. */
export type {
  LongitudinalOutcomeStage,
  ProjectedOutcomeDomain,
  ProjectionComparisonStatus,
  ProjectionConfidence,
  ObservationConfidence,
  ComparisonConfidence,
  SurgeryDayReconstructionMode,
};
