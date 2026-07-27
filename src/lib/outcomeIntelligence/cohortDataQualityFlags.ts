/**
 * FI-OUTCOME-INTELLIGENCE-1B — Dataset-quality flags only (not clinical alerts).
 */

import { DEFAULT_MIN_COHORT_SIZE } from "./cohortConfig";
import type { CohortDataQualityFlag } from "./cohortAuditTypes";
import type { StageCoverage } from "./cohortAuditTypes";
import type { LongitudinalOutcomeStage } from "@/lib/projection/types";
import type { MissingDataProfile, LineageHealth, SchemaVersionHealth } from "./cohortAuditTypes";

export function deriveDataQualityFlags(args: {
  uniqueProcedures: number;
  longitudinalCoverage: Record<LongitudinalOutcomeStage, StageCoverage>;
  baselineShare: number | null;
  insufficientEvidenceShareMonth12: number | null;
  lowComparisonConfidenceShare: number | null;
  zoneCounts: {
    hairline: number;
    temples: number;
    frontal: number;
    forelock: number;
    midScalp: number;
    crown: number;
  };
  missingData: MissingDataProfile;
  schemaVersionHealth: SchemaVersionHealth;
  lineageHealth: LineageHealth;
  month12Procedures: number;
  eligible: number;
  minCohortSize?: number;
}): CohortDataQualityFlag[] {
  const min = args.minCohortSize ?? DEFAULT_MIN_COHORT_SIZE;
  const flags: CohortDataQualityFlag[] = [];

  if (args.uniqueProcedures === 0) {
    flags.push("EMPTY_COHORT");
    return flags;
  }

  const m12 = args.longitudinalCoverage.month_12;
  if (
    args.uniqueProcedures >= min &&
    (m12.proportionOfCohort == null || m12.proportionOfCohort < 0.25)
  ) {
    flags.push("LOW_MONTH12_COVERAGE");
  }

  if (args.baselineShare != null && args.baselineShare < 0.4) {
    flags.push("LOW_BASELINE_COVERAGE");
  }

  if (
    args.insufficientEvidenceShareMonth12 != null &&
    args.insufficientEvidenceShareMonth12 >= 0.3 &&
    args.month12Procedures >= min
  ) {
    flags.push("HIGH_INSUFFICIENT_EVIDENCE_RATE");
  }

  if (
    args.lowComparisonConfidenceShare != null &&
    args.lowComparisonConfidenceShare >= 0.4 &&
    args.uniqueProcedures >= min
  ) {
    flags.push("HIGH_LOW_CONFIDENCE_RATE");
  }

  // Frontal-heavy imbalance: hairline+frontal dominate while crown is sparse relative to total
  const frontalish = args.zoneCounts.hairline + args.zoneCounts.frontal;
  if (
    args.uniqueProcedures >= min &&
    frontalish >= args.uniqueProcedures * 0.8 &&
    args.zoneCounts.crown > 0 &&
    args.zoneCounts.crown < args.uniqueProcedures * 0.15
  ) {
    flags.push("ZONE_REPRESENTATION_IMBALANCE");
  } else if (
    args.uniqueProcedures >= min &&
    frontalish >= args.uniqueProcedures * 0.9 &&
    args.zoneCounts.crown === 0
  ) {
    flags.push("ZONE_REPRESENTATION_IMBALANCE");
  }

  const md = args.missingData;
  if (
    args.uniqueProcedures >= min &&
    ((md.proportions.unknownGraftCountBand ?? 0) >= 0.4 ||
      (md.proportions.unknownProcedureType ?? 0) >= 0.4 ||
      (md.proportions.unknownPunchSizeBand ?? 0) >= 0.5)
  ) {
    flags.push("PROCEDURE_METADATA_MISSINGNESS");
  }

  if (args.month12Procedures < 20 || args.eligible < 10) {
    flags.push("INSUFFICIENT_MATURE_CASES");
  }

  if (args.schemaVersionHealth.heterogeneityFlagged) {
    flags.push("SCHEMA_VERSION_HETEROGENEITY");
  }

  if (args.lineageHealth.integrityIssue) {
    flags.push("LINEAGE_INTEGRITY_ISSUE");
  }

  return flags;
}
