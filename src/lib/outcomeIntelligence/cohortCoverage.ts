/**
 * FI-OUTCOME-INTELLIGENCE-1B — Coverage maths + safe distribution helpers.
 *
 * Unique cohort_procedure_key is the primary denominator.
 */

import type { LongitudinalOutcomeStage, ProjectedOutcomeDomain } from "@/lib/projection/types";
import { DEFAULT_MIN_COHORT_SIZE } from "./cohortConfig";
import type {
  AssessabilityDistribution,
  ConfidenceDistribution,
  DomainStageStatusCounts,
  FollowUpRetention,
  SafeDistribution,
  StageCoverage,
} from "./cohortAuditTypes";
import type { OutcomeLongitudinalCohortRow } from "./cohortTypes";

export const AUDIT_STAGES: LongitudinalOutcomeStage[] = [
  "month_3",
  "month_6",
  "month_9",
  "month_12",
];

export const AUDIT_DOMAINS: ProjectedOutcomeDomain[] = [
  "frontal_framing",
  "density_distribution",
  "transition_characteristics",
  "native_hair_dependency",
  "untreated_or_lower_treatment_areas",
];

const ASSESSABLE = new Set([
  "consistent",
  "partially_consistent",
  "divergent",
]);

export function uniqueProcedureKeys(
  rows: OutcomeLongitudinalCohortRow[]
): Set<string> {
  return new Set(rows.map((r) => r.cohortProcedureKey));
}

export function uniqueSubjectKeys(
  rows: OutcomeLongitudinalCohortRow[]
): Set<string> {
  return new Set(rows.map((r) => r.cohortSubjectKey));
}

export function proportionOrNull(count: number, denom: number): number | null {
  if (denom <= 0) return null;
  return count / denom;
}

export function emptyConfidence(): ConfidenceDistribution {
  return { low: 0, moderate: 0, high: 0 };
}

/**
 * Per-procedure max evidence band across rows (unique-procedure grain).
 */
export function evidenceByProcedure(
  rows: OutcomeLongitudinalCohortRow[]
): Map<string, "low" | "moderate" | "high"> {
  const rank = { low: 0, moderate: 1, high: 2 };
  const map = new Map<string, "low" | "moderate" | "high">();
  for (const row of rows) {
    const prev = map.get(row.cohortProcedureKey);
    if (!prev || rank[row.evidenceCompletenessBand] > rank[prev]) {
      map.set(row.cohortProcedureKey, row.evidenceCompletenessBand);
    }
  }
  return map;
}

export function confidenceDistributionFromMap(
  map: Map<string, "low" | "moderate" | "high">
): ConfidenceDistribution {
  const out = emptyConfidence();
  for (const band of map.values()) out[band] += 1;
  return out;
}

/**
 * Classify a procedure's rows at a stage into assessability buckets.
 */
export function classifyProcedureAssessability(
  rows: OutcomeLongitudinalCohortRow[]
): "assessable" | "not_yet_assessable" | "insufficient_evidence" {
  if (rows.some((r) => ASSESSABLE.has(r.comparisonStatus))) return "assessable";
  if (rows.every((r) => r.comparisonStatus === "not_yet_assessable")) {
    return "not_yet_assessable";
  }
  return "insufficient_evidence";
}

export function assessabilityForStage(
  stageRows: OutcomeLongitudinalCohortRow[]
): AssessabilityDistribution {
  const byProc = groupByProcedure(stageRows);
  const out: AssessabilityDistribution = {
    assessable: 0,
    notYetAssessable: 0,
    insufficientEvidence: 0,
  };
  for (const rows of byProc.values()) {
    const cls = classifyProcedureAssessability(rows);
    if (cls === "assessable") out.assessable += 1;
    else if (cls === "not_yet_assessable") out.notYetAssessable += 1;
    else out.insufficientEvidence += 1;
  }
  return out;
}

export function groupByProcedure(
  rows: OutcomeLongitudinalCohortRow[]
): Map<string, OutcomeLongitudinalCohortRow[]> {
  const map = new Map<string, OutcomeLongitudinalCohortRow[]>();
  for (const row of rows) {
    const list = map.get(row.cohortProcedureKey) ?? [];
    list.push(row);
    map.set(row.cohortProcedureKey, list);
  }
  return map;
}

export function buildStageCoverage(args: {
  stageRows: OutcomeLongitudinalCohortRow[];
  totalUniqueProcedures: number;
}): StageCoverage {
  const { stageRows, totalUniqueProcedures } = args;
  const assess = assessabilityForStage(stageRows);
  const evidenceMap = evidenceByProcedure(stageRows);
  const withBaseline = uniqueProcedureKeys(
    stageRows.filter((r) => r.baselineAvailable)
  ).size;

  return {
    proceduresWithStage: uniqueProcedureKeys(stageRows).size,
    proportionOfCohort: proportionOrNull(
      uniqueProcedureKeys(stageRows).size,
      totalUniqueProcedures
    ),
    proceduresWithAssessableDomain: assess.assessable,
    proceduresOnlyNotYetAssessable: assess.notYetAssessable,
    proceduresWithInsufficientEvidence: assess.insufficientEvidence,
    evidenceQuality: confidenceDistributionFromMap(evidenceMap),
    baselineAvailableCount: withBaseline,
  };
}

export function buildFollowUpRetention(
  current: OutcomeLongitudinalCohortRow[]
): FollowUpRetention {
  const day0 = uniqueProcedureKeys(current).size;
  const m3 = uniqueProcedureKeys(
    current.filter((r) => r.followupStage === "month_3")
  );
  const m6 = uniqueProcedureKeys(
    current.filter((r) => r.followupStage === "month_6")
  );
  const m9 = uniqueProcedureKeys(
    current.filter((r) => r.followupStage === "month_9")
  );
  const m12 = uniqueProcedureKeys(
    current.filter((r) => r.followupStage === "month_12")
  );

  // Retention = share of prior-stage procedures that also appear at next stage
  const retention = (prior: Set<string>, next: Set<string>): number | null => {
    if (prior.size === 0) return null;
    let kept = 0;
    for (const k of prior) if (next.has(k)) kept += 1;
    return kept / prior.size;
  };

  return {
    day0ProjectionLineage: day0,
    month3Observed: m3.size,
    month6Observed: m6.size,
    month9Observed: m9.size,
    month12Observed: m12.size,
    month3ToMonth6: retention(m3, m6),
    month6ToMonth9: retention(m6, m9),
    month9ToMonth12: retention(m9, m12),
  };
}

export function domainStatusCounts(
  rows: OutcomeLongitudinalCohortRow[]
): DomainStageStatusCounts {
  const byProc = groupByProcedure(rows);
  const counts: DomainStageStatusCounts = {
    uniqueProcedures: byProc.size,
    assessable: 0,
    notYetAssessable: 0,
    insufficientEvidence: 0,
    consistent: 0,
    partiallyConsistent: 0,
    divergent: 0,
  };
  for (const procRows of byProc.values()) {
    // One row expected per procedure×domain×stage; take first if multiple
    const row = procRows[0]!;
    switch (row.comparisonStatus) {
      case "consistent":
        counts.consistent += 1;
        counts.assessable += 1;
        break;
      case "partially_consistent":
        counts.partiallyConsistent += 1;
        counts.assessable += 1;
        break;
      case "divergent":
        counts.divergent += 1;
        counts.assessable += 1;
        break;
      case "not_yet_assessable":
        counts.notYetAssessable += 1;
        break;
      case "insufficient_evidence":
        counts.insufficientEvidence += 1;
        break;
    }
  }
  return counts;
}

/**
 * Safe categorical distribution over unique procedures.
 *
 * Strategy (documented in evidence):
 * 1. Build counts per category (unique procedures).
 * 2. If total < min → suppress entire distribution.
 * 3. Categories with count < min are collapsed into `__suppressed__`.
 * 4. If `__suppressed__` itself is < min OR would leave a single
 *    reconstructable residual that reveals a small cell → suppress all.
 * 5. Never return exact under-threshold bucket counts.
 */
export function buildSafeDistribution(args: {
  /** category key → unique procedure keys in that category */
  categoryToProcedures: Map<string, Set<string>>;
  minCohortSize?: number;
}): SafeDistribution {
  const min = args.minCohortSize ?? DEFAULT_MIN_COHORT_SIZE;
  const all = new Set<string>();
  for (const set of args.categoryToProcedures.values()) {
    for (const k of set) all.add(k);
  }
  const total = all.size;
  if (total < min) {
    return { ok: false, code: "insufficient_cohort_size", minCohortSize: min };
  }

  const large: { key: string; count: number }[] = [];
  let suppressedCount = 0;
  let suppressedCategoryCount = 0;

  for (const [key, set] of args.categoryToProcedures.entries()) {
    const n = set.size;
    if (n === 0) continue;
    if (n < min) {
      suppressedCount += n;
      suppressedCategoryCount += 1;
    } else {
      large.push({ key, count: n });
    }
  }

  // If any small cells exist, only publish when collapsed "other" meets threshold
  // AND collapsing does not leave a trivially reconstructable single small cell
  // via total − sum(large). When suppressedCategoryCount === 1 and suppressedCount < min,
  // total − sum(large) === that small cell → suppress entire distribution.
  if (suppressedCategoryCount > 0) {
    if (suppressedCount < min) {
      return { ok: false, code: "insufficient_cohort_size", minCohortSize: min };
    }
    // Multiple small categories collapsed into other ≥ min — publish large + other
    large.push({ key: "__other_suppressed__", count: suppressedCount });
  }

  // Extra guard: if exactly one large bucket and suppressed residue would reveal
  // via total − large[0], already handled above when suppressedCount < min.

  const buckets = large
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => ({
      key: b.key,
      count: b.count,
      proportion: b.count / total,
    }));

  return { ok: true, total, buckets };
}

/**
 * Suppress a raw unique-procedure count when below threshold.
 * Zone metrics are overlapping (not a partition), so individual suppression
 * does not enable reconstruction from a single total alone.
 */
export function suppressCount(
  count: number,
  minCohortSize = DEFAULT_MIN_COHORT_SIZE
): number | "insufficient_cohort_size" {
  if (count > 0 && count < minCohortSize) return "insufficient_cohort_size";
  return count;
}

export function confidenceFromRows(
  rows: OutcomeLongitudinalCohortRow[],
  field:
    | "projectionConfidenceBand"
    | "observationConfidenceBand"
    | "comparisonConfidenceBand"
): ConfidenceDistribution {
  // Unique procedure: take worst (lowest) confidence across their current rows
  const rank = { low: 0, moderate: 1, high: 2 };
  const map = new Map<string, "low" | "moderate" | "high">();
  for (const row of rows) {
    const band = row[field];
    const prev = map.get(row.cohortProcedureKey);
    if (!prev || rank[band] < rank[prev]) {
      map.set(row.cohortProcedureKey, band);
    }
  }
  return confidenceDistributionFromMap(map);
}
