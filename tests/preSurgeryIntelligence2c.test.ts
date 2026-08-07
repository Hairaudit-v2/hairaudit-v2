/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — ImagingOS adapter, lifecycle, approval, visibility.
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  APPROVAL_CHECKLIST_KEYS,
  assertCallbackNotReplayed,
  assertCallbackTargetsCase,
  assertProjectionStatusTransition,
  approveIllustrativeProjectionWithChecklist,
  buildCanonicalProjectionRequest,
  buildClinicianReportSlice,
  buildImageReviewFromUpload,
  buildRegenerationSeed,
  checkProjectionProviderHealth,
  checksumCanonicalProjectionRequest,
  createAnnotation,
  createClinicianPlanRevision,
  createImagingOsPreSurgeryProjectionProvider,
  createMemoryCallbackReplayStore,
  createStubPreSurgeryProjectionProvider,
  emptyApprovalChecklist,
  evaluatePatientProjectionVisibility,
  findUnsafePatientClaimLanguage,
  imagingosConfigReady,
  PATIENT_PROJECTION_FRAMING,
  rejectIllustrativeProjection,
  requestPreSurgeryProjection,
  resolveProjectionProviderConfig,
  resolveRuntimeProjectionProvider,
  signImagingOsRequest,
  supersedeApprovedProjection,
  summariseProjectionMetrics,
  validateProjectionModeContract,
  verifyImagingOsCallbackSignature,
  seedAiGraftPlan,
  PRE_SURGERY_PROJECTION_PATIENT_LABELS,
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

describe("HA-PRE-SURGERY-INTELLIGENCE-2C provider configuration", () => {
  it("defaults to local_illustrative for real asset generation", () => {
    const cfg = resolveProjectionProviderConfig({});
    assert.equal(cfg.kind, "local_illustrative");
    assert.equal(cfg.providerId, "local-illustrative-v1");
    const runtime = resolveRuntimeProjectionProvider({});
    assert.equal(runtime.providerId, "local-illustrative-v1");
    assert.equal(runtime.disabled, false);
    assert.equal(runtime.requiresStorageBinding, true);
  });

  it("keeps explicit stub available for offline tests", () => {
    const runtime = resolveRuntimeProjectionProvider({
      HA_PRE_SURGERY_PROJECTION_PROVIDER: "stub",
    });
    assert.equal(runtime.providerId, "stub-v1");
    assert.equal(runtime.requiresStorageBinding, false);
  });

  it("does not fall back to local_illustrative when ImagingOS is misconfigured", () => {
    const cfg = resolveProjectionProviderConfig({
      HA_PRE_SURGERY_PROJECTION_PROVIDER: "imagingos",
      HA_IMAGINGOS_PROJECTION_URL: "",
      HA_IMAGINGOS_PROJECTION_TOKEN: "",
    });
    assert.equal(cfg.kind, "imagingos");
    assert.equal(imagingosConfigReady(cfg), false);
    const runtime = resolveRuntimeProjectionProvider({
      HA_PRE_SURGERY_PROJECTION_PROVIDER: "imagingos",
    });
    // PHOTOREALISTIC-OUTCOME-2A: hard-unavailable — never substitute overlay maps.
    assert.equal(runtime.providerId, "imagingos-v1");
    assert.equal(runtime.disabled, true);
    assert.equal(runtime.requiresStorageBinding, false);
    assert.notEqual(runtime.providerId, "local-illustrative-v1");
  });

  it("allows explicit stub fallback only when configured", () => {
    const runtime = resolveRuntimeProjectionProvider({
      HA_PRE_SURGERY_PROJECTION_PROVIDER: "imagingos",
      HA_PRE_SURGERY_PROJECTION_ALLOW_STUB_FALLBACK: "true",
    });
    assert.equal(runtime.providerId, "stub-v1");
    assert.equal(runtime.disabled, false);
  });

  it("supports safe-disabled provider", async () => {
    const runtime = resolveRuntimeProjectionProvider({
      HA_PRE_SURGERY_PROJECTION_PROVIDER: "disabled",
    });
    assert.equal(runtime.disabled, true);
    const result = await runtime.provider.generateProjection({
      caseId: "c",
      sourceImageId: "i",
      sourceImageRef: "r",
      approvedGraftPlanId: "p",
      approvedGraftPlan: approvedPlan(),
      approvedAnnotations: [],
      mode: "planned",
      generationVersion: "v",
      engineVersion: "v",
      patientSafeProjectionConstraints: [],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, "provider_disabled");
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2C ImagingOS signing + HTTP adapter", () => {
  it("signs requests and verifies callbacks", () => {
    const secret = "test-signing-secret";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ ok: true });
    const signature = signImagingOsRequest({
      method: "POST",
      path: "/v1/pre-surgery/projections",
      body,
      timestamp,
      idempotencyKey: "idem-1",
      secret,
    });
    assert.equal(typeof signature, "string");
    assert.ok(signature.length > 20);

    const cbBody = JSON.stringify({ caseId: "c", projectionId: "p", providerResponseId: "r1" });
    const cbSig = createHmac("sha256", secret)
      .update(`${timestamp}.${cbBody}`, "utf8")
      .digest("hex");
    const verified = verifyImagingOsCallbackSignature({
      body: cbBody,
      timestamp,
      signature: cbSig,
      secret,
    });
    assert.equal(verified.ok, true);
    const bad = verifyImagingOsCallbackSignature({
      body: cbBody,
      timestamp,
      signature: "deadbeef",
      secret,
    });
    assert.equal(bad.ok, false);
  });

  it("retries transient failures and honours idempotency + timeout", async () => {
    let calls = 0;
    const provider = createImagingOsPreSurgeryProjectionProvider({
      config: {
        kind: "imagingos",
        providerId: "imagingos-v1",
        modelVersion: "imagingos-projection-v1",
        endpoint: "https://imagingos.example/api/",
        authTokenConfigured: true,
        signingSecretConfigured: true,
        connectTimeoutMs: 1000,
        generationTimeoutMs: 5000,
        maxRetries: 2,
        allowStubFallback: false,
        callbackReplayTtlSeconds: 600,
      },
      authToken: "tok",
      signingSecret: "sec",
      sleep: async () => undefined,
      fetchImpl: async (_url, init) => {
        calls += 1;
        const idem = (init?.headers as Record<string, string>)?.["Idempotency-Key"];
        assert.ok(idem);
        if (calls < 3) {
          return new Response(JSON.stringify({ message: "busy" }), { status: 503 });
        }
        return new Response(
          JSON.stringify({
            ok: true,
            outputStorageRef: "pre_surgery_projections/c/planned/out.bin",
            outputChecksum: "abc123",
            request_id: "req-1",
            response_id: "res-1",
            modelVersion: "imagingos-projection-v1",
          }),
          { status: 200 }
        );
      },
    });

    const result = await provider.generateProjection({
      caseId: "c",
      sourceImageId: "img-1",
      sourceImageRef: "storage:x",
      approvedGraftPlanId: "p2",
      approvedGraftPlan: approvedPlan(),
      approvedAnnotations: [hairlineAnn()],
      mode: "planned",
      generationVersion: "v",
      engineVersion: "v",
      patientSafeProjectionConstraints: ["no guaranteed density"],
      idempotencyKey: "idem-fixed",
      inputChecksum: "checksum-1",
    });
    assert.equal(result.ok, true);
    assert.equal(calls, 3);
    if (result.ok) {
      assert.equal(result.providerRequestId, "req-1");
      assert.equal(result.providerResponseId, "res-1");
    }
  });

  it("rejects invalid provider responses", async () => {
    const provider = createImagingOsPreSurgeryProjectionProvider({
      config: {
        kind: "imagingos",
        providerId: "imagingos-v1",
        modelVersion: "m",
        endpoint: "https://imagingos.example/api/",
        authTokenConfigured: true,
        signingSecretConfigured: false,
        connectTimeoutMs: 1000,
        generationTimeoutMs: 2000,
        maxRetries: 0,
        allowStubFallback: false,
        callbackReplayTtlSeconds: 600,
      },
      authToken: "tok",
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    });
    const result = await provider.generateProjection({
      caseId: "c",
      sourceImageId: "img-1",
      sourceImageRef: "storage:x",
      approvedGraftPlanId: "p2",
      approvedGraftPlan: approvedPlan(),
      approvedAnnotations: [],
      mode: "planned",
      generationVersion: "v",
      engineVersion: "v",
      patientSafeProjectionConstraints: [],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, "provider_response_invalid");
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2C callbacks + replay", () => {
  it("enforces case match and replay protection", async () => {
    assert.equal(
      assertCallbackTargetsCase({ callbackCaseId: "a", projectionCaseId: "b" }).ok,
      false
    );
    assert.equal(
      assertCallbackTargetsCase({ callbackCaseId: "a", projectionCaseId: "a" }).ok,
      true
    );
    const store = createMemoryCallbackReplayStore();
    const first = await assertCallbackNotReplayed({
      store,
      providerResponseId: "r1",
      timestamp: "1",
      caseId: "c",
      ttlSeconds: 60,
    });
    assert.equal(first.ok, true);
    const second = await assertCallbackNotReplayed({
      store,
      providerResponseId: "r1",
      timestamp: "1",
      caseId: "c",
      ttlSeconds: 60,
    });
    assert.equal(second.ok, false);
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2C canonical input + modes", () => {
  it("freezes immutable input snapshot checksum", () => {
    const plan = approvedPlan();
    const review = confirmedReview();
    const snap = buildCanonicalProjectionRequest({
      caseId: "c",
      plan,
      mode: "planned",
      sourceReviews: [review],
      primarySourceImageId: review.imageId,
      sourceImageRefs: [{ imageId: review.imageId, storageRef: "storage:x" }],
      approvedAnnotations: [hairlineAnn()],
      approvedObservations: [],
      providerId: "stub-v1",
      modelVersion: "stub-v1",
    });
    const a = checksumCanonicalProjectionRequest(snap);
    const b = checksumCanonicalProjectionRequest(snap);
    assert.equal(a, b);
    assert.equal(snap.approvedGraftPlanId, plan.id);
    assert.ok(snap.geometry.hairlineAnnotationIds.length >= 1);
  });

  it("fails mode contract rather than silently reducing", () => {
    const plan = approvedPlan();
    const issues = validateProjectionModeContract({
      mode: "planned",
      plan,
      availableRoles: ["donor_occipital"],
    });
    assert.ok(issues.some((i) => i.code === "mode_required_source_missing"));
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2C state machine + approval", () => {
  it("blocks illegal transitions and generated→patient direct jump", () => {
    assert.equal(assertProjectionStatusTransition("generated", "approved").ok, false);
    assert.equal(assertProjectionStatusTransition("generated", "clinician_review").ok, true);
    assert.equal(assertProjectionStatusTransition("clinician_review", "approved").ok, true);
    assert.equal(assertProjectionStatusTransition("failed", "approved").ok, false);
  });

  it("requires full approval checklist", () => {
    const projection = {
      id: "proj",
      caseId: "c",
      graftPlanId: "p1",
      graftPlanVersion: 1,
      sourceImageId: "img",
      mode: "planned" as const,
      patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned,
      patientSafeDisclaimer: "Illustrative planned projection based on the current clinical plan.",
      status: "clinician_review" as const,
      engineVersion: "ha-pre-surgery-projection-v2",
      generationVersion: "ha-pre-surgery-projection-v2",
      safetyLabelVersion: "ha-pre-surgery-projection-safety-label-v1",
      deterministicSeed: null,
      storagePath: "path",
      validationPass: [],
      limitations: [],
      planningAssumptions: [],
      requestedBy: "c",
      requestedAt: "2026-07-30T00:00:00.000Z",
      generatedAt: "2026-07-30T00:00:00.000Z",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      inputChecksum: "a",
      outputChecksum: "b",
    };
    const incomplete = approveIllustrativeProjectionWithChecklist({
      projection,
      actor: { clinicianId: "c", role: "auditor", organisationId: null },
      checklist: emptyApprovalChecklist(),
    });
    assert.equal(incomplete.ok, false);
    if (!incomplete.ok) assert.equal(incomplete.code, "checklist_incomplete");

    const checklist = emptyApprovalChecklist();
    for (const k of APPROVAL_CHECKLIST_KEYS) checklist[k] = true;
    const ok = approveIllustrativeProjectionWithChecklist({
      projection,
      actor: { clinicianId: "c", role: "auditor", organisationId: null },
      checklist,
      approvalNote: "Looks suitable",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.projection.status, "approved");
      assert.equal(ok.projection.patientSharingEnabled, true);
      assert.equal(ok.projection.approvalNote, "Looks suitable");
    }
  });

  it("rejects with structured reasons and regenerates as new attempt", () => {
    const projection = {
      id: "proj-1",
      caseId: "c",
      graftPlanId: "p1",
      graftPlanVersion: 1,
      sourceImageId: "img",
      mode: "planned" as const,
      patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned,
      status: "clinician_review" as const,
      engineVersion: "v",
      generationVersion: "v",
      deterministicSeed: null,
      storagePath: "path",
      validationPass: [],
      limitations: [],
      planningAssumptions: [],
      requestedBy: "c",
      requestedAt: "2026-07-30T00:00:00.000Z",
      generatedAt: "2026-07-30T00:00:00.000Z",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      inputChecksum: "a",
      outputChecksum: "b",
      projectionVersion: 1,
    };
    const rejected = rejectIllustrativeProjection(
      projection,
      "c",
      "Hairline too aggressive",
      undefined,
      "incorrect_hairline"
    );
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectionReasonCode, "incorrect_hairline");
    const seed = buildRegenerationSeed(rejected);
    assert.equal(seed.regeneratesFromProjectionId, "proj-1");
    assert.equal(seed.projectionVersion, 2);
  });

  it("supersedes previous approved without deleting", () => {
    const approved = {
      id: "old",
      caseId: "c",
      graftPlanId: "p1",
      graftPlanVersion: 1,
      sourceImageId: "img",
      mode: "planned" as const,
      patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned,
      status: "approved" as const,
      engineVersion: "v",
      generationVersion: "v",
      deterministicSeed: null,
      storagePath: "path",
      validationPass: [],
      limitations: [],
      planningAssumptions: [],
      requestedBy: "c",
      requestedAt: "2026-07-30T00:00:00.000Z",
      generatedAt: "2026-07-30T00:00:00.000Z",
      approvedBy: "c",
      approvedAt: "2026-07-30T01:00:00.000Z",
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      inputChecksum: "a",
      outputChecksum: "b",
      patientSharingEnabled: true,
    };
    const superseded = supersedeApprovedProjection(approved, "2026-07-30T02:00:00.000Z");
    assert.equal(superseded.status, "superseded");
    assert.equal(superseded.patientSharingEnabled, false);
    assert.equal(superseded.id, "old");
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2C patient visibility + wording", () => {
  it("denies before approval and after revoke/supersede", () => {
    const plan = approvedPlan("plan-1");
    const base = {
      id: "proj",
      caseId: "c",
      graftPlanId: plan.id,
      graftPlanVersion: plan.version,
      sourceImageId: "img",
      mode: "planned" as const,
      patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned,
      patientSafeDisclaimer: PATIENT_PROJECTION_FRAMING[0],
      status: "clinician_review" as const,
      engineVersion: "v",
      generationVersion: "v",
      safetyLabelVersion: "ha-pre-surgery-projection-safety-label-v1",
      deterministicSeed: null,
      storagePath: "path",
      validationPass: [],
      limitations: [],
      planningAssumptions: [],
      requestedBy: "c",
      requestedAt: "2026-07-30T00:00:00.000Z",
      generatedAt: "2026-07-30T00:00:00.000Z",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      inputChecksum: "a",
      outputChecksum: "b",
      patientSharingEnabled: false,
      projectionVersion: 1,
    };
    assert.equal(
      evaluatePatientProjectionVisibility({
        projection: base,
        currentApprovedPlan: plan,
      }).visible,
      false
    );

    const approved = {
      ...base,
      status: "approved" as const,
      approvedBy: "c",
      approvedAt: "2026-07-30T01:00:00.000Z",
      patientSharingEnabled: true,
      patientSafeDisclaimer:
        "Illustrative planned projection based on the current clinical plan. Not a guarantee of density, growth, survival, or final appearance.",
    };
    const visible = evaluatePatientProjectionVisibility({
      projection: approved,
      currentApprovedPlan: plan,
    });
    assert.equal(visible.visible, true);

    const revoked = evaluatePatientProjectionVisibility({
      projection: { ...approved, patientSharingEnabled: false },
      currentApprovedPlan: plan,
    });
    assert.equal(revoked.visible, false);

    const superseded = evaluatePatientProjectionVisibility({
      projection: { ...approved, status: "superseded" },
      currentApprovedPlan: plan,
    });
    assert.equal(superseded.visible, false);

    assert.ok(findUnsafePatientClaimLanguage("predicted result"));
    assert.ok(findUnsafePatientClaimLanguage("expected result"));
    assert.equal(findUnsafePatientClaimLanguage("Illustrative planned projection"), null);
  });

  it("marks projection stale when graft plan changes", () => {
    const plan = approvedPlan("plan-1");
    const newer = { ...plan, id: "plan-2", version: plan.version + 1 };
    const approved = {
      id: "proj",
      caseId: "c",
      graftPlanId: plan.id,
      graftPlanVersion: plan.version,
      sourceImageId: "img",
      mode: "planned" as const,
      patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned,
      patientSafeDisclaimer: "Illustrative planned projection based on the current clinical plan.",
      status: "approved" as const,
      engineVersion: "v",
      generationVersion: "v",
      safetyLabelVersion: "ha-pre-surgery-projection-safety-label-v1",
      deterministicSeed: null,
      storagePath: "path",
      validationPass: [],
      limitations: [],
      planningAssumptions: [],
      requestedBy: "c",
      requestedAt: "2026-07-30T00:00:00.000Z",
      generatedAt: "2026-07-30T00:00:00.000Z",
      approvedBy: "c",
      approvedAt: "2026-07-30T01:00:00.000Z",
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      inputChecksum: "a",
      outputChecksum: "b",
      patientSharingEnabled: true,
      projectionVersion: 1,
    };
    const decision = evaluatePatientProjectionVisibility({
      projection: approved,
      currentApprovedPlan: newer,
    });
    assert.equal(decision.visible, false);
    if (!decision.visible) assert.equal(decision.reason, "plan_invalid");
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2C generation + report provenance", () => {
  it("runs stub generation into clinician_review with provenance", async () => {
    const plan = approvedPlan();
    const result = await requestPreSurgeryProjection({
      caseId: "c",
      plan,
      sourceReview: confirmedReview(),
      sourceImageRef: "storage:x",
      approvedAnnotations: [hairlineAnn()],
      mode: "planned",
      requiredImagesPresent: true,
      proposedHairlineConfirmed: true,
      treatmentAreaConfirmed: true,
      requestedBy: "c",
      provider: createStubPreSurgeryProjectionProvider(),
      providerId: "stub-v1",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.projection.status, "clinician_review");
      assert.ok(result.projection.inputChecksum);
      assert.ok(result.projection.inputSnapshot);
      assert.equal(result.projection.patientSharingEnabled, false);
    }
  });

  it("pins report to exact approved projection version", () => {
    const plan = approvedPlan("plan-approved");
    const older = {
      id: "proj-old",
      caseId: plan.caseId,
      graftPlanId: plan.id,
      graftPlanVersion: plan.version,
      sourceImageId: "img-1",
      mode: "planned" as const,
      artifactType: "illustrative_projected_outcome" as const,
      patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned,
      status: "approved" as const,
      engineVersion: "v",
      generationVersion: "v",
      deterministicSeed: null,
      storagePath: "pre_surgery_projections/c/planned/old.jpg",
      validationPass: [],
      limitations: [],
      planningAssumptions: [],
      requestedBy: "c",
      requestedAt: "2026-07-30T01:00:00.000Z",
      generatedAt: "2026-07-30T01:00:00.000Z",
      approvedBy: "c",
      approvedAt: "2026-07-30T01:30:00.000Z",
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      inputChecksum: "old-checksum",
      outputChecksum: "out",
      providerId: "imagingos-v1",
      patientSharingEnabled: true,
      projectionVersion: 1,
    };
    const newer = { ...older, id: "proj-new", projectionVersion: 2, inputChecksum: "new-checksum" };
    const pinned = buildClinicianReportSlice({
      observations: [],
      graftPlans: [plan],
      projections: [older, newer],
      pinnedProjectionId: "proj-old",
      now: "2026-07-30T03:00:00.000Z",
    });
    assert.deepEqual(pinned.provenance?.approvedProjectionIds, ["proj-old"]);
    assert.equal(pinned.provenance?.pinnedProjectionId, "proj-old");
    assert.equal(pinned.provenance?.pinnedProjectionVersion, 1);
    assert.equal(pinned.provenance?.pinnedProjectionInputChecksum, "old-checksum");
  });

  it("keeps stub provider healthy when explicitly selected and records metrics", async () => {
    const runtime = resolveRuntimeProjectionProvider({
      HA_PRE_SURGERY_PROJECTION_PROVIDER: "stub",
    });
    assert.equal(runtime.providerId, "stub-v1");
    const health = await checkProjectionProviderHealth(runtime.provider, runtime.providerId);
    assert.equal(health.healthy, true);
    const summary = summariseProjectionMetrics([
      { at: "t", providerId: "stub-v1", ok: true, latencyMs: 10 },
      { at: "t", providerId: "stub-v1", ok: false, latencyMs: 100, timedOut: true, errorCode: "provider_timeout" },
      { at: "t", providerId: "stub-v1", ok: true, latencyMs: 20, approved: true, patientShared: true, approvalTurnaroundMs: 5000 },
    ]);
    assert.equal(summary.sampleCount, 3);
    assert.ok(summary.timeoutRate > 0);
    assert.ok(summary.medianLatencyMs != null);
  });
});
