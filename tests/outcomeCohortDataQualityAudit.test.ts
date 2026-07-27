/**
 * FI-OUTCOME-INTELLIGENCE-1B — Full data quality audit service tests.
 * Run: pnpm exec tsx --test tests/outcomeCohortDataQualityAudit.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createOutcomeCohortDataQualityAuditService,
  sanitizeAuditForExport,
} from "@/lib/outcomeIntelligence/cohortDataQualityAudit";
import { InMemoryOutcomeCohortRepository } from "@/lib/outcomeIntelligence/cohortRepository";
import { auditRow } from "./outcomeCohortAuditTestHelpers";

async function seedFoundationCohort(repo: InMemoryOutcomeCohortRepository) {
  for (let i = 0; i < 12; i++) {
    const key = `proc-${String(i).padStart(3, "0")}`;
    await repo.insert(
      auditRow({
        procedureKey: key,
        stage: "month_3",
        status: "not_yet_assessable",
        evidence: i < 4 ? "high" : "moderate",
        assessmentMode: i < 8 ? "baseline_plus_surgery_day" : "surgery_day_only",
        baselineAvailable: i < 8,
        treatedCrown: i >= 10,
        graft: i < 10 ? "2500_3499" : "unknown",
        procedureType: "fue",
        projectionConfidence: i < 2 ? "low" : "moderate",
        observationConfidence: "moderate",
        comparisonConfidence: i < 2 ? "low" : "high",
      })
    );
    await repo.insert(
      auditRow({
        procedureKey: key,
        domain: "density_distribution",
        stage: "month_3",
        status: "not_yet_assessable",
      })
    );
    if (i < 10) {
      await repo.insert(
        auditRow({
          procedureKey: key,
          stage: "month_6",
          status: i < 3 ? "insufficient_evidence" : "partially_consistent",
          evidence: "moderate",
        })
      );
    }
    if (i < 2) {
      await repo.insert(
        auditRow({
          procedureKey: key,
          stage: "month_12",
          status: i === 0 ? "insufficient_evidence" : "consistent",
          evidence: "high",
          projectionConfidence: "high",
          observationConfidence: "high",
          comparisonConfidence: "high",
        })
      );
      await repo.insert(
        auditRow({
          procedureKey: key,
          domain: "density_distribution",
          stage: "month_12",
          status: "consistent",
          evidence: "high",
          projectionConfidence: "high",
          observationConfidence: "high",
          comparisonConfidence: "high",
        })
      );
    }
  }
  // superseded row must not inflate
  await repo.insert(
    auditRow({
      procedureKey: "proc-000",
      stage: "month_12",
      current: false,
      comparisonChecksum: "superseded-old",
      status: "divergent",
    })
  );
}

describe("FI-OUTCOME-INTELLIGENCE-1B data quality audit", () => {
  it("13-25. evidence, confidence, baseline, zones, metadata; superseded excluded", async () => {
    const repo = new InMemoryOutcomeCohortRepository();
    await seedFoundationCohort(repo);
    const service = createOutcomeCohortDataQualityAuditService({
      cohortRepository: repo,
      materializationEnabled: true,
      now: "2026-07-27T00:00:00.000Z",
    });
    const audit = await service.runCohortDataQualityAudit();

    assert.equal(audit.cohort.uniqueProcedures, 12);
    assert.ok(audit.cohort.supersededDomainRows >= 1);
    assert.equal(audit.longitudinalCoverage.month_3.proceduresWithStage, 12);
    assert.equal(audit.longitudinalCoverage.month_6.proceduresWithStage, 10);
    assert.equal(audit.longitudinalCoverage.month_12.proceduresWithStage, 2);
    assert.equal(audit.followUpRetention.month3ToMonth6, 10 / 12);

    // Baseline from assessment mode — not inferred from unsafe fields
    assert.equal(audit.baselineCoverage.withBaseline, 8);
    assert.equal(audit.baselineCoverage.surgeryDayOnly, 4);

    assert.equal(
      audit.evidenceQuality.low +
        audit.evidenceQuality.moderate +
        audit.evidenceQuality.high,
      12
    );
    assert.ok(audit.projectionConfidence.moderate + audit.projectionConfidence.low >= 1);
    assert.ok(
      audit.comparisonConfidence.high + audit.comparisonConfidence.moderate >= 1
    );

    // Assessability at month_3 is timing-limited
    assert.equal(audit.assessability.byStage.month_3.notYetAssessable, 12);
    assert.equal(audit.assessability.byStage.month_3.assessable, 0);

    // Zones: multi-zone counted once per zone; crown only for i>=10 → 2 → suppressed
    assert.equal(audit.treatmentZoneCoverage.hairline, 12);
    assert.equal(audit.treatmentZoneCoverage.crown, "insufficient_cohort_size");

    // Unknown graft retained
    assert.equal(audit.missingData.unknownGraftCountBand, 2);

    // Domain coverage unique procedures
    assert.equal(audit.domainCoverage.frontal_framing.uniqueProcedures, 12);
    assert.equal(audit.domainCoverage.density_distribution.stages.month_12, 2);

    // Month-12 status for frontal: 2 procedures — suppressed (<10)
    const m12Frontal = audit.domainCoverage.frontal_framing.statusByStage.month_12;
    assert.ok("ok" in m12Frontal);
    assert.equal((m12Frontal as { ok: false }).ok, false);

    assert.equal(audit.calibrationReadiness.status, "FOUNDATION");
    assert.ok(audit.dataQualityFlags.includes("LOW_MONTH12_COVERAGE"));
    assert.ok(audit.dataQualityFlags.includes("INSUFFICIENT_MATURE_CASES"));
    assert.equal(audit.tenantScope, "deployment_local");
    assert.equal(audit.governanceStatus, "NEEDS_POLICY_CONFIRMATION");
    assert.equal(
      audit.productionActivation,
      "BLOCKED_PENDING_POLICY_CONFIRMATION"
    );
  });

  it("36-40. data quality flags; no clinical flags; version heterogeneity", async () => {
    const repo = new InMemoryOutcomeCohortRepository();
    for (let i = 0; i < 12; i++) {
      await repo.insert(
        auditRow({
          procedureKey: `h${i}`,
          graft: "unknown",
          procedureType: "unknown",
          baselineAvailable: false,
          assessmentMode: "surgery_day_only",
          stage: "month_6",
          status: "insufficient_evidence",
          comparisonConfidence: "low",
          projectionSchemaVersion: i < 6 ? "v1" : "v2",
        })
      );
    }
    const service = createOutcomeCohortDataQualityAuditService({
      cohortRepository: repo,
      materializationEnabled: true,
    });
    const audit = await service.runCohortDataQualityAudit();
    assert.ok(audit.dataQualityFlags.includes("LOW_MONTH12_COVERAGE"));
    assert.ok(audit.dataQualityFlags.includes("LOW_BASELINE_COVERAGE"));
    assert.ok(audit.dataQualityFlags.includes("PROCEDURE_METADATA_MISSINGNESS"));
    assert.ok(audit.dataQualityFlags.includes("SCHEMA_VERSION_HETEROGENEITY"));
    assert.ok(audit.dataQualityFlags.includes("HIGH_LOW_CONFIDENCE_RATE"));
    const joined = audit.dataQualityFlags.join(",");
    assert.equal(/success|failure|clinical|surgeon/i.test(joined), false);
    assert.ok(audit.captureGaps.length >= 1);
    assert.ok(audit.prospectiveCapturePriorities.length >= 1);
  });

  it("41-47. no PHI/HMAC/raw rows/provider IDs; governance preserved", async () => {
    const repo = new InMemoryOutcomeCohortRepository();
    for (let i = 0; i < 10; i++) {
      await repo.insert(auditRow({ procedureKey: `x${i}` }));
    }
    const service = createOutcomeCohortDataQualityAuditService({
      cohortRepository: repo,
      materializationEnabled: true,
    });
    const audit = await service.runCohortDataQualityAudit();
    const json = JSON.stringify(sanitizeAuditForExport(audit));
    assert.equal(/patient_id|case_id|patientId|caseId/.test(json), false);
    assert.equal(/cohortProcedureKey|cohortSubjectKey/.test(json), false);
    assert.equal(/surgeon|clinic_id|doctor_id/.test(json), false);
    assert.equal(json.includes("accuracy"), false);
    assert.equal(json.includes("success_rate"), false);
    assert.equal(audit.governanceStatus, "NEEDS_POLICY_CONFIRMATION");
    // Env approval not flipped by audit
    assert.notEqual(process.env.FI_OUTCOME_COHORT_GOVERNANCE_APPROVED, "true");
  });

  it("empty / not_enabled materialization reported honestly", async () => {
    const repo = new InMemoryOutcomeCohortRepository();
    const service = createOutcomeCohortDataQualityAuditService({
      cohortRepository: repo,
      materializationEnabled: false,
    });
    const audit = await service.runCohortDataQualityAudit();
    assert.equal(audit.materializationStatus, "not_enabled");
    assert.equal(audit.cohort.uniqueProcedures, 0);
    assert.equal(audit.calibrationReadiness.status, "NOT_READY");
    assert.ok(audit.dataQualityFlags.includes("EMPTY_COHORT"));
  });
});
