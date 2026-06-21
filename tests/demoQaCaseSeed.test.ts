import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertDemoSeedAllowed,
  demoQaExternalCaseId,
  demoQaUserEmail,
} from "../src/lib/demo/qaCaseSeed/constants";
import {
  buildDemoQaSeededCasePreview,
  validateDemoQaScenarioPreview,
} from "../src/lib/demo/qaCaseSeed/buildReportSummary";
import {
  DEMO_QA_ALL_SCENARIOS,
  DEMO_QA_POST_SURGERY_SCENARIOS,
  DEMO_QA_PRE_SURGERY_SCENARIOS,
  getDemoQaRequiredUploadKeys,
} from "../src/lib/demo/qaCaseSeed/scenarios";
import { isPathwayRequiredUploadComplete } from "../src/lib/patient/patientReviewPathway";
import {
  resolvePatientReportDeliveryPhase,
  shouldShowPatientReportContent,
} from "../src/lib/patient/patientProcessingView";
import { PATHWAY_MINIMAL_REQUIRED_FIELD_IDS } from "../src/lib/patient/patientReviewPathway";

describe("demoQaCaseSeed", () => {
  it("defines 20 scenarios (10 pre + 10 post)", () => {
    assert.equal(DEMO_QA_ALL_SCENARIOS.length, 20);
    assert.equal(DEMO_QA_PRE_SURGERY_SCENARIOS.length, 10);
    assert.equal(DEMO_QA_POST_SURGERY_SCENARIOS.length, 10);
  });

  it("uses synthetic demo emails", () => {
    assert.equal(demoQaUserEmail("pre_surgery", 1), "presurgery-demo-01@hairaudit.test");
    assert.equal(demoQaUserEmail("post_surgery", 10), "postsurgery-demo-10@hairaudit.test");
    assert.equal(demoQaExternalCaseId("pre_surgery", 3), "demo-qa:presurgery:03");
  });

  it("blocks production without DEMO_SEED_ENABLED", () => {
    assert.throws(
      () => assertDemoSeedAllowed("production"),
      /blocked in production/i
    );
    assert.doesNotThrow(() => {
      process.env.DEMO_SEED_ENABLED = "true";
      assertDemoSeedAllowed("production");
      delete process.env.DEMO_SEED_ENABLED;
    });
  });

  it("each scenario satisfies minimal intake fields", () => {
    for (const scenario of DEMO_QA_ALL_SCENARIOS) {
      const required = PATHWAY_MINIMAL_REQUIRED_FIELD_IDS[scenario.pathway];
      for (const field of required) {
        const val = scenario.intakeAnswers[field];
        assert.ok(val !== undefined && val !== "", `${scenario.id} missing intake field ${field}`);
      }
    }
  });

  it("each scenario passes upload gates and report validation", () => {
    const allErrors: string[] = [];
    for (const scenario of DEMO_QA_ALL_SCENARIOS) {
      const preview = buildDemoQaSeededCasePreview({ scenario });
      const required = getDemoQaRequiredUploadKeys(scenario.pathway);
      const photos = required.map((key) => ({ type: `patient_photo:${key}` }));
      assert.equal(
        isPathwayRequiredUploadComplete(scenario.pathway, photos),
        true,
        `${scenario.id} required keys incomplete`
      );

      const errors = validateDemoQaScenarioPreview(preview);
      allErrors.push(...errors);
    }
    assert.deepEqual(allErrors, [], allErrors.join("\n"));
  });

  it("waiting vs delivered phases behave correctly for seeded states", () => {
    assert.equal(
      resolvePatientReportDeliveryPhase({ caseStatus: "submitted", hasReportPdf: false }),
      "processing"
    );
    assert.equal(
      resolvePatientReportDeliveryPhase({ caseStatus: "complete", hasReportPdf: true }),
      "delivered"
    );
    assert.equal(
      shouldShowPatientReportContent({
        isPatientForCase: true,
        deliveryPhase: "delivered",
      }),
      true
    );
    assert.equal(
      shouldShowPatientReportContent({
        isPatientForCase: true,
        deliveryPhase: "processing",
      }),
      false
    );
  });

  it("pre and post scenarios use distinct report keys in summary", () => {
    const pre = buildDemoQaSeededCasePreview({ scenario: DEMO_QA_PRE_SURGERY_SCENARIOS[0]! });
    const post = buildDemoQaSeededCasePreview({ scenario: DEMO_QA_POST_SURGERY_SCENARIOS[0]! });

    assert.ok(pre.summary.pre_surgery_planning_report);
    assert.equal(pre.summary.post_surgery_audit_report, undefined);
    assert.ok(post.summary.post_surgery_audit_report);
    assert.equal(post.summary.pre_surgery_planning_report, undefined);
  });
});
