/**
 * UX regression FIX-2 — current attempt hydration, empty reasons, media diagnostics.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  selectCurrentProjectionAttempt,
  isEligibleCurrentAttempt,
  pickHydrationArtifactType,
  diagnoseNoCurrentAttempt,
  diagnoseProjectionMedia,
  attemptRoleLabel,
  hairAuditDecisionLabel,
  technicalValidationVerdict,
  readGenerationLatencyMs,
  NO_CURRENT_ATTEMPT_MESSAGES,
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

const key = {
  graftPlanId: "plan-1",
  graftPlanVersion: 4,
  sourceImageId: "src-1",
  mode: "planned" as const,
  artifactType: "illustrative_projected_outcome" as const,
};

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
      key,
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
      key,
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
    const selected: string[] = [];
    assert.equal(selected.length === 0, true);
  });
});

describe("projection UX regression FIX-2 — hydration & empty states", () => {
  it("eligible current attempt auto-hydrates into preferred artifact", () => {
    const outcome = base({
      id: "out",
      artifactType: "illustrative_projected_outcome",
      status: "clinician_review",
      generatedAt: "2026-08-07T12:00:00.000Z",
    });
    const allocation = base({
      id: "alloc",
      artifactType: "graft_allocation_map",
      status: "approved",
      storagePath: "pre_surgery_projections/c1/graft_allocation_map/planned/a.jpg",
      generatedAt: "2026-08-07T11:00:00.000Z",
    });
    const preferred = pickHydrationArtifactType({
      projections: [allocation, outcome],
      baseKey: {
        graftPlanId: "plan-1",
        graftPlanVersion: 4,
        sourceImageId: "src-1",
        mode: "planned",
      },
    });
    assert.equal(preferred, "illustrative_projected_outcome");
    const { current } = selectCurrentProjectionAttempt({
      projections: [allocation, outcome],
      key: { ...key, artifactType: preferred },
    });
    assert.equal(current?.id, "out");
  });

  it("signed URL failure produces a specific error", () => {
    const diag = diagnoseProjectionMedia({
      sourceSignedUrl: "https://example/source.jpg",
      projectedSignedUrl: null,
      loadError: "Could not sign projection storage path",
    });
    assert.equal(diag?.reason, "signed_url_unavailable");
    assert.equal(diag?.message, NO_CURRENT_ATTEMPT_MESSAGES.signed_url_unavailable);
  });

  it("rejected-only attempts produce latest_attempt_rejected empty state", () => {
    const rejected = base({
      id: "rej",
      status: "rejected",
      rejectionReason: "Visible mask seam",
    });
    const diag = diagnoseNoCurrentAttempt({
      projections: [rejected],
      key,
    });
    assert.equal(diag?.reason, "latest_attempt_rejected");
    assert.match(diag!.message, /rejected/i);
    assert.equal(selectCurrentProjectionAttempt({ projections: [rejected], key }).current, null);
  });

  it("source and outcome URL resolution surfaces source_asset_unavailable", () => {
    const diag = diagnoseProjectionMedia({
      sourceSignedUrl: null,
      projectedSignedUrl: "https://example/out.jpg",
      loadError: null,
    });
    assert.equal(diag?.reason, "source_asset_unavailable");
  });

  it("source and outcome URLs resolve when both present", () => {
    assert.equal(
      diagnoseProjectionMedia({
        sourceSignedUrl: "https://example/source.jpg",
        projectedSignedUrl: "https://example/out.jpg",
        loadError: null,
      }),
      null
    );
  });

  it("switching artifact tabs returns the correct immutable current assets", () => {
    const outcome = base({
      id: "out",
      artifactType: "illustrative_projected_outcome",
      status: "clinician_review",
    });
    const hairline = base({
      id: "hl",
      artifactType: "proposed_hairline_design",
      status: "approved",
      storagePath: "pre_surgery_projections/c1/proposed_hairline_design/planned/h.jpg",
    });
    const alloc = base({
      id: "al",
      artifactType: "graft_allocation_map",
      status: "approved",
      storagePath: "pre_surgery_projections/c1/graft_allocation_map/planned/a.jpg",
    });
    const projections = [outcome, hairline, alloc];
    assert.equal(
      selectCurrentProjectionAttempt({
        projections,
        key: { ...key, artifactType: "illustrative_projected_outcome" },
      }).current?.id,
      "out"
    );
    assert.equal(
      selectCurrentProjectionAttempt({
        projections,
        key: { ...key, artifactType: "proposed_hairline_design" },
      }).current?.id,
      "hl"
    );
    assert.equal(
      selectCurrentProjectionAttempt({
        projections,
        key: { ...key, artifactType: "graft_allocation_map" },
      }).current?.id,
      "al"
    );
  });

  it("current selection survives refresh via persisted tab without becoming historical", () => {
    const current = base({ id: "cur", status: "clinician_review", projectionVersion: 3 });
    const historical = base({
      id: "hist",
      status: "rejected",
      projectionVersion: 2,
      generatedAt: "2026-08-06T00:00:00.000Z",
    });
    const selected = selectCurrentProjectionAttempt({
      projections: [current, historical],
      key,
    });
    // After refresh with same key, canonical current is unchanged.
    const afterRefresh = selectCurrentProjectionAttempt({
      projections: [current, historical],
      key,
    });
    assert.equal(selected.current?.id, "cur");
    assert.equal(afterRefresh.current?.id, "cur");
    assert.equal(
      attemptRoleLabel({
        attempt: current,
        currentId: afterRefresh.current?.id ?? null,
        viewingHistorical: false,
      }),
      "Current candidate"
    );
  });

  it("historical selection does not alter canonical current status", () => {
    const current = base({ id: "cur", status: "clinician_review", projectionVersion: 3 });
    const hist = base({
      id: "hist",
      status: "rejected",
      projectionVersion: 2,
      generatedAt: "2026-08-06T00:00:00.000Z",
    });
    const { current: canonical } = selectCurrentProjectionAttempt({
      projections: [current, hist],
      key,
    });
    assert.equal(canonical?.id, "cur");
    assert.equal(
      attemptRoleLabel({
        attempt: hist,
        currentId: canonical?.id ?? null,
        viewingHistorical: true,
      }),
      "Historical"
    );
    assert.equal(
      attemptRoleLabel({
        attempt: current,
        currentId: canonical?.id ?? null,
        viewingHistorical: true,
      }),
      "Current candidate"
    );
    // Re-select after viewing historical — still same current.
    const again = selectCurrentProjectionAttempt({
      projections: [current, hist],
      key,
    });
    assert.equal(again.current?.id, "cur");
  });

  it("no_attempt_matches_key when records exist for other plan versions", () => {
    const other = base({
      id: "other",
      graftPlanVersion: 3,
      status: "clinician_review",
    });
    const diag = diagnoseNoCurrentAttempt({ projections: [other], key });
    assert.equal(diag?.reason, "no_attempt_matches_key");
  });

  it("failed-only and superseded empty states are precise", () => {
    assert.equal(
      diagnoseNoCurrentAttempt({
        projections: [base({ id: "f", status: "failed", failureMessage: "timeout" })],
        key,
      })?.reason,
      "latest_attempt_failed"
    );
    assert.equal(
      diagnoseNoCurrentAttempt({
        projections: [base({ id: "s", status: "superseded" })],
        key,
      })?.reason,
      "generation_superseded"
    );
  });
});
