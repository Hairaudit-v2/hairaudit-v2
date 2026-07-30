/**
 * HA-PATIENT-REPORT-UI-1A.1 — donor-healing demo QA fixture contracts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDemoQaSeededCasePreview,
  demoQaSeedPathwayForScenario,
  validateDemoQaScenarioPreview,
} from "../src/lib/demo/qaCaseSeed/buildReportSummary";
import {
  DEMO_QA_DONOR_HEALING_SCENARIOS,
  isDemoQaDonorFixture,
} from "../src/lib/demo/qaCaseSeed/donorHealingScenarios";
import {
  DEMO_QA_ALL_SCENARIOS,
  DEMO_QA_SEED_SCENARIOS,
} from "../src/lib/demo/qaCaseSeed/scenarios";
import {
  DEMO_QA_AUDITOR_EMAIL,
  demoQaExternalCaseId,
  demoQaUserEmail,
} from "../src/lib/demo/qaCaseSeed/constants";
import { DONOR_HEALING_ORIENTATION_LABELS } from "../src/lib/patient/donorHealingEntry";
import { toPatientSafeDonorOrientationSlice } from "../src/lib/patient/donorHealingOrientationReport";
import { buildDonorHealingPatientReportViewModel } from "../src/lib/patientReport/adapters/donorHealingReportAdapter";
import { resolvePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";

describe("HA-PATIENT-REPORT-UI-1A.1 — donor fixture seed contracts", () => {
  it("defines five donor fixtures plus dual-pathway demos", () => {
    assert.equal(DEMO_QA_DONOR_HEALING_SCENARIOS.length, 5);
    assert.equal(DEMO_QA_ALL_SCENARIOS.length, 20);
    assert.equal(DEMO_QA_SEED_SCENARIOS.length, 25);
    assert.ok(DEMO_QA_AUDITOR_EMAIL.includes("auditor-demo"));
  });

  it("uses donorhealing seed segment for fixture identities", () => {
    const scenario = DEMO_QA_DONOR_HEALING_SCENARIOS[0]!;
    assert.equal(demoQaSeedPathwayForScenario(scenario), "donor_healing");
    assert.equal(demoQaExternalCaseId("donor_healing", 1), "demo-qa:donorhealing:01");
    assert.equal(demoQaUserEmail("donor_healing", 1), "donorhealing-demo-01@hairaudit.test");
    assert.ok(isDemoQaDonorFixture(scenario));
  });

  it("each donor fixture preview validates", () => {
    const errors: string[] = [];
    for (const scenario of DEMO_QA_DONOR_HEALING_SCENARIOS) {
      const preview = buildDemoQaSeededCasePreview({ scenario });
      errors.push(...validateDemoQaScenarioPreview(preview));
    }
    assert.deepEqual(errors, [], errors.join("\n"));
  });

  it("confirmed fixture has clinician_confirmation provenance (internal only)", () => {
    const scenario = DEMO_QA_DONOR_HEALING_SCENARIOS.find(
      (s) => s.donorFixture?.kind === "orientation_confirmed"
    )!;
    const preview = buildDemoQaSeededCasePreview({ scenario });
    const record = preview.summary.donor_healing_orientation as {
      provenance: { source: string; confirmedByUserId?: string };
      state: string;
    };
    assert.equal(record.provenance.source, "clinician_confirmation");
    assert.ok(record.provenance.confirmedByUserId);

    const resolved = resolvePostSurgeryAuditReport(preview.summary, {
      caseId: "case",
      patientReviewPathway: "post_surgery",
    });
    assert.ok(resolved?.donorHealingOrientation);
    const vm = buildDonorHealingPatientReportViewModel({ report: resolved! });
    assert.equal(vm.summary.reviewStatusLabel, "Reviewed and confirmed");
    assert.ok(!JSON.stringify(vm).includes(record.provenance.confirmedByUserId!));
  });

  it("corrected fixture uses clinician_correction and patient-safe label", () => {
    const scenario = DEMO_QA_DONOR_HEALING_SCENARIOS.find(
      (s) => s.donorFixture?.kind === "orientation_corrected"
    )!;
    const preview = buildDemoQaSeededCasePreview({ scenario });
    const record = preview.summary.donor_healing_orientation as {
      provenance: { source: string };
      state: string;
      patientLabel: string;
    };
    assert.equal(record.provenance.source, "clinician_correction");
    assert.equal(record.state, "persistent_irregularity_deserves_review");
    assert.equal(
      record.patientLabel,
      DONOR_HEALING_ORIENTATION_LABELS.persistent_irregularity_deserves_review
    );
  });

  it("missing orientation fixture falls back through adapter", () => {
    const scenario = DEMO_QA_DONOR_HEALING_SCENARIOS.find(
      (s) => s.donorFixture?.kind === "missing_orientation_fallback"
    )!;
    const preview = buildDemoQaSeededCasePreview({ scenario });
    assert.equal(preview.summary.entry_context, "donor_healing");
    assert.equal(preview.summary.donor_healing_orientation, undefined);

    const resolved = resolvePostSurgeryAuditReport(preview.summary, {
      caseId: "case",
      patientReviewPathway: "post_surgery",
      uploadTypes: preview.uploadTypes,
    });
    // resolve may rebuild orientation from entry context — force null for adapter fallback proof
    if (resolved) resolved.donorHealingOrientation = null;
    const vm = buildDonorHealingPatientReportViewModel({ report: resolved! });
    assert.equal(vm.reportType, "post_surgery");
  });

  it("direct clinical fixture surfaces escalation copy", () => {
    const scenario = DEMO_QA_DONOR_HEALING_SCENARIOS.find(
      (s) => s.donorFixture?.kind === "direct_clinical_assessment"
    )!;
    const preview = buildDemoQaSeededCasePreview({ scenario });
    const record = preview.summary.donor_healing_orientation as {
      state: string;
      escalationCopy: string | null;
    };
    assert.equal(record.state, "direct_clinical_assessment_recommended");
    assert.ok(record.escalationCopy);

    const slice = toPatientSafeDonorOrientationSlice(record as never);
    assert.ok(slice.escalationCopy);
  });

  it("partial evidence does not claim mature stage compatibility", () => {
    const scenario = DEMO_QA_DONOR_HEALING_SCENARIOS.find(
      (s) => s.donorFixture?.kind === "partial_donor_evidence"
    )!;
    const preview = buildDemoQaSeededCasePreview({ scenario });
    const record = preview.summary.donor_healing_orientation as { state: string };
    assert.notEqual(record.state, "compatible_with_reported_stage");
    assert.ok(preview.uploadTypes.filter((t) => t.includes("donor")).length <= 2);
  });
});
