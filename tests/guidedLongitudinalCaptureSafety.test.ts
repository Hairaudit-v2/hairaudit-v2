/**
 * FI-OUTCOME-INTELLIGENCE-1E — Safety / forbidden language tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertGuidedCaptureCopySafe,
  assertPatientGuidedCaptureDtoSafe,
  scanGuidedCaptureCopyForForbiddenLanguage,
} from "../src/lib/outcomeIntelligence/guidedCaptureSafety";
import {
  GUIDED_CAPTURE_REFERENCE_MATCH_COPY,
  GUIDED_CAPTURE_RECOMMENDED_COPY,
  guidedInstructionsForRole,
  guidedPhotographyGuidance,
} from "../src/lib/outcomeIntelligence/guidedCaptureInstructions";
import { buildGuidedLongitudinalCaptureDto } from "../src/lib/outcomeIntelligence/guidedCaptureBuilder";
import type {
  LongitudinalCaptureMilestone,
  LongitudinalCapturePlan,
} from "../src/lib/outcomeIntelligence/longitudinalCaptureTypes";

describe("guided capture safety", () => {
  it("31-36. forbids success/on-track/growth/calibration language", () => {
    assert.ok(scanGuidedCaptureCopyForForbiddenLanguage("You're on track").length > 0);
    assert.ok(scanGuidedCaptureCopyForForbiddenLanguage("60% growth").length > 0);
    assert.ok(scanGuidedCaptureCopyForForbiddenLanguage("graft survival").length > 0);
    assert.ok(scanGuidedCaptureCopyForForbiddenLanguage("calibrated match").length > 0);
    assert.ok(scanGuidedCaptureCopyForForbiddenLanguage("exact match").length > 0);
    assert.equal(assertGuidedCaptureCopySafe("Your photos are complete.").ok, true);
  });

  it("26. reference copy says match angle, not calibrated", () => {
    assert.match(GUIDED_CAPTURE_REFERENCE_MATCH_COPY, /match this angle/i);
    assert.equal(
      assertGuidedCaptureCopySafe(GUIDED_CAPTURE_REFERENCE_MATCH_COPY).ok,
      true
    );
  });

  it("recommended copy is non-guilt", () => {
    assert.match(GUIDED_CAPTURE_RECOMMENDED_COPY, /optional/i);
    assert.doesNotMatch(GUIDED_CAPTURE_RECOMMENDED_COPY, /must|should have/i);
  });

  it("guidance and role instructions are safe", () => {
    for (const line of guidedPhotographyGuidance()) {
      assert.equal(assertGuidedCaptureCopySafe(line).ok, true);
    }
    for (const line of guidedInstructionsForRole("followup_front")) {
      assert.equal(assertGuidedCaptureCopySafe(line).ok, true);
    }
  });

  it("DTO safety passes for canonical build", async () => {
    const m: LongitudinalCaptureMilestone = {
      stage: "month_6",
      status: "due",
      targetDate: "2025-07-15",
      windowStart: "2025-06-15",
      windowEnd: "2025-08-14",
      requiredEvidenceRoles: ["followup_front"],
      recommendedEvidenceRoles: [],
      presentEvidenceRoles: [],
      missingRequiredEvidenceRoles: ["followup_front"],
      missingRecommendedEvidenceRoles: [],
      observationSnapshotId: null,
      completedAt: null,
      lateEvidencePresent: false,
      comparisonAvailable: false,
      reviewAvailable: false,
    };
    const plan: LongitudinalCapturePlan = {
      id: "p",
      projectionSnapshotId: "proj",
      caseId: "c",
      patientId: "u",
      procedureDate: "2025-01-01",
      planVersion: "fi-outcome-capture-plan-v1",
      protocolVersion: "fi-outcome-capture-protocol-v1",
      createdAt: "2025-01-01T00:00:00.000Z",
      milestones: [m],
    };
    const dto = await buildGuidedLongitudinalCaptureDto({
      plan,
      milestone: m,
      uploads: [],
      resolveSignedUrl: async () => "https://example.com/signed",
      uiEnabled: true,
    });
    assert.equal(assertPatientGuidedCaptureDtoSafe(dto).ok, true);
  });
});
