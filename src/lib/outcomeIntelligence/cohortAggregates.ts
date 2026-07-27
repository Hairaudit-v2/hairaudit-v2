/**
 * FI-OUTCOME-INTELLIGENCE-1A — Internal aggregate query surfaces.
 *
 * Descriptive only — never success/failure/accuracy/surgeon ranking.
 * Small-cell suppression uses unique procedures, not domain-row count.
 */

import type { LongitudinalOutcomeStage, ProjectedOutcomeDomain } from "@/lib/projection/types";
import { DEFAULT_MIN_COHORT_SIZE } from "./cohortConfig";
import type { DomainComparisonFilters } from "./cohortNormalization";
import type { OutcomeCohortRepository } from "./cohortRepository";
import type {
  CohortAggregateSuppressed,
  CohortCoverageSummary,
  CohortHealthSummary,
  DomainComparisonDistribution,
  EvidenceCompletenessBand,
  OutcomeLongitudinalCohortRow,
} from "./cohortTypes";

const STAGES: LongitudinalOutcomeStage[] = [
  "month_3",
  "month_6",
  "month_9",
  "month_12",
];

function uniqueProcedureCount(rows: OutcomeLongitudinalCohortRow[]): number {
  return new Set(rows.map((r) => r.cohortProcedureKey)).size;
}

function matchesFilters(
  row: OutcomeLongitudinalCohortRow,
  filters?: DomainComparisonFilters
): boolean {
  if (!filters) return true;
  if (
    filters.procedureTypeNormalized != null &&
    row.procedureTypeNormalized !== filters.procedureTypeNormalized
  ) {
    return false;
  }
  if (filters.graftCountBand != null && row.graftCountBand !== filters.graftCountBand) {
    return false;
  }
  if (
    filters.evidenceCompletenessBand != null &&
    row.evidenceCompletenessBand !== filters.evidenceCompletenessBand
  ) {
    return false;
  }
  if (
    filters.comparisonConfidenceBand != null &&
    row.comparisonConfidenceBand !== filters.comparisonConfidenceBand
  ) {
    return false;
  }
  if (filters.treatedHairline != null && row.treatedHairline !== filters.treatedHairline) {
    return false;
  }
  if (filters.treatedTemples != null && row.treatedTemples !== filters.treatedTemples) {
    return false;
  }
  if (filters.treatedFrontal != null && row.treatedFrontal !== filters.treatedFrontal) {
    return false;
  }
  if (filters.treatedForelock != null && row.treatedForelock !== filters.treatedForelock) {
    return false;
  }
  if (filters.treatedMidScalp != null && row.treatedMidScalp !== filters.treatedMidScalp) {
    return false;
  }
  if (filters.treatedCrown != null && row.treatedCrown !== filters.treatedCrown) {
    return false;
  }
  return true;
}

function proportion(count: number, denom: number): number {
  if (denom <= 0) return 0;
  return count / denom;
}

/**
 * Status for a procedure within a stage+domain: pick the single current row.
 * (Grain guarantees at most one current row per procedure×domain×stage lineage.)
 */
function procedureStatusMap(
  rows: OutcomeLongitudinalCohortRow[]
): Map<string, OutcomeLongitudinalCohortRow> {
  const map = new Map<string, OutcomeLongitudinalCohortRow>();
  for (const row of rows) {
    if (!map.has(row.cohortProcedureKey)) {
      map.set(row.cohortProcedureKey, row);
    }
  }
  return map;
}

export type OutcomeCohortAggregateDeps = {
  cohortRepository: OutcomeCohortRepository;
  minCohortSize?: number;
};

export class OutcomeCohortAggregates {
  private readonly minCohortSize: number;

  constructor(private readonly deps: OutcomeCohortAggregateDeps) {
    this.minCohortSize = deps.minCohortSize ?? DEFAULT_MIN_COHORT_SIZE;
  }

  async getCohortCoverageSummary(): Promise<CohortCoverageSummary> {
    const current = await this.deps.cohortRepository.listCurrent();
    const totalCurrentProcedures = uniqueProcedureCount(current);

    const proceduresByStage = Object.fromEntries(
      STAGES.map((s) => [
        s,
        uniqueProcedureCount(current.filter((r) => r.followupStage === s)),
      ])
    ) as Record<LongitudinalOutcomeStage, number>;

    const domainAssessabilityByStage = Object.fromEntries(
      STAGES.map((stage) => {
        const stageRows = current.filter((r) => r.followupStage === stage);
        // Per-procedure: if any domain is assessable → assessable; else classify.
        const byProc = new Map<string, OutcomeLongitudinalCohortRow[]>();
        for (const row of stageRows) {
          const list = byProc.get(row.cohortProcedureKey) ?? [];
          list.push(row);
          byProc.set(row.cohortProcedureKey, list);
        }
        let assessable = 0;
        let notYet = 0;
        let insuff = 0;
        for (const rows of byProc.values()) {
          const hasAssessable = rows.some(
            (r) =>
              r.comparisonStatus === "consistent" ||
              r.comparisonStatus === "partially_consistent" ||
              r.comparisonStatus === "divergent"
          );
          if (hasAssessable) {
            assessable += 1;
            continue;
          }
          const allNotYet = rows.every((r) => r.comparisonStatus === "not_yet_assessable");
          if (allNotYet) {
            notYet += 1;
            continue;
          }
          insuff += 1;
        }
        return [
          stage,
          {
            assessableProcedures: assessable,
            notYetAssessableProcedures: notYet,
            insufficientEvidenceProcedures: insuff,
          },
        ];
      })
    ) as CohortCoverageSummary["domainAssessabilityByStage"];

    const evidenceCompletenessDistribution: Record<EvidenceCompletenessBand, number> = {
      low: 0,
      moderate: 0,
      high: 0,
    };
    // Unique procedures: use max evidence band seen across their current rows
    const evidenceByProc = new Map<string, EvidenceCompletenessBand>();
    const rank = { low: 0, moderate: 1, high: 2 };
    for (const row of current) {
      const prev = evidenceByProc.get(row.cohortProcedureKey);
      if (!prev || rank[row.evidenceCompletenessBand] > rank[prev]) {
        evidenceByProc.set(row.cohortProcedureKey, row.evidenceCompletenessBand);
      }
    }
    for (const band of evidenceByProc.values()) {
      evidenceCompletenessDistribution[band] += 1;
    }

    return {
      totalCurrentProcedures,
      proceduresByStage,
      domainAssessabilityByStage,
      evidenceCompletenessDistribution,
    };
  }

  /**
   * Domain comparison status distribution.
   *
   * Denominator: unique procedures with a current-lineage row for the selected
   * stage + domain (after filters), including not_yet_assessable and
   * insufficient_evidence. Never labeled accuracy/success.
   */
  async getDomainComparisonDistribution(args: {
    stage: LongitudinalOutcomeStage;
    domain: ProjectedOutcomeDomain;
    filters?: DomainComparisonFilters;
  }): Promise<DomainComparisonDistribution | CohortAggregateSuppressed> {
    const current = await this.deps.cohortRepository.listCurrent();
    const filtered = current.filter(
      (r) =>
        r.followupStage === args.stage &&
        r.projectionDomain === args.domain &&
        matchesFilters(r, args.filters)
    );
    const byProc = procedureStatusMap(filtered);
    const cohortSize = byProc.size;

    if (cohortSize < this.minCohortSize) {
      return {
        ok: false,
        code: "insufficient_cohort_size",
        cohortSize,
        minCohortSize: this.minCohortSize,
      };
    }

    let consistentCount = 0;
    let partiallyConsistentCount = 0;
    let divergentCount = 0;
    let notYetAssessableCount = 0;
    let insufficientEvidenceCount = 0;

    for (const row of byProc.values()) {
      switch (row.comparisonStatus) {
        case "consistent":
          consistentCount += 1;
          break;
        case "partially_consistent":
          partiallyConsistentCount += 1;
          break;
        case "divergent":
          divergentCount += 1;
          break;
        case "not_yet_assessable":
          notYetAssessableCount += 1;
          break;
        case "insufficient_evidence":
          insufficientEvidenceCount += 1;
          break;
      }
    }

    const assessableCount =
      consistentCount + partiallyConsistentCount + divergentCount;

    return {
      ok: true,
      stage: args.stage,
      domain: args.domain,
      cohortSize,
      consistentCount,
      partiallyConsistentCount,
      divergentCount,
      notYetAssessableCount,
      insufficientEvidenceCount,
      consistentProportion: proportion(consistentCount, cohortSize),
      partiallyConsistentProportion: proportion(partiallyConsistentCount, cohortSize),
      divergentProportion: proportion(divergentCount, cohortSize),
      notYetAssessableProportion: proportion(notYetAssessableCount, cohortSize),
      insufficientEvidenceProportion: proportion(insufficientEvidenceCount, cohortSize),
      assessableCount,
      nonAssessableTimingCount: notYetAssessableCount,
      nonAssessableEvidenceCount: insufficientEvidenceCount,
    };
  }

  async getCohortHealthSummary(): Promise<CohortHealthSummary> {
    const all = await this.deps.cohortRepository.listAll();
    const current = all.filter((r) => r.isCurrentSourceLineage);
    const uniqueProcedures = uniqueProcedureCount(current);
    const byStage = (s: LongitudinalOutcomeStage) =>
      uniqueProcedureCount(current.filter((r) => r.followupStage === s));

    const coverage = await this.getCohortCoverageSummary();
    const evidenceTotal =
      coverage.evidenceCompletenessDistribution.low +
      coverage.evidenceCompletenessDistribution.moderate +
      coverage.evidenceCompletenessDistribution.high;

    const baselineAvailableShare =
      uniqueProcedures === 0
        ? 0
        : uniqueProcedureCount(current.filter((r) => r.baselineAvailable)) /
          uniqueProcedures;

    const eligibleForFutureCalibrationCount = uniqueProcedureCount(
      current.filter(
        (r) =>
          r.followupStage === "month_12" &&
          (r.comparisonStatus === "consistent" ||
            r.comparisonStatus === "partially_consistent" ||
            r.comparisonStatus === "divergent") &&
          r.evidenceCompletenessBand !== "low"
      )
    );

    return {
      uniqueProcedures,
      month3Coverage: byStage("month_3"),
      month6Coverage: byStage("month_6"),
      month9Coverage: byStage("month_9"),
      month12Coverage: byStage("month_12"),
      highEvidenceShare: proportion(
        coverage.evidenceCompletenessDistribution.high,
        evidenceTotal
      ),
      moderateEvidenceShare: proportion(
        coverage.evidenceCompletenessDistribution.moderate,
        evidenceTotal
      ),
      lowEvidenceShare: proportion(
        coverage.evidenceCompletenessDistribution.low,
        evidenceTotal
      ),
      baselineAvailableShare,
      currentLineageRows: current.length,
      supersededRows: all.filter((r) => !r.isCurrentSourceLineage).length,
      eligibleForFutureCalibrationCount,
      // 1A default operational status — not auto-promoted by counts alone.
      calibrationReadiness: "FOUNDATION",
    };
  }
}

export function createOutcomeCohortAggregates(
  deps: OutcomeCohortAggregateDeps
): OutcomeCohortAggregates {
  return new OutcomeCohortAggregates(deps);
}
