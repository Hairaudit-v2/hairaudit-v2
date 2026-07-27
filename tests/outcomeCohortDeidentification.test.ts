/**
 * FI-OUTCOME-INTELLIGENCE-1A — De-identification + normalization tests.
 * Run: pnpm exec tsx --test tests/outcomeCohortDeidentification.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertAllowlistedCohortKeys,
  scanForProhibitedCohortKeys,
  validateCohortRowDeidentified,
} from "@/lib/outcomeIntelligence/cohortDeidentification";
import {
  bandGraftCount,
  bandHairsPerGraft,
  bandPunchSizeMm,
  normalizeProcedureType,
  normalizeTreatedZoneFlags,
} from "@/lib/outcomeIntelligence/cohortNormalization";
import {
  COHORT_SCHEMA_VERSION,
  type OutcomeLongitudinalCohortRow,
} from "@/lib/outcomeIntelligence/cohortTypes";
import {
  enabledCohortConfig,
  makeMaterializationStack,
  seedFullLineage,
} from "./outcomeCohortTestHelpers";

function sampleRow(
  overrides?: Partial<OutcomeLongitudinalCohortRow>
): OutcomeLongitudinalCohortRow {
  return {
    id: "r1",
    cohortSubjectKey: "a".repeat(64),
    cohortProcedureKey: "b".repeat(64),
    cohortPartitionKey: "c".repeat(64),
    cohortSchemaVersion: COHORT_SCHEMA_VERSION,
    projectionSnapshotChecksum: "p".repeat(64),
    observationSnapshotChecksum: "o".repeat(64),
    comparisonSnapshotChecksum: "k".repeat(64),
    projectionSchemaVersion: "ha-projection-lineage-v1",
    observationSchemaVersion: "ha-projection-observation-v1",
    comparisonSchemaVersion: "ha-projection-comparison-v1",
    followupStage: "month_12",
    comparisonStatus: "consistent",
    projectionDomain: "frontal_framing",
    projectionConfidenceBand: "moderate",
    observationConfidenceBand: "moderate",
    comparisonConfidenceBand: "moderate",
    assessmentMode: "baseline_plus_surgery_day",
    baselineAvailable: true,
    procedureTypeNormalized: "fue",
    graftCountBand: "2500_3499",
    hairsPerGraftBand: "2_1_to_2_4",
    punchSizeBand: "0_9_to_0_99",
    treatedHairline: true,
    treatedTemples: false,
    treatedFrontal: true,
    treatedForelock: false,
    treatedMidScalp: false,
    treatedCrown: false,
    donorEvidenceAvailable: true,
    evidenceCompletenessBand: "high",
    isCurrentSourceLineage: true,
    rowChecksum: "d".repeat(64),
    sourceGeneratedAt: "2026-01-16T00:00:00.000Z",
    sourceSupersededAt: null,
    createdAt: "2026-01-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("FI-OUTCOME-INTELLIGENCE-1A de-identification", () => {
  it("5-12. prohibited keys scanned; allowlist enforced; materialized rows clean", async () => {
    const dirty = {
      cohortSubjectKey: "x",
      patient_id: "uuid",
      caseId: "uuid",
      email: "a@b.c",
      phone: "1",
      name: "n",
      dob: "2000-01-01",
      address: "x",
      storage_path: "/p",
      url: "https://x",
      filename: "a.png",
      clinician_notes: "n",
      prompt: "p",
      raw_ai: "{}",
    };
    const scan = scanForProhibitedCohortKeys(dirty);
    assert.equal(scan.ok, false);
    if (!scan.ok) {
      assert.ok(scan.prohibitedKeys.includes("patient_id"));
      assert.ok(scan.prohibitedKeys.includes("caseId"));
      assert.ok(scan.prohibitedKeys.includes("email"));
    }

    const allow = assertAllowlistedCohortKeys({
      ...sampleRow(),
      secretField: "nope",
    } as unknown as Record<string, unknown>);
    assert.equal(allow.ok, false);

    const ok = validateCohortRowDeidentified(sampleRow());
    assert.equal(ok.ok, true);

    const lineage = await seedFullLineage({
      caseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      patientId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      graftCount: 2800,
    });
    const { service } = makeMaterializationStack({
      lineage,
      config: enabledCohortConfig(),
    });
    const result = await service.materializeFromComparison({
      comparisonId: lineage.comparison.id,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    for (const row of result.rows) {
      const v = validateCohortRowDeidentified(row);
      assert.equal(v.ok, true, v.ok ? "" : v.reason);
      const json = JSON.stringify(row);
      assert.equal(json.includes(lineage.comparison.caseId), false);
      assert.equal(json.includes(lineage.comparison.patientId), false);
      assert.equal(json.includes("patientId"), false);
      assert.equal(json.includes("caseId"), false);
      assert.equal(json.includes("rationale"), false);
      assert.equal(json.includes("summary"), false);
    }
  });

  it("18-23. graft/zone/status/confidence normalization", async () => {
    assert.equal(bandGraftCount(1200), "under_1500");
    assert.equal(bandGraftCount(1500), "1500_2499");
    assert.equal(bandGraftCount(2499), "1500_2499");
    assert.equal(bandGraftCount(2500), "2500_3499");
    assert.equal(bandGraftCount(4500), "4500_plus");
    assert.equal(bandGraftCount(null), "unknown");

    assert.equal(bandHairsPerGraft(1.7), "under_1_8");
    assert.equal(bandHairsPerGraft(1.8), "1_8_to_2_1");
    assert.equal(bandHairsPerGraft(2.4), "over_2_4");
    assert.equal(bandHairsPerGraft(null), "unknown");

    assert.equal(bandPunchSizeMm(0.75), "under_0_8");
    assert.equal(bandPunchSizeMm(0.85), "0_8_to_0_89");
    assert.equal(bandPunchSizeMm(0.95), "0_9_to_0_99");
    assert.equal(bandPunchSizeMm(1.0), "1_0_plus");
    assert.equal(bandPunchSizeMm(undefined), "unknown");

    assert.equal(normalizeProcedureType("FUE"), "fue");
    assert.equal(normalizeProcedureType("FUT strip"), "fut");
    assert.equal(normalizeProcedureType(null), "unknown");

    const zones = normalizeTreatedZoneFlags(["hairline", "Crown", "mid scalp"]);
    assert.equal(zones.treatedHairline, true);
    assert.equal(zones.treatedCrown, true);
    assert.equal(zones.treatedMidScalp, true);
    assert.equal(zones.treatedTemples, false);

    const lineage = await seedFullLineage({
      caseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      patientId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      stage: "month_12",
      graftCount: 2800,
    });
    const { service } = makeMaterializationStack({ lineage });
    const result = await service.materializeFromComparison({
      comparisonId: lineage.comparison.id,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    for (const row of result.rows) {
      assert.equal(row.followupStage, "month_12");
      assert.ok(
        [
          "consistent",
          "partially_consistent",
          "divergent",
          "not_yet_assessable",
          "insufficient_evidence",
        ].includes(row.comparisonStatus)
      );
      assert.ok(["low", "moderate", "high"].includes(row.comparisonConfidenceBand));
      assert.equal(row.graftCountBand, "2500_3499");
    }
  });
});
