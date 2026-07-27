/**
 * Shared row factory for FI-OUTCOME-INTELLIGENCE-1B tests.
 */

import {
  COHORT_SCHEMA_VERSION,
  type OutcomeLongitudinalCohortRow,
} from "@/lib/outcomeIntelligence/cohortTypes";
import type { ProjectionComparisonStatus } from "@/lib/projection/types";

export function auditRow(args: {
  procedureKey: string;
  subjectKey?: string;
  domain?: OutcomeLongitudinalCohortRow["projectionDomain"];
  stage?: OutcomeLongitudinalCohortRow["followupStage"];
  status?: ProjectionComparisonStatus;
  evidence?: OutcomeLongitudinalCohortRow["evidenceCompletenessBand"];
  current?: boolean;
  graft?: OutcomeLongitudinalCohortRow["graftCountBand"];
  procedureType?: OutcomeLongitudinalCohortRow["procedureTypeNormalized"];
  assessmentMode?: OutcomeLongitudinalCohortRow["assessmentMode"];
  baselineAvailable?: boolean;
  projectionConfidence?: OutcomeLongitudinalCohortRow["projectionConfidenceBand"];
  observationConfidence?: OutcomeLongitudinalCohortRow["observationConfidenceBand"];
  comparisonConfidence?: OutcomeLongitudinalCohortRow["comparisonConfidenceBand"];
  treatedHairline?: boolean;
  treatedFrontal?: boolean;
  treatedCrown?: boolean;
  treatedTemples?: boolean;
  donorEvidenceAvailable?: boolean;
  projectionSchemaVersion?: string;
  observationSchemaVersion?: string;
  comparisonSchemaVersion?: string;
  observationChecksum?: string;
  comparisonChecksum?: string;
  id?: string;
}): OutcomeLongitudinalCohortRow {
  const stage = args.stage ?? "month_12";
  const domain = args.domain ?? "frontal_framing";
  return {
    id:
      args.id ??
      `${args.procedureKey}-${domain}-${stage}-${args.comparisonChecksum ?? "c"}`,
    cohortSubjectKey: args.subjectKey ?? `sub-${args.procedureKey}`,
    cohortProcedureKey: args.procedureKey,
    cohortPartitionKey: "partition",
    cohortSchemaVersion: COHORT_SCHEMA_VERSION,
    projectionSnapshotChecksum: "proj",
    observationSnapshotChecksum: args.observationChecksum ?? `obs-${stage}`,
    comparisonSnapshotChecksum: args.comparisonChecksum ?? `cmp-${stage}`,
    projectionSchemaVersion: args.projectionSchemaVersion ?? "ha-projection-lineage-v1",
    observationSchemaVersion:
      args.observationSchemaVersion ?? "ha-projection-observation-v1",
    comparisonSchemaVersion:
      args.comparisonSchemaVersion ?? "ha-projection-comparison-v1",
    followupStage: stage,
    comparisonStatus: args.status ?? "consistent",
    projectionDomain: domain,
    projectionConfidenceBand: args.projectionConfidence ?? "moderate",
    observationConfidenceBand: args.observationConfidence ?? "moderate",
    comparisonConfidenceBand: args.comparisonConfidence ?? "moderate",
    assessmentMode: args.assessmentMode ?? "baseline_plus_surgery_day",
    baselineAvailable: args.baselineAvailable ?? true,
    procedureTypeNormalized: args.procedureType ?? "fue",
    graftCountBand: args.graft ?? "2500_3499",
    hairsPerGraftBand: "unknown",
    punchSizeBand: "unknown",
    treatedHairline: args.treatedHairline ?? true,
    treatedTemples: args.treatedTemples ?? false,
    treatedFrontal: args.treatedFrontal ?? true,
    treatedForelock: false,
    treatedMidScalp: false,
    treatedCrown: args.treatedCrown ?? false,
    donorEvidenceAvailable: args.donorEvidenceAvailable ?? true,
    evidenceCompletenessBand: args.evidence ?? "moderate",
    isCurrentSourceLineage: args.current ?? true,
    rowChecksum: "chk",
    sourceGeneratedAt: null,
    sourceSupersededAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Seed n procedures at month_12 frontal with optional extras. */
export async function seedProcedures(
  insert: (row: OutcomeLongitudinalCohortRow) => Promise<unknown>,
  n: number,
  opts?: {
    stage?: OutcomeLongitudinalCohortRow["followupStage"];
    alsoDensity?: boolean;
    status?: ProjectionComparisonStatus;
    crownEvery?: number;
  }
) {
  for (let i = 0; i < n; i++) {
    const key = `proc-${String(i).padStart(3, "0")}`;
    await insert(
      auditRow({
        procedureKey: key,
        stage: opts?.stage ?? "month_12",
        status: opts?.status ?? "consistent",
        treatedCrown: opts?.crownEvery ? i % opts.crownEvery === 0 : false,
      })
    );
    if (opts?.alsoDensity) {
      await insert(
        auditRow({
          procedureKey: key,
          domain: "density_distribution",
          stage: opts?.stage ?? "month_12",
          status: "partially_consistent",
        })
      );
    }
  }
}
