/**
 * FI-OUTCOME-INTELLIGENCE-1A — Governance gate tests.
 * Run: pnpm exec tsx --test tests/outcomeCohortGovernance.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertCohortMaterializationAllowed,
  resolveOutcomeCohortConfig,
} from "@/lib/outcomeIntelligence/cohortConfig";
import { evaluateCohortGovernance } from "@/lib/outcomeIntelligence/cohortGovernance";
import { buildBackfillPreflight } from "../scripts/backfill-outcome-cohort";
import {
  enabledCohortConfig,
  makeMaterializationStack,
  seedFullLineage,
  TEST_HMAC_SECRET,
} from "./outcomeCohortTestHelpers";

describe("FI-OUTCOME-INTELLIGENCE-1A governance", () => {
  it("39. production enable blocked without governance approval", async () => {
    const finding = evaluateCohortGovernance({ governanceApprovedEnv: false });
    assert.equal(finding.status, "NEEDS_POLICY_CONFIRMATION");

    const gate = assertCohortMaterializationAllowed({
      enabled: true,
      hmacSecret: TEST_HMAC_SECRET,
      governanceApproved: false,
      minCohortSize: 10,
      isProduction: true,
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, "GOVERNANCE_BLOCKED");

    const lineage = await seedFullLineage({
      caseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      patientId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    });
    const { service, audit } = makeMaterializationStack({
      lineage,
      config: enabledCohortConfig({ governanceApproved: false }),
    });
    const result = await service.materializeFromComparison({
      comparisonId: lineage.comparison.id,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "GOVERNANCE_BLOCKED");
    assert.ok(
      audit.events.some((e) => e.eventType === "cohort_governance_gate_blocked")
    );
  });

  it("40. production enable blocked without HMAC secret", () => {
    const gate = assertCohortMaterializationAllowed(
      resolveOutcomeCohortConfig(
        {
          FI_OUTCOME_COHORT_ENABLED: "true",
          FI_OUTCOME_COHORT_GOVERNANCE_APPROVED: "true",
          NODE_ENV: "production",
        },
        { hmacSecret: null }
      )
    );
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, "MISSING_HMAC_SECRET");
  });

  it("41. test/dev fixtures run under explicit config", async () => {
    const approved = evaluateCohortGovernance({ governanceApprovedEnv: true });
    assert.equal(approved.status, "APPROVED_EXISTING_BASIS");

    const lineage = await seedFullLineage({
      caseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      patientId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    });
    const { service } = makeMaterializationStack({
      lineage,
      config: enabledCohortConfig(),
    });
    const result = await service.materializeFromComparison({
      comparisonId: lineage.comparison.id,
    });
    assert.equal(result.ok, true);
  });

  it("backfill dry-run preflight reports counts only (no PHI)", () => {
    const prevEnabled = process.env.FI_OUTCOME_COHORT_ENABLED;
    const prevGov = process.env.FI_OUTCOME_COHORT_GOVERNANCE_APPROVED;
    const prevSecret = process.env.FI_OUTCOME_COHORT_HMAC_SECRET;
    process.env.FI_OUTCOME_COHORT_ENABLED = "false";
    delete process.env.FI_OUTCOME_COHORT_GOVERNANCE_APPROVED;
    delete process.env.FI_OUTCOME_COHORT_HMAC_SECRET;
    try {
      const report = buildBackfillPreflight({
        dryRun: true,
        apply: false,
        batchSize: 50,
        checkpoint: null,
        comparisonIds: [],
      });
      assert.equal(report.mode, "dry-run");
      assert.equal(report.gateOk, false);
      const text = JSON.stringify(report);
      assert.equal(/patient_id|case_id|@/.test(text), false);
      assert.ok(report.notes.some((n) => n.includes("Dry-run")));
    } finally {
      if (prevEnabled === undefined) delete process.env.FI_OUTCOME_COHORT_ENABLED;
      else process.env.FI_OUTCOME_COHORT_ENABLED = prevEnabled;
      if (prevGov === undefined) delete process.env.FI_OUTCOME_COHORT_GOVERNANCE_APPROVED;
      else process.env.FI_OUTCOME_COHORT_GOVERNANCE_APPROVED = prevGov;
      if (prevSecret === undefined) delete process.env.FI_OUTCOME_COHORT_HMAC_SECRET;
      else process.env.FI_OUTCOME_COHORT_HMAC_SECRET = prevSecret;
    }
  });
});
