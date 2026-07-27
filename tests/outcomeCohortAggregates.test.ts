/**
 * FI-OUTCOME-INTELLIGENCE-1A — Aggregate + small-cell protection tests.
 * Run: pnpm exec tsx --test tests/outcomeCohortAggregates.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createOutcomeCohortAggregates } from "@/lib/outcomeIntelligence/cohortAggregates";
import { InMemoryOutcomeCohortRepository } from "@/lib/outcomeIntelligence/cohortRepository";
import {
  COHORT_SCHEMA_VERSION,
  type OutcomeLongitudinalCohortRow,
} from "@/lib/outcomeIntelligence/cohortTypes";
import type { ProjectionComparisonStatus } from "@/lib/projection/types";

function row(args: {
  procedureKey: string;
  domain?: OutcomeLongitudinalCohortRow["projectionDomain"];
  stage?: OutcomeLongitudinalCohortRow["followupStage"];
  status?: ProjectionComparisonStatus;
  evidence?: OutcomeLongitudinalCohortRow["evidenceCompletenessBand"];
  current?: boolean;
  graft?: OutcomeLongitudinalCohortRow["graftCountBand"];
  observationChecksum?: string;
  comparisonChecksum?: string;
}): OutcomeLongitudinalCohortRow {
  const stage = args.stage ?? "month_12";
  return {
    id: `${args.procedureKey}-${args.domain ?? "frontal_framing"}-${stage}`,
    cohortSubjectKey: `sub-${args.procedureKey}`,
    cohortProcedureKey: args.procedureKey,
    cohortPartitionKey: "partition",
    cohortSchemaVersion: COHORT_SCHEMA_VERSION,
    projectionSnapshotChecksum: "proj",
    observationSnapshotChecksum: args.observationChecksum ?? `obs-${stage}`,
    comparisonSnapshotChecksum: args.comparisonChecksum ?? `cmp-${stage}`,
    projectionSchemaVersion: "ha-projection-lineage-v1",
    observationSchemaVersion: "ha-projection-observation-v1",
    comparisonSchemaVersion: "ha-projection-comparison-v1",
    followupStage: stage,
    comparisonStatus: args.status ?? "consistent",
    projectionDomain: args.domain ?? "frontal_framing",
    projectionConfidenceBand: "moderate",
    observationConfidenceBand: "moderate",
    comparisonConfidenceBand: "moderate",
    assessmentMode: "surgery_day_only",
    baselineAvailable: true,
    procedureTypeNormalized: "fue",
    graftCountBand: args.graft ?? "2500_3499",
    hairsPerGraftBand: "unknown",
    punchSizeBand: "unknown",
    treatedHairline: true,
    treatedTemples: false,
    treatedFrontal: true,
    treatedForelock: false,
    treatedMidScalp: false,
    treatedCrown: false,
    donorEvidenceAvailable: true,
    evidenceCompletenessBand: args.evidence ?? "moderate",
    isCurrentSourceLineage: args.current ?? true,
    rowChecksum: "chk",
    sourceGeneratedAt: null,
    sourceSupersededAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("FI-OUTCOME-INTELLIGENCE-1A aggregates", () => {
  it("27-30. small-cell: n<10 suppressed; n>=10 returned; unique procedures; filters", async () => {
    const repo = new InMemoryOutcomeCohortRepository();
    for (let i = 0; i < 9; i++) {
      const key = `proc-${String(i).padStart(3, "0")}`;
      await repo.insert(row({ procedureKey: key, domain: "frontal_framing" }));
      await repo.insert(
        row({
          procedureKey: key,
          domain: "density_distribution",
          status: "partially_consistent",
        })
      );
    }
    // Fix duplicate ids: row() uses procedureKey-domain-stage — unique across domains. Good.

    const aggregates = createOutcomeCohortAggregates({
      cohortRepository: repo,
      minCohortSize: 10,
    });
    const suppressed = await aggregates.getDomainComparisonDistribution({
      stage: "month_12",
      domain: "frontal_framing",
    });
    assert.equal(suppressed.ok, false);
    if (!suppressed.ok) {
      assert.equal(suppressed.code, "insufficient_cohort_size");
      assert.equal(suppressed.cohortSize, 9);
    }

    await repo.insert(
      row({ procedureKey: "proc-009", domain: "frontal_framing", status: "divergent" })
    );
    await repo.insert(
      row({
        procedureKey: "proc-009",
        domain: "density_distribution",
        status: "consistent",
      })
    );

    const ok = await aggregates.getDomainComparisonDistribution({
      stage: "month_12",
      domain: "frontal_framing",
    });
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    assert.equal(ok.cohortSize, 10);
    // Domain rows would be 20 if counted wrongly
    assert.notEqual(ok.cohortSize, 20);
    assert.equal(
      ok.consistentCount +
        ok.partiallyConsistentCount +
        ok.divergentCount +
        ok.notYetAssessableCount +
        ok.insufficientEvidenceCount,
      10
    );

    // Filter reduces below threshold → suppressed again
    const filtered = await aggregates.getDomainComparisonDistribution({
      stage: "month_12",
      domain: "frontal_framing",
      filters: { graftCountBand: "under_1500" },
    });
    assert.equal(filtered.ok, false);
    if (!filtered.ok) assert.equal(filtered.code, "insufficient_cohort_size");
  });

  it("31-34. status distribution, assessability, coverage, evidence", async () => {
    const repo = new InMemoryOutcomeCohortRepository();
    const statuses: ProjectionComparisonStatus[] = [
      "consistent",
      "partially_consistent",
      "divergent",
      "not_yet_assessable",
      "insufficient_evidence",
    ];
    for (let i = 0; i < 10; i++) {
      await repo.insert(
        row({
          procedureKey: `p${i}`,
          status: statuses[i % 5]!,
          evidence: i < 4 ? "high" : i < 7 ? "moderate" : "low",
          stage: "month_12",
        })
      );
    }
    // Add month_6 coverage for 3 procedures
    for (let i = 0; i < 3; i++) {
      await repo.insert(
        row({
          procedureKey: `p${i}`,
          stage: "month_6",
          domain: "frontal_framing",
          status: "not_yet_assessable",
        })
      );
    }

    const aggregates = createOutcomeCohortAggregates({
      cohortRepository: repo,
      minCohortSize: 10,
    });
    const dist = await aggregates.getDomainComparisonDistribution({
      stage: "month_12",
      domain: "frontal_framing",
    });
    assert.equal(dist.ok, true);
    if (!dist.ok) return;
    assert.equal(dist.consistentCount, 2);
    assert.equal(dist.partiallyConsistentCount, 2);
    assert.equal(dist.divergentCount, 2);
    assert.equal(dist.notYetAssessableCount, 2);
    assert.equal(dist.insufficientEvidenceCount, 2);
    assert.equal(dist.assessableCount, 6);
    assert.equal(dist.nonAssessableTimingCount, 2);
    assert.equal(dist.nonAssessableEvidenceCount, 2);
    assert.equal(dist.consistentProportion, 0.2);

    const coverage = await aggregates.getCohortCoverageSummary();
    assert.equal(coverage.totalCurrentProcedures, 10);
    assert.equal(coverage.proceduresByStage.month_12, 10);
    assert.equal(coverage.proceduresByStage.month_6, 3);

    const health = await aggregates.getCohortHealthSummary();
    assert.equal(health.uniqueProcedures, 10);
    assert.equal(health.month12Coverage, 10);
    assert.equal(health.month6Coverage, 3);
    assert.equal(health.calibrationReadiness, "FOUNDATION");
    assert.ok(health.currentLineageRows >= 10);
  });
});
