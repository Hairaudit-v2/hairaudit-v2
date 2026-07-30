/**
 * HA-PRE-SURGERY-INTELLIGENCE-2D — Controlled ImagingOS activation unit suite.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyOutputValidationToProjection,
  assertSeniorClinicianForShadowApproval,
  buildPatientProjectionConsentRecord,
  buildPatientProjectionPresentation,
  buildProjectionOpsDashboard,
  createStubPreSurgeryProjectionProvider,
  decidePatientSharingAllowed,
  decideProjectionActivation,
  evaluatePatientProjectionVisibility,
  evaluateProjectionStaleness,
  markProjectionStale,
  PATIENT_PROJECTION_CONSENT_STATEMENTS,
  PATIENT_PROJECTION_FRAMING,
  requestPreSurgeryProjection,
  resolveProjectionActivationControls,
  resolveShadowModePolicy,
  revokeAllPatientSharing,
  ROLLBACK_2B_CHECKLIST,
  runProjectionPreflight,
  validateProviderProjectionOutput,
  validateShadowQualityReview,
  verifyRollbackTo2BBoundary,
  approveIllustrativeProjectionWithChecklist,
  emptyApprovalChecklist,
  buildImageReviewFromUpload,
  createAnnotation,
  createClinicianPlanRevision,
  seedAiGraftPlan,
  selectReportEligibleProjections,
} from "@/lib/preSurgeryIntelligence";

function approvedPlan(id = "p2") {
  const plan = seedAiGraftPlan({
    caseId: "c",
    createdBy: "c",
    norwood: "III",
    evidenceImageIds: ["img-1"],
    id: "p1",
  });
  return createClinicianPlanRevision(
    plan,
    {
      status: "approved",
      approvedBy: "c",
      approvedAt: "2026-07-30T00:00:00.000Z",
      zones: plan.zones.map((z) => ({ ...z, evidenceImageIds: ["img-1"] })),
    },
    "c",
    { id }
  );
}

function confirmedReview() {
  const review = buildImageReviewFromUpload("c", {
    id: "img-1",
    type: "patient_photo:preop_front",
  });
  review.reviewStatus = "confirmed";
  return review;
}

function hairlineAnn() {
  return createAnnotation({
    caseId: "c",
    imageId: "img-1",
    annotationType: "proposed_hairline",
    geometryType: "polyline",
    coordinates: [
      { x: 0.2, y: 0.3 },
      { x: 0.8, y: 0.3 },
    ],
    createdBy: "c",
    approved: true,
  });
}

describe("HA-PRE-SURGERY-INTELLIGENCE-2D activation controls", () => {
  it("defaults ImagingOS enablement off and keeps stub-safe release stage", () => {
    const controls = resolveProjectionActivationControls({});
    assert.equal(controls.imagingOsEnabled, false);
    assert.equal(controls.providerKillSwitch, false);
    assert.equal(controls.patientSharingKillSwitch, false);
    assert.equal(controls.shadowMode, false);
    assert.equal(controls.releaseStage, "wider_controlled");
  });

  it("does not allow ImagingOS traffic without global enablement", () => {
    const controls = resolveProjectionActivationControls({
      HA_PRE_SURGERY_IMAGINGOS_ENABLED: "false",
    });
    const decision = decideProjectionActivation({
      controls,
      providerKind: "imagingos",
      clinicId: "clinic-1",
      clinicianId: "doc-1",
      caseId: "case-1",
      mode: "planned",
      requestsForCase: 0,
      requestsToday: 0,
      caseLevelEnabled: true,
    });
    assert.equal(decision.allowed, false);
    if (!decision.allowed) assert.equal(decision.code, "imagingos_not_enabled");
  });

  it("enforces clinic / clinician / case allowlists when ImagingOS is enabled", () => {
    const controls = resolveProjectionActivationControls({
      HA_PRE_SURGERY_IMAGINGOS_ENABLED: "true",
      HA_PRE_SURGERY_PROJECTION_CLINIC_ALLOWLIST: "clinic-a",
      HA_PRE_SURGERY_PROJECTION_CLINICIAN_ALLOWLIST: "doc-a",
      HA_PRE_SURGERY_PROJECTION_CASE_ALLOWLIST: "case-a",
      HA_PRE_SURGERY_PROJECTION_RELEASE_STAGE: "selected_clinics",
    });
    const denied = decideProjectionActivation({
      controls,
      providerKind: "imagingos",
      clinicId: "clinic-b",
      clinicianId: "doc-a",
      caseId: "case-a",
      mode: "planned",
      requestsForCase: 0,
      requestsToday: 0,
      caseLevelEnabled: true,
    });
    assert.equal(denied.allowed, false);

    const allowed = decideProjectionActivation({
      controls,
      providerKind: "imagingos",
      clinicId: "clinic-a",
      clinicianId: "doc-a",
      caseId: "case-a",
      mode: "planned",
      requestsForCase: 0,
      requestsToday: 0,
      caseLevelEnabled: true,
    });
    assert.equal(allowed.allowed, true);
  });

  it("keeps patient sharing independently kill-switchable", () => {
    const controls = resolveProjectionActivationControls({
      HA_PRE_SURGERY_PATIENT_SHARING_KILL_SWITCH: "true",
    });
    const share = decidePatientSharingAllowed({
      controls,
      patientConsentRecorded: true,
      projectionApproved: true,
    });
    assert.equal(share.allowed, false);
    if (!share.allowed) assert.equal(share.code, "patient_sharing_kill_switch");
  });

  it("provider kill switch blocks generation without contacting provider", async () => {
    const result = await requestPreSurgeryProjection({
      caseId: "c",
      plan: approvedPlan(),
      sourceReview: confirmedReview(),
      sourceImageRef: "storage:x",
      approvedAnnotations: [hairlineAnn()],
      mode: "planned",
      requiredImagesPresent: true,
      proposedHairlineConfirmed: true,
      treatmentAreaConfirmed: true,
      requestedBy: "doc",
      provider: createStubPreSurgeryProjectionProvider(),
      activation: {
        enforceActivation: true,
        controls: resolveProjectionActivationControls({
          HA_PRE_SURGERY_PROVIDER_KILL_SWITCH: "true",
        }),
        providerKind: "stub",
        caseLevelEnabled: true,
      },
    });
    // Kill switch checked before custom provider when enforceActivation uses controls —
    // with custom provider passed, kill switch still checked at top when controls say so.
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "provider_kill_switch"));
    assert.ok(
      (result.auditHints ?? []).some((h) => h.eventType === "projection_activation_denied")
    );
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2D preflight", () => {
  it("rejects without contacting ImagingOS when checksum mismatches", () => {
    const plan = approvedPlan();
    const outcome = runProjectionPreflight({
      casePathway: "pre_surgery",
      professionalAuthorised: true,
      professionalAssigned: true,
      sourceReviews: [confirmedReview()],
      primarySourceImageId: "img-1",
      existingSourceImageIds: ["img-1"],
      requiredImagesPresent: true,
      pendingImageCorrections: false,
      approvedPlan: plan,
      intendedPlanId: plan.id,
      intendedPlanVersion: plan.version,
      intendedPlanChecksum: plan.checksum,
      intendedInputChecksum: "abc",
      computedInputChecksum: "def",
      mode: "planned",
      providerHealth: {
        healthy: true,
        providerId: "stub-v1",
        latencyMs: 1,
        detail: "ok",
        checkedAt: new Date().toISOString(),
      },
      activation: {
        controls: resolveProjectionActivationControls({}),
        providerKind: "stub",
        clinicId: null,
        clinicianId: "doc",
        caseId: "c",
        requestsForCase: 0,
        requestsToday: 0,
        caseLevelEnabled: true,
      },
      clinicPolicySatisfied: true,
      patientGenerationConsentSatisfied: true,
      approvedAnnotations: [hairlineAnn()],
      approvedObservations: [],
    });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.contactedProvider, false);
      assert.equal(outcome.auditEventType, "projection_preflight_rejected");
      assert.ok(outcome.failures.some((f) => f.code === "checksum_mismatch"));
    }
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2D shadow mode", () => {
  it("prevents patient sharing and requires senior review", () => {
    const controls = resolveProjectionActivationControls({
      HA_PRE_SURGERY_PROJECTION_SHADOW_MODE: "true",
    });
    const policy = resolveShadowModePolicy(controls);
    assert.ok(policy?.active);
    assert.equal(policy?.preventPatientSharing, true);

    const senior = assertSeniorClinicianForShadowApproval({
      policy,
      actorRole: "junior_doctor",
    });
    assert.equal(senior.ok, false);

    const ok = assertSeniorClinicianForShadowApproval({
      policy,
      actorRole: "senior_clinician",
    });
    assert.equal(ok.ok, true);

    const share = decidePatientSharingAllowed({
      controls,
      shadowMode: true,
      patientConsentRecorded: true,
      projectionApproved: true,
    });
    assert.equal(share.allowed, false);
  });

  it("records structured shadow quality review requirements", () => {
    const bad = validateShadowQualityReview({
      projectionId: "p1",
      reviewerId: "r1",
      seniorClinician: false,
      comparedToSourcePlan: true,
      safetyChecklistComplete: true,
      dimensions: {},
      reviewedAt: "2026-07-30T00:00:00.000Z",
    });
    assert.equal(bad.ok, false);

    const good = validateShadowQualityReview({
      projectionId: "p1",
      reviewerId: "r1",
      seniorClinician: true,
      comparedToSourcePlan: true,
      safetyChecklistComplete: true,
      dimensions: { hairline_accuracy: "pass" },
      reviewedAt: "2026-07-30T00:00:00.000Z",
    });
    assert.equal(good.ok, true);
  });

  it("stores successful shadow generations as clinician_review without sharing", async () => {
    const result = await requestPreSurgeryProjection({
      caseId: "c",
      plan: approvedPlan(),
      sourceReview: confirmedReview(),
      sourceImageRef: "storage:x",
      approvedAnnotations: [hairlineAnn()],
      mode: "planned",
      requiredImagesPresent: true,
      proposedHairlineConfirmed: true,
      treatmentAreaConfirmed: true,
      requestedBy: "doc",
      provider: createStubPreSurgeryProjectionProvider(),
      activation: {
        controls: resolveProjectionActivationControls({
          HA_PRE_SURGERY_PROJECTION_SHADOW_MODE: "true",
        }),
        providerKind: "stub",
        caseLevelEnabled: true,
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.projection.status, "clinician_review");
      assert.equal(result.projection.patientSharingEnabled, false);
      assert.equal(result.projection.shadowMode, true);
    }
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2D output validation", () => {
  it("moves malformed output to failed, not clinician_review", () => {
    const validation = validateProviderProjectionOutput({
      caseId: "c",
      attemptId: "a1",
      expectedProviderRequestId: "req-1",
      actualProviderRequestId: "req-2",
      mimeType: "application/javascript",
      fileSizeBytes: 10,
      widthPx: 10,
      heightPx: 10,
      outputChecksum: null,
      storageChecksumRecorded: false,
      safetyMetadataPresent: false,
      malformedOrExecutablePayload: true,
      unexpectedEmbeddedPatientData: true,
    });
    assert.equal(validation.ok, false);
    if (!validation.ok) assert.equal(validation.targetStatus, "failed");

    const projection = applyOutputValidationToProjection(
      {
        id: "a1",
        caseId: "c",
        graftPlanId: "p",
        graftPlanVersion: 1,
        sourceImageId: "img-1",
        mode: "planned",
        patientSafeLabel: "Illustrative planned projection",
        status: "clinician_review",
        engineVersion: "ha-pre-surgery-projection-v2",
        generationVersion: "ha-pre-surgery-projection-v2",
        deterministicSeed: null,
        storagePath: "storage:x",
        validationPass: [],
        limitations: [],
        planningAssumptions: [],
        requestedBy: "d",
        requestedAt: "2026-07-30T00:00:00.000Z",
        generatedAt: "2026-07-30T00:00:00.000Z",
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        inputChecksum: "x",
        outputChecksum: "y",
      },
      validation
    );
    assert.equal(projection.status, "failed");
    assert.equal(projection.storagePath, null);
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2D staleness", () => {
  it("marks projections stale when the approved graft plan changes", () => {
    const plan = approvedPlan("p-old");
    const newer = approvedPlan("p-new");
    newer.version = plan.version + 1;

    const projection = {
      id: "proj-1",
      caseId: "c",
      graftPlanId: plan.id,
      graftPlanVersion: plan.version,
      sourceImageId: "img-1",
      mode: "planned" as const,
      patientSafeLabel: "Illustrative planned projection",
      status: "approved" as const,
      engineVersion: "ha-pre-surgery-projection-v2",
      generationVersion: "ha-pre-surgery-projection-v2",
      deterministicSeed: null,
      storagePath: "s",
      validationPass: [],
      limitations: [],
      planningAssumptions: [],
      requestedBy: "d",
      requestedAt: "2026-07-30T00:00:00.000Z",
      generatedAt: "2026-07-30T00:00:00.000Z",
      approvedBy: "d",
      approvedAt: "2026-07-30T01:00:00.000Z",
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      inputChecksum: "x",
      outputChecksum: "y",
      patientSharingEnabled: true,
    };

    const decision = evaluateProjectionStaleness(projection, {
      currentApprovedPlan: newer,
      currentSourceReviews: [confirmedReview()],
      currentAnnotations: [],
      currentObservations: [],
      caseEligible: true,
    });
    assert.equal(decision.stale, true);
    if (decision.stale) {
      assert.ok(decision.reasons.includes("approved_graft_plan_changed"));
    }

    const stale = markProjectionStale(projection, ["approved_graft_plan_changed"]);
    assert.equal(stale.patientSharingEnabled, false);
    assert.ok(stale.staleAt);

    const visibility = evaluatePatientProjectionVisibility({
      projection: stale,
      currentApprovedPlan: newer,
    });
    assert.equal(visibility.visible, false);
    if (!visibility.visible) assert.equal(visibility.reason, "stale");

    const eligible = selectReportEligibleProjections([stale], {
      graftPlanId: newer.id,
      graftPlanVersion: newer.version,
      graftPlanChecksum: newer.checksum,
      totalMinimumGrafts: newer.totalMinimumGrafts,
      totalTargetGrafts: newer.totalTargetGrafts,
      totalMaximumGrafts: newer.totalMaximumGrafts,
      donorAvailabilityBand: newer.donorAvailabilityBand,
      deferredZones: newer.deferredZones,
      proposedSessionCount: newer.proposedSessionCount,
      zoneSummaries: [],
      planningAssumptions: [],
    });
    assert.equal(eligible.length, 0);
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2D patient consent + presentation", () => {
  it("requires all consent statements and shows approval date + plan version", () => {
    const incomplete = buildPatientProjectionConsentRecord({
      caseId: "c",
      projectionId: "p1",
      recordedBy: "doc",
      confirmedStatements: PATIENT_PROJECTION_CONSENT_STATEMENTS.slice(0, 2),
      approvalDate: "2026-07-30T00:00:00.000Z",
      graftPlanId: "plan-1",
      graftPlanVersion: 2,
    });
    assert.equal(incomplete.ok, false);

    const complete = buildPatientProjectionConsentRecord({
      caseId: "c",
      projectionId: "p1",
      recordedBy: "doc",
      confirmedStatements: [...PATIENT_PROJECTION_CONSENT_STATEMENTS],
      approvalDate: "2026-07-30T00:00:00.000Z",
      graftPlanId: "plan-1",
      graftPlanVersion: 2,
    });
    assert.equal(complete.ok, true);

    const presentation = buildPatientProjectionPresentation({
      approvalDate: "2026-07-30T00:00:00.000Z",
      graftPlanVersion: 2,
      graftPlanId: "plan-1",
      label: "Illustrative planned projection",
      framing: PATIENT_PROJECTION_FRAMING,
    });
    assert.ok(!("error" in presentation));
    if (!("error" in presentation)) {
      assert.equal(presentation.approvalDate, "2026-07-30T00:00:00.000Z");
      assert.equal(presentation.graftPlanVersion, 2);
    }
  });

  it("never uses predicted/guaranteed language in framing", () => {
    for (const line of PATIENT_PROJECTION_FRAMING) {
      assert.doesNotMatch(line, /predicted|guaranteed|expected result/i);
    }
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2D ops dashboard + rollback", () => {
  it("summarises operational projection state", () => {
    const dash = buildProjectionOpsDashboard({
      projections: [
        {
          id: "1",
          caseId: "c",
          graftPlanId: "p",
          graftPlanVersion: 1,
          sourceImageId: "i",
          mode: "planned",
          patientSafeLabel: "Illustrative planned projection",
          status: "clinician_review",
          engineVersion: "ha-pre-surgery-projection-v2",
          generationVersion: "ha-pre-surgery-projection-v2",
          deterministicSeed: null,
          storagePath: null,
          validationPass: [],
          limitations: [],
          planningAssumptions: [],
          requestedBy: "d",
          requestedAt: "2026-07-30T00:00:00.000Z",
          generatedAt: null,
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          inputChecksum: "x",
          outputChecksum: null,
          providerId: "stub-v1",
          providerModelVersion: "stub-v1",
        },
        {
          id: "2",
          caseId: "c",
          graftPlanId: "p",
          graftPlanVersion: 1,
          sourceImageId: "i",
          mode: "planned",
          patientSafeLabel: "Illustrative planned projection",
          status: "rejected",
          engineVersion: "ha-pre-surgery-projection-v2",
          generationVersion: "ha-pre-surgery-projection-v2",
          deterministicSeed: null,
          storagePath: null,
          validationPass: [],
          limitations: [],
          planningAssumptions: [],
          requestedBy: "d",
          requestedAt: "2026-07-30T00:00:00.000Z",
          generatedAt: null,
          approvedBy: null,
          approvedAt: null,
          rejectedBy: "d",
          rejectedAt: "2026-07-30T00:00:00.000Z",
          rejectionReason: "bad",
          rejectionReasonCode: "image_artefact",
          inputChecksum: "x",
          outputChecksum: null,
          providerId: "stub-v1",
        },
      ],
      samples: [
        { at: "2026-07-30T00:00:00.000Z", providerId: "stub-v1", ok: true, latencyMs: 120 },
        { at: "2026-07-30T00:00:00.000Z", providerId: "stub-v1", ok: false, latencyMs: 400, rejected: true },
      ],
      shadowModeActive: true,
      patientSharingKillSwitch: false,
      providerKillSwitch: false,
    });
    assert.equal(dash.awaitingClinicianReviewCount, 1);
    assert.equal(dash.rejectionCount, 1);
    assert.equal(dash.commonRejectionReasons[0]?.reasonCode, "image_artefact");
    assert.equal(dash.shadowModeActive, true);
    assert.ok(dash.providerVersionsInUse.includes("stub-v1"));
  });

  it("proves rollback to 2B boundary without data loss", () => {
    assert.ok(ROLLBACK_2B_CHECKLIST.some((c) => c.id === "disable_imagingos_generation"));
    assert.ok(ROLLBACK_2B_CHECKLIST.some((c) => c.category === "database"));
    assert.ok(ROLLBACK_2B_CHECKLIST.some((c) => c.category === "environment"));

    const projections = [
      {
        id: "pinned-1",
        caseId: "c",
        graftPlanId: "p",
        graftPlanVersion: 1,
        sourceImageId: "i",
        mode: "planned" as const,
        patientSafeLabel: "Illustrative planned projection",
        status: "approved" as const,
        engineVersion: "ha-pre-surgery-projection-v2",
        generationVersion: "ha-pre-surgery-projection-v2",
        deterministicSeed: null,
        storagePath: "s",
        validationPass: [],
        limitations: [],
        planningAssumptions: [],
        requestedBy: "d",
        requestedAt: "2026-07-30T00:00:00.000Z",
        generatedAt: "2026-07-30T00:00:00.000Z",
        approvedBy: "d",
        approvedAt: "2026-07-30T00:00:00.000Z",
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        inputChecksum: "x",
        outputChecksum: "y",
        patientSharingEnabled: true,
      },
    ];

    const verified = verifyRollbackTo2BBoundary({
      env: {
        HA_PRE_SURGERY_PROJECTION_PROVIDER: "stub",
        HA_PRE_SURGERY_IMAGINGOS_ENABLED: "false",
        HA_PRE_SURGERY_PATIENT_SHARING_KILL_SWITCH: "true",
        HA_PRE_SURGERY_PROVIDER_KILL_SWITCH: "true",
      },
      projections,
      existingPinnedProjectionIds: ["pinned-1"],
    });
    assert.equal(verified.ok, true);

    const revoked = revokeAllPatientSharing(projections);
    assert.equal(revoked[0]!.patientSharingEnabled, false);
    assert.ok(revoked[0]!.staleAt);
  });

  it("approve in shadow mode does not enable patient sharing", () => {
    const checklist = emptyApprovalChecklist();
    for (const k of Object.keys(checklist) as (keyof typeof checklist)[]) {
      checklist[k] = true;
    }
    const result = approveIllustrativeProjectionWithChecklist({
      projection: {
        id: "a1",
        caseId: "c",
        graftPlanId: "p",
        graftPlanVersion: 1,
        sourceImageId: "img-1",
        mode: "planned",
        patientSafeLabel: "Illustrative planned projection",
        patientSafeDisclaimer: "Illustrative only",
        status: "clinician_review",
        engineVersion: "ha-pre-surgery-projection-v2",
        generationVersion: "ha-pre-surgery-projection-v2",
        deterministicSeed: null,
        storagePath: "s",
        validationPass: [],
        limitations: [],
        planningAssumptions: [],
        requestedBy: "d",
        requestedAt: "2026-07-30T00:00:00.000Z",
        generatedAt: "2026-07-30T00:00:00.000Z",
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        inputChecksum: "x",
        outputChecksum: "y",
        shadowMode: true,
      },
      actor: { clinicianId: "senior", role: "senior_clinician", organisationId: null },
      checklist,
      shadowMode: true,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.projection.patientSharingEnabled, false);
  });
});
