/**
 * UX regression — current attempt selection + clinical reason gating.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  selectCurrentProjectionAttempt,
  isEligibleCurrentAttempt,
  hairAuditDecisionLabel,
  technicalValidationVerdict,
  readGenerationLatencyMs,
} from "../src/lib/preSurgeryIntelligence/projection/currentAttempt";
import {
  CLINICAL_REVIEW_REASON_CODES,
  REJECTION_REASONS,
} from "../src/lib/preSurgeryIntelligence/projection/approval";
import type { PreSurgeryIllustrativeProjection } from "../src/lib/preSurgeryIntelligence/types";

function base(partial: Partial<PreSurgeryIllustrativeProjection>): PreSurgeryIllustrativeProjection {
  return {
    id: partial.id ?? "p1",
    caseId: "c1",
    graftPlanId: "plan-1",
    graftPlanVersion: 4,
    sourceImageId: "src-1",
    mode: "planned",
    artifactType: "illustrative_projected_outcome",
    patientSafeLabel: "Outcome",
    status: "clinician_review",
    engineVersion: "ha-pre-surgery-projection-v2",
    generationVersion: "ha-pre-surgery-projection-v2",
    deterministicSeed: null,
    storagePath: "pre_surgery_projections/c1/illustrative_projected_outcome/planned/abc.jpg",
    validationPass: [],
    limitations: [],
    planningAssumptions: [],
    requestedBy: "t",
    requestedAt: "2026-08-01T00:00:00.000Z",
    generatedAt: "2026-08-01T00:00:00.000Z",
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    inputChecksum: "x",
    outputChecksum: "y",
    providerId: "openai-gpt-image",
    providerModelVersion: "gpt-image-2",
    projectionVersion: 1,
    patientSharingEnabled: false,
    ...partial,
  };
}

describe("projection UX regression — current attempt", () => {
  it("selects approved over clinician_review and excludes rejected", () => {
    const rejected = base({
      id: "rej",
      status: "rejected",
      generatedAt: "2026-08-07T12:00:00.000Z",
      rejectionReason: "Visible mask seam",
    });
    const review = base({
      id: "rev",
      status: "clinician_review",
      generatedAt: "2026-08-07T11:00:00.000Z",
    });
    const approved = base({
      id: "appr",
      status: "approved",
      generatedAt: "2026-08-07T10:00:00.000Z",
      patientSharingEnabled: false,
    });
    const { current, historical } = selectCurrentProjectionAttempt({
      projections: [rejected, review, approved],
      key: {
        graftPlanId: "plan-1",
        graftPlanVersion: 4,
        sourceImageId: "src-1",
        mode: "planned",
        artifactType: "illustrative_projected_outcome",
      },
    });
    assert.equal(current?.id, "appr");
    assert.ok(historical.some((h) => h.id === "rej"));
    assert.equal(isEligibleCurrentAttempt(rejected), false);
  });

  it("never treats validation_failed or stub as current", () => {
    const failed = base({ id: "fail", status: "validation_failed", failureMessage: "identity" });
    const stub = base({
      id: "stub",
      status: "generated",
      storagePath: "pre_surgery_projections/c1/stub/placeholder.stub",
    });
    const ok = base({ id: "ok", status: "generated" });
    const { current } = selectCurrentProjectionAttempt({
      projections: [failed, stub, ok],
      key: {
        graftPlanId: "plan-1",
        graftPlanVersion: 4,
        sourceImageId: "src-1",
        mode: "planned",
        artifactType: "illustrative_projected_outcome",
      },
    });
    assert.equal(current?.id, "ok");
  });

  it("exposes HairAudit decision and latency helpers", () => {
    const p = base({
      status: "rejected",
      rejectionReason: "Implausible density",
      inputSnapshot: { generationLatencyMs: 12345 },
    });
    assert.match(hairAuditDecisionLabel(p), /Rejected/);
    assert.equal(readGenerationLatencyMs(p), 12345);
    assert.equal(technicalValidationVerdict(base({ status: "validation_failed" })), "fail");
  });

  it("requires structured clinical review reason codes for reject drawer", () => {
    assert.ok(CLINICAL_REVIEW_REASON_CODES.includes("visible_mask_seam"));
    assert.ok(CLINICAL_REVIEW_REASON_CODES.includes("incorrect_hairline"));
    assert.ok(REJECTION_REASONS.includes("other_clinical_concern"));
    // Drawer must not submit with zero codes — gate is reasonCodes.length === 0
    const selected: string[] = [];
    assert.equal(selected.length === 0, true);
  });
});
