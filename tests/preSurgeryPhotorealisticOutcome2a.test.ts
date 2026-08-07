/**
 * HA-PRE-SURGERY-PHOTOREALISTIC-OUTCOME-2A — Product separation + ImagingOS hard-fail.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARTIFACT_TYPE_LABELS,
  PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
  isPatientReportOutcomeArtifact,
  resolveProjectionArtifactType,
} from "../src/lib/preSurgeryIntelligence/projection/artifactTypes";
import {
  resolveCosmeticOutcomeProvider,
  resolveRuntimeProjectionProvider,
} from "../src/lib/preSurgeryIntelligence/projection/health";
import { deriveProjectionModeAllocation } from "../src/lib/preSurgeryIntelligence/projection/modes";
import { selectReportEligibleProjections } from "../src/lib/preSurgeryIntelligence/reportIntegration";
import type {
  PreSurgeryGraftPlan,
  PreSurgeryIllustrativeProjection,
} from "../src/lib/preSurgeryIntelligence/types";
import { PRE_SURGERY_PROJECTION_PATIENT_LABELS } from "../src/lib/preSurgeryIntelligence/types";
import { requestPreSurgeryProjection } from "../src/lib/preSurgeryIntelligence/projection/service";
import { createStubPreSurgeryProjectionProvider } from "../src/lib/preSurgeryIntelligence/projection/stubProvider";

function minimalPlan(): PreSurgeryGraftPlan {
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
      {
        zone: "frontal",
        priority: "essential",
        minimumGrafts: 500,
        targetGrafts: 700,
        maximumGrafts: 900,
        evidenceImageIds: ["img-1"],
      },
    ],
    totalMinimumGrafts: 900,
    totalTargetGrafts: 1300,
    totalMaximumGrafts: 1700,
    proposedSessionCount: 1,
    stageOneZones: ["hairline", "frontal"],
    deferredZones: [],
    donorAvailabilityBand: "moderate",
    planningAssumptions: ["test"],
    status: "approved",
    createdBy: "clinician",
    createdAt: "2026-08-01T00:00:00.000Z",
    checksum: "plan-v4",
  };
}

function baseProjection(
  overrides: Partial<PreSurgeryIllustrativeProjection> = {}
): PreSurgeryIllustrativeProjection {
  return {
    id: "cd51d8da-e4d7-4146-993f-23fecce838b7",
    caseId: "83de37d6-5548-4efa-afe9-9ceeb34a226d",
    graftPlanId: "9301046e-80fa-4cba-9828-01fe3563fdb6",
    graftPlanVersion: 4,
    sourceImageId: "img-1",
    mode: "planned",
    artifactType: "graft_allocation_map",
    patientSafeLabel: "Graft Allocation Map · Planned clinical view",
    status: "approved",
    engineVersion: "test",
    generationVersion: "test",
    deterministicSeed: null,
    storagePath:
      "pre_surgery_projections/83de37d6-5548-4efa-afe9-9ceeb34a226d/planned/e31108ddf4db2c2a.jpg",
    validationPass: [],
    limitations: [],
    planningAssumptions: [],
    requestedBy: "clinician",
    requestedAt: "2026-08-01T00:00:00.000Z",
    generatedAt: "2026-08-01T00:00:00.000Z",
    approvedBy: "clinician",
    approvedAt: "2026-08-01T00:00:00.000Z",
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    inputChecksum: "in",
    outputChecksum: "e31108ddf4db2c2a2091f7043fa5e4c9e141a1d1de0e43e35be8995bb446bc95",
    providerId: "local-illustrative-v1",
    patientSharingEnabled: true,
    ...overrides,
  };
}

describe("HA-PRE-SURGERY-PHOTOREALISTIC-OUTCOME-2A", () => {
  it("classifies local-illustrative as graft_allocation_map, never projected outcome", () => {
    assert.equal(
      resolveProjectionArtifactType({ providerId: "local-illustrative-v1" }),
      "graft_allocation_map"
    );
    assert.equal(
      resolveProjectionArtifactType({
        artifactType: "graft_allocation_map",
        providerId: "local-illustrative-v1",
      }),
      "graft_allocation_map"
    );
    assert.equal(isPatientReportOutcomeArtifact("graft_allocation_map"), false);
    assert.equal(ARTIFACT_TYPE_LABELS.graft_allocation_map, "Graft Allocation Map");
    assert.equal(
      ARTIFACT_TYPE_LABELS.illustrative_projected_outcome,
      "Illustrative Projected Outcome"
    );
  });

  it("excludes allocation maps from patient Illustrative Projected Outcome section", () => {
    const map = baseProjection({ patientSharingEnabled: true });
    const eligible = selectReportEligibleProjections([map], {
      graftPlanId: map.graftPlanId,
      graftPlanVersion: 4,
      graftPlanChecksum: "plan-v4",
      totalMinimumGrafts: 900,
      totalTargetGrafts: 1300,
      totalMaximumGrafts: 1700,
      donorAvailabilityBand: "moderate",
      deferredZones: [],
      proposedSessionCount: 1,
      zoneSummaries: [],
      planningAssumptions: [],
    });
    assert.equal(eligible.length, 0);
  });

  it("allows only illustrative_projected_outcome into patient report eligibility", () => {
    const outcome = baseProjection({
      id: "outcome-1",
      artifactType: "illustrative_projected_outcome",
      providerId: "imagingos-v1",
      patientSafeLabel: "Illustrative Projected Outcome · Planned clinical view",
      patientSharingEnabled: true,
    });
    const eligible = selectReportEligibleProjections([outcome], {
      graftPlanId: outcome.graftPlanId,
      graftPlanVersion: 4,
      graftPlanChecksum: "plan-v4",
      totalMinimumGrafts: 900,
      totalTargetGrafts: 1300,
      totalMaximumGrafts: 1700,
      donorAvailabilityBand: "moderate",
      deferredZones: [],
      proposedSessionCount: 1,
      zoneSummaries: [],
      planningAssumptions: [],
    });
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0]!.id, "outcome-1");
  });

  it("does not fall back ImagingOS → local-illustrative for cosmetic provider", () => {
    const cosmetic = resolveCosmeticOutcomeProvider({
      HA_PRE_SURGERY_PROJECTION_PROVIDER: "imagingos",
      HA_IMAGINGOS_PROJECTION_URL: "",
      HA_IMAGINGOS_PROJECTION_TOKEN: "",
      HA_PRE_SURGERY_IMAGINGOS_ENABLED: "false",
    } as NodeJS.ProcessEnv);
    assert.equal(cosmetic.available, false);
    if (!cosmetic.available) {
      assert.equal(cosmetic.message, PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE);
      assert.equal(cosmetic.reason, "credentials_missing");
    }

    const runtime = resolveRuntimeProjectionProvider({
      HA_PRE_SURGERY_PROJECTION_PROVIDER: "imagingos",
      HA_IMAGINGOS_PROJECTION_URL: "",
      HA_IMAGINGOS_PROJECTION_TOKEN: "",
      HA_PRE_SURGERY_PROJECTION_ALLOW_STUB_FALLBACK: "false",
    } as NodeJS.ProcessEnv);
    assert.equal(runtime.disabled, true);
    assert.notEqual(runtime.providerId, "local-illustrative-v1");
  });

  it("stores mode assumptions for conservative/planned/optimistic", () => {
    const plan = minimalPlan();
    const cons = deriveProjectionModeAllocation(plan, "conservative");
    const planned = deriveProjectionModeAllocation(plan, "planned");
    const opt = deriveProjectionModeAllocation(plan, "optimistic_within_approved_range");
    assert.equal(cons.assumptions.graftCount, 900);
    assert.equal(planned.assumptions.graftCount, 1300);
    assert.equal(opt.assumptions.graftCount, 1700);
    assert.ok(cons.assumptions.assumedGraftSurvivalRangePct.min < planned.assumptions.assumedGraftSurvivalRangePct.min);
    assert.ok(planned.assumptions.hairsPerGraftAssumption < opt.assumptions.hairsPerGraftAssumption);
    assert.equal(cons.patientSafeLabel, PRE_SURGERY_PROJECTION_PATIENT_LABELS.conservative);
  });

  it("rejects local-illustrative attempts to mint illustrative_projected_outcome", async () => {
    const plan = minimalPlan();
    const result = await requestPreSurgeryProjection({
      caseId: plan.caseId,
      plan,
      sourceReview: {
        id: "rev-1",
        caseId: plan.caseId,
        imageId: "img-1",
        schemaVersion: "ha-pre-surgery-image-review-v1",
        originalAiRole: "frontal_preop",
        originalAiConfidence: 0.9,
        originalAiWarnings: [],
        originalAiObservations: [],
        classifierModelVersion: "test",
        assignedRole: "frontal_preop",
        orientationDegrees: 0,
        mirrored: false,
        qualityFlags: [],
        reviewStatus: "confirmed",
        requiredOrOptional: "required",
        imageSource: "clinician",
        captureDate: null,
        uploaderId: null,
        clinicianNote: null,
        reviewedBy: "clinician",
        reviewedAt: "2026-08-01T00:00:00.000Z",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
      sourceImageRef: "storage:test.jpg",
      approvedAnnotations: [],
      mode: "planned",
      artifactType: "illustrative_projected_outcome",
      requiredImagesPresent: true,
      proposedHairlineConfirmed: true,
      treatmentAreaConfirmed: true,
      requestedBy: "clinician",
      provider: createStubPreSurgeryProjectionProvider(),
      providerId: "local-illustrative-v1",
      modelVersion: "local-illustrative-v1",
      requireValidImageAsset: false,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errors[0]?.code, "imaging_provider_not_configured");
      assert.equal(result.errors[0]?.message, PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE);
    }
  });
});
