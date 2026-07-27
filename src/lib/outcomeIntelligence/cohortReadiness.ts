/**
 * FI-OUTCOME-INTELLIGENCE-1B — Conservative calibration readiness rules.
 *
 * REVIEW_FOR_CALIBRATION ≠ ML-ready. It means statistical review may be appropriate.
 */

import { DEFAULT_MIN_COHORT_SIZE } from "./cohortConfig";
import type { CohortCalibrationReadiness, OutcomeLongitudinalCohortRow } from "./cohortTypes";

function isAssessableStatus(status: string): boolean {
  return (
    status === "consistent" ||
    status === "partially_consistent" ||
    status === "divergent"
  );
}

/**
 * Conservative eligibility (unique procedures):
 * - current lineage row at month_12
 * - assessable comparison status on ≥1 domain
 * - projection/observation/comparison confidence moderate|high
 * - evidence completeness moderate|high
 */
export function countEligibleForFutureCalibration(
  current: OutcomeLongitudinalCohortRow[]
): number {
  const byProc = new Map<string, OutcomeLongitudinalCohortRow[]>();
  for (const row of current.filter((r) => r.followupStage === "month_12")) {
    const list = byProc.get(row.cohortProcedureKey) ?? [];
    list.push(row);
    byProc.set(row.cohortProcedureKey, list);
  }

  let eligible = 0;
  for (const rows of byProc.values()) {
    const assessable = rows.filter((r) => isAssessableStatus(r.comparisonStatus));
    if (assessable.length === 0) continue;
    const ok = assessable.some(
      (r) =>
        (r.projectionConfidenceBand === "moderate" ||
          r.projectionConfidenceBand === "high") &&
        (r.observationConfidenceBand === "moderate" ||
          r.observationConfidenceBand === "high") &&
        (r.comparisonConfidenceBand === "moderate" ||
          r.comparisonConfidenceBand === "high") &&
        (r.evidenceCompletenessBand === "moderate" ||
          r.evidenceCompletenessBand === "high")
    );
    if (ok) eligible += 1;
  }
  return eligible;
}

export type CalibrationReadinessResult = {
  status: CohortCalibrationReadiness;
  reasons: string[];
  blockers: string[];
  eligibleForFutureCalibrationProcedures: number;
};

/**
 * Conservative thresholds (documented in evidence):
 *
 * NOT_READY: empty / <10 unique procedures / no mature observations
 * FOUNDATION: ≥10 procedures, some longitudinal coverage, immature calibration pool
 * GROWING: Month-12 ≥20 unique procedures AND eligible ≥10 AND ≥2 domains represented at m12
 * REVIEW_FOR_CALIBRATION: Month-12 ≥50 AND eligible ≥30 AND high-evidence m12 share ≥0.4
 *   AND metadata unknown graft band share ≤0.3 AND baseline share ≥0.5
 */
export function resolveCalibrationReadiness(args: {
  uniqueProcedures: number;
  month12Procedures: number;
  eligible: number;
  domainsAtMonth12: number;
  highEvidenceShareMonth12: number | null;
  unknownGraftShare: number | null;
  baselineShare: number | null;
  materializationPopulated: boolean;
  minCohortSize?: number;
}): CalibrationReadinessResult {
  const min = args.minCohortSize ?? DEFAULT_MIN_COHORT_SIZE;
  const blockers: string[] = [];
  const reasons: string[] = [];

  if (!args.materializationPopulated || args.uniqueProcedures === 0) {
    blockers.push("No materialized current-lineage cohort rows.");
    return {
      status: "NOT_READY",
      reasons: ["Cohort is empty or materialization has not produced rows."],
      blockers,
      eligibleForFutureCalibrationProcedures: args.eligible,
    };
  }

  if (args.uniqueProcedures < min) {
    blockers.push(`Fewer than ${min} unique procedures.`);
    return {
      status: "NOT_READY",
      reasons: ["Unique procedure count below minimum cohort size."],
      blockers,
      eligibleForFutureCalibrationProcedures: args.eligible,
    };
  }

  if (args.month12Procedures === 0) {
    blockers.push("No Month-12 observations in current lineage.");
    reasons.push("Longitudinal coverage exists but no mature Month-12 rows.");
    return {
      status: "FOUNDATION",
      reasons,
      blockers,
      eligibleForFutureCalibrationProcedures: args.eligible,
    };
  }

  const reviewOk =
    args.month12Procedures >= 50 &&
    args.eligible >= 30 &&
    args.domainsAtMonth12 >= 3 &&
    (args.highEvidenceShareMonth12 ?? 0) >= 0.4 &&
    (args.unknownGraftShare ?? 1) <= 0.3 &&
    (args.baselineShare ?? 0) >= 0.5;

  if (reviewOk) {
    reasons.push(
      "Conservative mature-cohort thresholds met for statistical review (not ML-ready)."
    );
    return {
      status: "REVIEW_FOR_CALIBRATION",
      reasons,
      blockers: [],
      eligibleForFutureCalibrationProcedures: args.eligible,
    };
  }

  const growingOk =
    args.month12Procedures >= 20 &&
    args.eligible >= 10 &&
    args.domainsAtMonth12 >= 2;

  if (growingOk) {
    reasons.push("Meaningful Month-12 coverage with multi-domain representation.");
    if ((args.highEvidenceShareMonth12 ?? 0) < 0.4) {
      blockers.push("High-evidence Month-12 share below 0.4.");
    }
    if ((args.baselineShare ?? 0) < 0.5) {
      blockers.push("Baseline availability share below 0.5.");
    }
    if ((args.unknownGraftShare ?? 1) > 0.3) {
      blockers.push("Unknown graft-count-band share above 0.3.");
    }
    if (args.eligible < 30) {
      blockers.push("Eligible-for-calibration procedure count below 30.");
    }
    if (args.month12Procedures < 50) {
      blockers.push("Month-12 unique procedures below 50.");
    }
    return {
      status: "GROWING",
      reasons,
      blockers,
      eligibleForFutureCalibrationProcedures: args.eligible,
    };
  }

  reasons.push(
    "≥10 unique procedures with some longitudinal coverage; mature calibration pool still insufficient."
  );
  if (args.month12Procedures < 20) {
    blockers.push("Month-12 unique procedures below growing threshold (20).");
  }
  if (args.eligible < 10) {
    blockers.push("Eligible-for-calibration procedures below 10.");
  }
  return {
    status: "FOUNDATION",
    reasons,
    blockers,
    eligibleForFutureCalibrationProcedures: args.eligible,
  };
}
