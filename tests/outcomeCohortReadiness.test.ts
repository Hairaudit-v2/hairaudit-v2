/**
 * FI-OUTCOME-INTELLIGENCE-1B — Calibration readiness tests.
 * Run: pnpm exec tsx --test tests/outcomeCohortReadiness.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countEligibleForFutureCalibration,
  resolveCalibrationReadiness,
} from "@/lib/outcomeIntelligence/cohortReadiness";
import { auditRow } from "./outcomeCohortAuditTestHelpers";

describe("FI-OUTCOME-INTELLIGENCE-1B readiness", () => {
  it("31. empty cohort → NOT_READY", () => {
    const r = resolveCalibrationReadiness({
      uniqueProcedures: 0,
      month12Procedures: 0,
      eligible: 0,
      domainsAtMonth12: 0,
      highEvidenceShareMonth12: null,
      unknownGraftShare: null,
      baselineShare: null,
      materializationPopulated: false,
    });
    assert.equal(r.status, "NOT_READY");
  });

  it("32. small foundational cohort → FOUNDATION", () => {
    const r = resolveCalibrationReadiness({
      uniqueProcedures: 12,
      month12Procedures: 5,
      eligible: 3,
      domainsAtMonth12: 2,
      highEvidenceShareMonth12: 0.2,
      unknownGraftShare: 0.5,
      baselineShare: 0.3,
      materializationPopulated: true,
    });
    assert.equal(r.status, "FOUNDATION");
  });

  it("33. growing mature coverage → GROWING", () => {
    const r = resolveCalibrationReadiness({
      uniqueProcedures: 40,
      month12Procedures: 25,
      eligible: 12,
      domainsAtMonth12: 3,
      highEvidenceShareMonth12: 0.3,
      unknownGraftShare: 0.4,
      baselineShare: 0.4,
      materializationPopulated: true,
    });
    assert.equal(r.status, "GROWING");
    assert.ok(r.blockers.length >= 1);
  });

  it("34-35. REVIEW_FOR_CALIBRATION requires conservative thresholds; not ML-ready", () => {
    const almost = resolveCalibrationReadiness({
      uniqueProcedures: 60,
      month12Procedures: 50,
      eligible: 30,
      domainsAtMonth12: 3,
      highEvidenceShareMonth12: 0.39,
      unknownGraftShare: 0.3,
      baselineShare: 0.5,
      materializationPopulated: true,
    });
    assert.notEqual(almost.status, "REVIEW_FOR_CALIBRATION");

    const ok = resolveCalibrationReadiness({
      uniqueProcedures: 80,
      month12Procedures: 55,
      eligible: 35,
      domainsAtMonth12: 4,
      highEvidenceShareMonth12: 0.5,
      unknownGraftShare: 0.2,
      baselineShare: 0.6,
      materializationPopulated: true,
    });
    assert.equal(ok.status, "REVIEW_FOR_CALIBRATION");
    assert.ok(ok.reasons.some((x) => x.includes("not ML-ready")));
  });

  it("eligible count requires moderate/high confidence + assessable month_12", () => {
    const rows = [
      auditRow({
        procedureKey: "good",
        status: "consistent",
        evidence: "high",
        projectionConfidence: "high",
        observationConfidence: "moderate",
        comparisonConfidence: "high",
      }),
      auditRow({
        procedureKey: "low_conf",
        status: "consistent",
        evidence: "high",
        projectionConfidence: "low",
        observationConfidence: "high",
        comparisonConfidence: "high",
      }),
      auditRow({
        procedureKey: "not_yet",
        status: "not_yet_assessable",
        evidence: "high",
      }),
      auditRow({
        procedureKey: "early",
        stage: "month_6",
        status: "consistent",
        evidence: "high",
      }),
    ];
    assert.equal(countEligibleForFutureCalibration(rows), 1);
  });
});
