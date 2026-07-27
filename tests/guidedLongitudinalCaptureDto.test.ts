/**
 * FI-OUTCOME-INTELLIGENCE-1E — Guided capture DTO / 1C consumption tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGuidedLongitudinalCaptureDto,
  buildStatusMessage,
  guidedCaptureHref,
} from "../src/lib/outcomeIntelligence/guidedCaptureBuilder";
import type { LongitudinalCaptureMilestone, LongitudinalCapturePlan } from "../src/lib/outcomeIntelligence/longitudinalCaptureTypes";
import { assertPatientGuidedCaptureDtoSafe } from "../src/lib/outcomeIntelligence/guidedCaptureSafety";

function basePlan(overrides?: Partial<LongitudinalCapturePlan>): LongitudinalCapturePlan {
  return {
    id: "plan-1",
    projectionSnapshotId: "proj-1",
    caseId: "case-1",
    patientId: "patient-1",
    procedureDate: "2025-01-15",
    planVersion: "fi-outcome-capture-plan-v1",
    protocolVersion: "fi-outcome-capture-protocol-v1",
    createdAt: "2025-01-15T00:00:00.000Z",
    milestones: [],
    ...overrides,
  };
}

function milestone(
  partial: Partial<LongitudinalCaptureMilestone> &
    Pick<LongitudinalCaptureMilestone, "stage" | "status">
): LongitudinalCaptureMilestone {
  return {
    targetDate: "2025-07-15",
    windowStart: "2025-06-15",
    windowEnd: "2025-08-14",
    requiredEvidenceRoles: [
      "followup_front",
      "followup_top",
      "followup_recipient_closeup",
    ],
    recommendedEvidenceRoles: ["followup_crown", "followup_donor_rear"],
    presentEvidenceRoles: [],
    missingRequiredEvidenceRoles: [
      "followup_front",
      "followup_top",
      "followup_recipient_closeup",
    ],
    missingRecommendedEvidenceRoles: ["followup_crown", "followup_donor_rear"],
    observationSnapshotId: null,
    completedAt: null,
    lateEvidencePresent: false,
    comparisonAvailable: false,
    reviewAvailable: false,
    ...partial,
  };
}

describe("guided capture consumes canonical 1C views", () => {
  it("1. renders only 1C views (no invented crown when omitted)", async () => {
    const m = milestone({
      stage: "month_6",
      status: "due",
      requiredEvidenceRoles: [
        "followup_front",
        "followup_top",
        "followup_recipient_closeup",
      ],
      recommendedEvidenceRoles: ["followup_donor_rear"],
      missingRequiredEvidenceRoles: [
        "followup_front",
        "followup_top",
        "followup_recipient_closeup",
      ],
      missingRecommendedEvidenceRoles: ["followup_donor_rear"],
    });
    const dto = await buildGuidedLongitudinalCaptureDto({
      plan: basePlan({ milestones: [m] }),
      milestone: m,
      uploads: [],
      resolveSignedUrl: async () => null,
      uiEnabled: true,
    });
    assert.deepEqual(
      dto.views.map((v) => v.key),
      ["front", "top", "recipient_closeup", "donor_rear"]
    );
    assert.equal(
      dto.views.some((v) => v.key === "crown"),
      false
    );
  });

  it("2-3. does not recalculate required roles; crown only when 1C requires", async () => {
    const m = milestone({
      stage: "month_6",
      status: "due",
      requiredEvidenceRoles: [
        "followup_front",
        "followup_top",
        "followup_recipient_closeup",
        "followup_crown",
      ],
      recommendedEvidenceRoles: [],
      missingRequiredEvidenceRoles: [
        "followup_front",
        "followup_top",
        "followup_recipient_closeup",
        "followup_crown",
      ],
      missingRecommendedEvidenceRoles: [],
    });
    const dto = await buildGuidedLongitudinalCaptureDto({
      plan: basePlan({ milestones: [m] }),
      milestone: m,
      uploads: [],
      resolveSignedUrl: async () => null,
      uiEnabled: true,
    });
    const crown = dto.views.find((v) => v.key === "crown");
    assert.ok(crown);
    assert.equal(crown.required, true);
  });

  it("4. required/recommended distinction preserved", async () => {
    const m = milestone({ stage: "month_6", status: "due" });
    const dto = await buildGuidedLongitudinalCaptureDto({
      plan: basePlan({ milestones: [m] }),
      milestone: m,
      uploads: [],
      resolveSignedUrl: async () => null,
      uiEnabled: true,
    });
    assert.equal(dto.progress.requiredTotal, 3);
    assert.equal(dto.progress.recommendedTotal, 2);
    assert.ok(dto.views.filter((v) => v.required).every((v) => v.required));
    assert.ok(dto.views.filter((v) => !v.required).length === 2);
  });

  it("uses patient-safe labels", async () => {
    const m = milestone({ stage: "month_6", status: "due" });
    const dto = await buildGuidedLongitudinalCaptureDto({
      plan: basePlan({ milestones: [m] }),
      milestone: m,
      uploads: [],
      resolveSignedUrl: async () => null,
      uiEnabled: true,
    });
    for (const v of dto.views) {
      assert.doesNotMatch(v.label, /followup_|postop_month/);
    }
    assert.equal(assertPatientGuidedCaptureDtoSafe(dto).ok, true);
  });

  it("deep link href is stage-scoped follow-up", () => {
    assert.equal(
      guidedCaptureHref("case-1", "month_6"),
      "/cases/case-1/patient/follow-up/month_6"
    );
  });
});

describe("guided capture status messages", () => {
  it("5. future shows opening date", () => {
    const msg = buildStatusMessage({
      status: "future",
      stage: "month_6",
      targetDate: "2025-07-15",
      reviewAvailable: false,
    });
    assert.match(msg, /opens on/i);
    assert.match(msg, /July/);
  });

  it("6. due is ready", () => {
    assert.match(
      buildStatusMessage({
        status: "due",
        stage: "month_6",
        targetDate: "2025-07-15",
        reviewAvailable: false,
      }),
      /is ready/i
    );
  });

  it("8. ready hides upload pressure", () => {
    assert.match(
      buildStatusMessage({
        status: "ready_for_review",
        stage: "month_6",
        targetDate: "2025-07-15",
        reviewAvailable: false,
      }),
      /required photos are complete/i
    );
  });

  it("9. observed + reviewAvailable", () => {
    assert.match(
      buildStatusMessage({
        status: "observed",
        stage: "month_6",
        targetDate: "2025-07-15",
        reviewAvailable: true,
      }),
      /review is ready/i
    );
  });

  it("10. missed uses recovery wording", () => {
    const msg = buildStatusMessage({
      status: "missed",
      stage: "month_6",
      targetDate: "2025-07-15",
      reviewAvailable: false,
    });
    assert.match(msg, /still available/i);
    assert.doesNotMatch(msg, /failed|non-compliant|on track/i);
  });
});
