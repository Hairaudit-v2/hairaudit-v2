/**
 * HA-PRE-SURGERY-PROJECTION-REAL-ASSET-1A — unit coverage for local composer + plan gates.
 * Run: pnpm exec tsx --test tests/preSurgeryProjectionRealAsset1a.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { composeLocalIllustrativeProjection } from "../src/lib/preSurgeryIntelligence/projection/localIllustrativeComposer";
import {
  assertProjectionAssetApproximatelyForApproval,
  isStubProjectionStoragePath,
  STUB_GENERATION_NO_ASSET_MESSAGE,
} from "../src/lib/preSurgeryIntelligence/projection/assetValidation";
import { resolvePlanForProjectionGeneration } from "../src/lib/preSurgeryIntelligence/projection/planConfirmation";
import { approveIllustrativeProjectionWithChecklist, emptyApprovalChecklist } from "../src/lib/preSurgeryIntelligence/projection/approval";
import { selectReportEligibleProjections } from "../src/lib/preSurgeryIntelligence/reportIntegration";
import type {
  PreSurgeryGraftPlan,
  PreSurgeryIllustrativeProjection,
} from "../src/lib/preSurgeryIntelligence/types";

function plan(version: number, status: PreSurgeryGraftPlan["status"], id: string): PreSurgeryGraftPlan {
  return {
    id,
    caseId: "83de37d6-5548-4efa-afe9-9ceeb34a226d",
    version,
    schemaVersion: "ha-pre-surgery-graft-plan-v1",
    zones: [
      {
        zone: "hairline",
        priority: "essential",
        minimumGrafts: 400,
        targetGrafts: 600,
        maximumGrafts: 800,
        evidenceImageIds: [],
      },
      {
        zone: "crown",
        priority: "defer",
        minimumGrafts: 0,
        targetGrafts: 0,
        maximumGrafts: 0,
        evidenceImageIds: [],
      },
    ],
    totalMinimumGrafts: 400,
    totalTargetGrafts: 600,
    totalMaximumGrafts: 800,
    proposedSessionCount: 1,
    stageOneZones: ["hairline"],
    deferredZones: ["crown"],
    donorAvailabilityBand: "moderate",
    planningAssumptions: ["test"],
    status,
    createdBy: "test",
    createdAt: "2026-08-01T00:00:00.000Z",
    checksum: `chk-${version}`,
  };
}

describe("HA-PRE-SURGERY-PROJECTION-REAL-ASSET-1A", () => {
  it("composes a real JPEG with non-zero bytes and valid dimensions", async () => {
    const source = await sharp({
      create: { width: 640, height: 640, channels: 3, background: { r: 180, g: 140, b: 120 } },
    })
      .jpeg()
      .toBuffer();

    const out = await composeLocalIllustrativeProjection({
      sourceBytes: source,
      caseId: "83de37d6-5548-4efa-afe9-9ceeb34a226d",
      mode: "planned",
      plan: plan(4, "approved", "9301046e-80fa-4cba-9828-01fe3563fdb6"),
      annotations: [],
      engineVersion: "ha-pre-surgery-projection-v2",
      inputChecksum: "abc",
    });

    assert.equal(out.mimeType, "image/jpeg");
    assert.ok(out.bytes.byteLength > 1000);
    assert.ok(out.widthPx >= 256);
    assert.ok(out.heightPx >= 256);
    assert.match(out.outputChecksum, /^[a-f0-9]{64}$/);
  });

  it("requires confirmation of the current approved plan", () => {
    const v3 = plan(3, "superseded", "5b7cc2c1-ed8c-4b81-9f65-509481b94cf6");
    const v4 = plan(4, "approved", "9301046e-80fa-4cba-9828-01fe3563fdb6");
    const denied = resolvePlanForProjectionGeneration({
      graftPlans: [v3, v4],
      confirmation: { confirmCurrentApprovedPlan: false },
      imageReviews: [],
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.code, "plan_confirmation_required");

    const ok = resolvePlanForProjectionGeneration({
      graftPlans: [v3, v4],
      confirmation: { confirmCurrentApprovedPlan: true },
      imageReviews: [],
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.plan.version, 4);
      assert.equal(ok.preview.isCurrentApproved, true);
    }
  });

  it("blocks superseded plan unless explicitly allowed", () => {
    const v3 = plan(3, "superseded", "5b7cc2c1-ed8c-4b81-9f65-509481b94cf6");
    const v4 = plan(4, "approved", "9301046e-80fa-4cba-9828-01fe3563fdb6");
    const denied = resolvePlanForProjectionGeneration({
      graftPlans: [v3, v4],
      requestedGraftPlanId: v3.id,
      confirmation: { confirmCurrentApprovedPlan: true, allowSupersededPlan: false },
      imageReviews: [],
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.code, "superseded_plan_blocked");
  });

  it("rejects approval when storage path is stub", () => {
    assert.equal(isStubProjectionStoragePath("x.stub"), true);
    const projection = {
      id: "p1",
      caseId: "c",
      graftPlanId: "g",
      graftPlanVersion: 3,
      sourceImageId: "i",
      mode: "planned",
      patientSafeLabel: "Planned coverage illustration",
      patientSafeDisclaimer: "Illustrative planning aid — not a guaranteed outcome.",
      status: "clinician_review",
      engineVersion: "ha-pre-surgery-projection-v2",
      generationVersion: "ha-pre-surgery-projection-v2",
      storagePath: "pre_surgery_projections/c/planned/abc.stub",
      validationPass: [],
      limitations: [],
      planningAssumptions: [],
      requestedBy: "u",
      requestedAt: "2026-08-01T00:00:00.000Z",
      generatedAt: "2026-08-01T00:00:00.000Z",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      inputChecksum: "in",
      outputChecksum: "out",
      providerId: "stub-v1",
      patientSharingEnabled: false,
    } as unknown as PreSurgeryIllustrativeProjection;

    const gate = assertProjectionAssetApproximatelyForApproval({
      storagePath: projection.storagePath,
      status: projection.status,
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.message, STUB_GENERATION_NO_ASSET_MESSAGE);

    const checklist = emptyApprovalChecklist();
    for (const k of Object.keys(checklist) as Array<keyof typeof checklist>) {
      checklist[k] = true;
    }
    const approved = approveIllustrativeProjectionWithChecklist({
      projection,
      actor: { clinicianId: "u", role: "clinician", organisationId: null },
      checklist,
    });
    assert.equal(approved.ok, false);
    if (!approved.ok) assert.equal(approved.code, "stub_placeholder");
  });

  it("excludes stub and plan-mismatched projections from patient report eligibility", () => {
    const graftPlan = {
      graftPlanId: "9301046e-80fa-4cba-9828-01fe3563fdb6",
      graftPlanVersion: 4,
      graftPlanChecksum: "chk-4",
      totalMinimumGrafts: 400,
      totalTargetGrafts: 600,
      totalMaximumGrafts: 800,
      donorAvailabilityBand: "moderate" as const,
      deferredZones: ["crown"],
      proposedSessionCount: 1 as const,
      zoneSummaries: [],
      planningAssumptions: [],
    };
    const stubV3 = {
      id: "5c8aebba-de12-4cee-a509-866f0d198589",
      status: "approved",
      patientSharingEnabled: true,
      patientSafeLabel: "Planned coverage illustration",
      graftPlanId: "5b7cc2c1-ed8c-4b81-9f65-509481b94cf6",
      graftPlanVersion: 3,
      storagePath: "pre_surgery_projections/83de37d6/planned/e837d07ae751ec4f.stub",
      outputChecksum: "x",
    } as unknown as PreSurgeryIllustrativeProjection;
    const realV4 = {
      id: "new-real",
      status: "approved",
      patientSharingEnabled: true,
      patientSafeLabel: "Planned coverage illustration",
      graftPlanId: graftPlan.graftPlanId,
      graftPlanVersion: 4,
      storagePath: "pre_surgery_projections/83de37d6/planned/abcdef0123456789.jpg",
      outputChecksum: "deadbeef",
    } as unknown as PreSurgeryIllustrativeProjection;

    const eligible = selectReportEligibleProjections([stubV3, realV4], graftPlan);
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0]!.id, "new-real");
  });
});
