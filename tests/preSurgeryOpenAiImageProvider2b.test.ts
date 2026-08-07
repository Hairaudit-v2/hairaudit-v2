/**
 * HA-PRE-SURGERY-OPENAI-IMAGE-PROVIDER-2B — unit coverage (no live OpenAI calls).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OPENAI_GPT_IMAGE_PROVIDER_ID,
  pickOpenAiEditSize,
} from "../src/lib/preSurgeryIntelligence/projection/openaiGptImageProvider";
import { buildOpenAiProjectedOutcomeEditPrompt } from "../src/lib/preSurgeryIntelligence/projection/openaiEditPrompt";
import { assertApprovedHairlineDesignForOutcome } from "../src/lib/preSurgeryIntelligence/projection/hairlineApprovalGate";
import { resolveCosmeticOutcomeProvider } from "../src/lib/preSurgeryIntelligence/projection/health";
import { resolveProjectionArtifactType } from "../src/lib/preSurgeryIntelligence/projection/artifactTypes";
import { openaiCredentialsPresent, resolveProjectionProviderConfig } from "../src/lib/preSurgeryIntelligence/projection/config";
import type { PreSurgeryGraftPlan, PreSurgeryIllustrativeProjection } from "../src/lib/preSurgeryIntelligence/types";

function plan(): PreSurgeryGraftPlan {
  return {
    id: "9301046e-80fa-4cba-9828-01fe3563fdb6",
    caseId: "83de37d6-5548-4efa-afe9-9ceeb34a226d",
    version: 4,
    schemaVersion: "ha-pre-surgery-graft-plan-v1",
    zones: [
      {
        zone: "hairline",
        priority: "essential",
        minimumGrafts: 400,
        targetGrafts: 600,
        maximumGrafts: 800,
        evidenceImageIds: ["img-1"],
      },
    ],
    totalMinimumGrafts: 400,
    totalTargetGrafts: 600,
    totalMaximumGrafts: 800,
    proposedSessionCount: 1,
    stageOneZones: ["hairline"],
    deferredZones: [],
    donorAvailabilityBand: "moderate",
    planningAssumptions: [],
    status: "approved",
    createdBy: "t",
    createdAt: "2026-08-01T00:00:00.000Z",
    checksum: "x",
  };
}

describe("HA-PRE-SURGERY-OPENAI-IMAGE-PROVIDER-2B", () => {
  it("resolves openai config and artifact type", () => {
    const cfg = resolveProjectionProviderConfig({
      HA_PRE_SURGERY_PROJECTION_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test",
      HA_OPENAI_GPT_IMAGE_MODEL: "gpt-image-2",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.kind, "openai");
    assert.equal(cfg.providerId, OPENAI_GPT_IMAGE_PROVIDER_ID);
    assert.equal(cfg.modelVersion, "gpt-image-2");
    assert.equal(cfg.authTokenConfigured, true);
    assert.equal(openaiCredentialsPresent({ OPENAI_API_KEY: "sk-test" } as NodeJS.ProcessEnv), true);
    assert.equal(
      resolveProjectionArtifactType({ providerId: "openai-gpt-image" }),
      "illustrative_projected_outcome"
    );
  });

  it("prefers OpenAI for cosmetic outcome when key present", () => {
    const cosmetic = resolveCosmeticOutcomeProvider({
      HA_PRE_SURGERY_PROJECTION_PROVIDER: "local_illustrative",
      OPENAI_API_KEY: "sk-test",
      HA_IMAGINGOS_PROJECTION_URL: "",
      HA_IMAGINGOS_PROJECTION_TOKEN: "",
    } as NodeJS.ProcessEnv);
    assert.equal(cosmetic.available, true);
    if (cosmetic.available) {
      assert.equal(cosmetic.providerId, OPENAI_GPT_IMAGE_PROVIDER_ID);
      assert.equal(cosmetic.requiresStorageBinding, true);
    }
  });

  it("does not fall back to local-illustrative when openai key missing and kind=openai", () => {
    const cosmetic = resolveCosmeticOutcomeProvider({
      HA_PRE_SURGERY_PROJECTION_PROVIDER: "openai",
      OPENAI_API_KEY: "",
    } as NodeJS.ProcessEnv);
    assert.equal(cosmetic.available, false);
    if (!cosmetic.available) {
      assert.equal(cosmetic.reason, "openai_key_missing");
      assert.notEqual(cosmetic.providerId, "local-illustrative-v1");
    }
  });

  it("builds edit prompt that forbids new identity and colour blocks", () => {
    const { prompt, promptVersion } = buildOpenAiProjectedOutcomeEditPrompt({
      plan: plan(),
      mode: "planned",
      zonesIncluded: ["hairline", "frontal"],
    });
    assert.match(promptVersion, /prompt-v2/);
    assert.match(prompt, /Edit THIS exact patient photograph/i);
    assert.match(prompt, /never solid coloured fills/i);
    assert.match(prompt, /Do not generate a new face/i);
    assert.match(prompt, /soft irregular leading edge/i);
  });

  it("picks portrait size for tall frontal photos", () => {
    assert.equal(pickOpenAiEditSize(1799, 2400), "1024x1536");
    assert.equal(pickOpenAiEditSize(2400, 1799), "1536x1024");
    assert.equal(pickOpenAiEditSize(1024, 1024), "1024x1024");
  });

  it("aspect-fit pad/unpad preserves source ratios (no shear)", async () => {
    const {
      computeAspectFitLayout,
      padImageToCanvas,
      unpadCanvasToSource,
    } = await import("../src/lib/preSurgeryIntelligence/projection/openaiEditGeometry");
    const sharp = (await import("sharp")).default;
    const source = await sharp({
      create: { width: 1799, height: 2400, channels: 3, background: { r: 40, g: 80, b: 120 } },
    })
      .jpeg()
      .toBuffer();
    const layout = computeAspectFitLayout({
      sourceWidth: 1799,
      sourceHeight: 2400,
      canvasWidth: 1024,
      canvasHeight: 1536,
    });
    assert.ok(Math.abs(layout.contentWidth / layout.contentHeight - 1799 / 2400) < 0.002);
    const padded = await padImageToCanvas({ bytes: source, layout });
    const paddedMeta = await sharp(padded).metadata();
    assert.equal(paddedMeta.width, 1024);
    assert.equal(paddedMeta.height, 1536);
    const restored = await unpadCanvasToSource({ bytes: padded, layout, outputFormat: "jpeg" });
    const restoredMeta = await sharp(restored.bytes).metadata();
    assert.equal(restoredMeta.width, 1799);
    assert.equal(restoredMeta.height, 2400);
  });

  it("gates outcome until approved hairline design or annotation", () => {
    const blocked = assertApprovedHairlineDesignForOutcome({
      projections: [],
      plan: plan(),
      annotations: [],
      allowApprovedAnnotationFallback: true,
    });
    assert.equal(blocked.ok, false);

    const ok = assertApprovedHairlineDesignForOutcome({
      projections: [],
      plan: plan(),
      annotations: [
        {
          id: "ann-1",
          caseId: plan().caseId,
          imageId: "img-1",
          annotationType: "proposed_hairline",
          geometryType: "polyline",
          coordinates: [
            { x: 0.2, y: 0.2 },
            { x: 0.5, y: 0.15 },
            { x: 0.8, y: 0.2 },
          ],
          createdBy: "c",
          createdAt: "2026-08-01T00:00:00.000Z",
          schemaVersion: "ha-pre-surgery-annotation-v1",
          source: "clinician",
          approved: true,
        },
      ],
      sourceImageId: "img-1",
    });
    assert.equal(ok.ok, true);

    const design: PreSurgeryIllustrativeProjection = {
      id: "design-1",
      caseId: plan().caseId,
      graftPlanId: plan().id,
      graftPlanVersion: 4,
      sourceImageId: "img-1",
      mode: "planned",
      artifactType: "proposed_hairline_design",
      patientSafeLabel: "Proposed Hairline Design",
      status: "approved",
      engineVersion: "t",
      generationVersion: "t",
      deterministicSeed: null,
      storagePath: "path.jpg",
      validationPass: [],
      limitations: [],
      planningAssumptions: [],
      requestedBy: "c",
      requestedAt: "2026-08-01T00:00:00.000Z",
      generatedAt: "2026-08-01T00:00:00.000Z",
      approvedBy: "c",
      approvedAt: "2026-08-01T00:00:00.000Z",
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      inputChecksum: "i",
      outputChecksum: "o",
      providerId: "local-illustrative-v1",
      projectionVersion: 2,
      patientSharingEnabled: false,
    };
    const fromArtifact = assertApprovedHairlineDesignForOutcome({
      projections: [design],
      plan: plan(),
      annotations: [],
      allowApprovedAnnotationFallback: false,
    });
    assert.equal(fromArtifact.ok, true);
    if (fromArtifact.ok) {
      assert.equal(fromArtifact.hairlineDesignId, "design-1");
      assert.equal(fromArtifact.hairlineVersion, 2);
    }
  });
});
