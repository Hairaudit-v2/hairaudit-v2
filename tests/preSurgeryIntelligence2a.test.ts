/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Domain unit tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyImageReviewCorrection,
  applyObservationReview,
  assertProjectionGenerationAllowed,
  buildImageReviewFromUpload,
  buildPlanComparisonView,
  canGenerateProjectionFromPlan,
  compareGraftPlans,
  computeGraftPlanTotals,
  createAnnotation,
  createClinicianPlanRevision,
  deriveProjectionModeAllocation,
  ARTIFACT_TYPE_LABELS,
  createStubPreSurgeryProjectionProvider,
  findUnsafeProjectionLabel,
  PRE_SURGERY_PROJECTION_PATIENT_LABELS,
  pushAnnotationHistory,
  redoAnnotations,
  requestPreSurgeryProjection,
  resolveImageRoleFromUploadKey,
  seedAiGraftPlan,
  seedPendingObservations,
  softDeleteAnnotation,
  undoAnnotations,
  validateGraftPlan,
  validateAnnotationCoordinates,
} from "@/lib/preSurgeryIntelligence";

describe("HA-PRE-SURGERY-INTELLIGENCE-2A image roles", () => {
  it("maps canonical upload keys to clinician roles", () => {
    assert.equal(resolveImageRoleFromUploadKey("patient_photo:preop_front"), "frontal");
    assert.equal(resolveImageRoleFromUploadKey("preop_donor"), "donor_occipital");
    assert.equal(resolveImageRoleFromUploadKey("preop_crown"), "crown");
  });

  it("preserves original AI role when clinician corrects", () => {
    const review = buildImageReviewFromUpload("case-1", {
      id: "img-1",
      type: "patient_photo:preop_front",
      metadata: { ai_classification_confidence: 0.82, ai_classification_warnings: ["blur"] },
    });
    assert.equal(review.originalAiRole, "frontal");
    assert.equal(review.assignedRole, "frontal");
    const { review: next, corrections } = applyImageReviewCorrection(
      review,
      { assignedRole: "top", reason: "Wrong angle" },
      "clinician-1",
      { now: "2026-07-30T00:00:00.000Z" }
    );
    assert.equal(next.originalAiRole, "frontal");
    assert.equal(next.assignedRole, "top");
    assert.equal(corrections.length, 1);
    assert.equal(corrections[0]!.originalAiValue, "frontal");
    assert.equal(corrections[0]!.field, "assignedRole");
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2A annotations", () => {
  it("requires normalised coordinates", () => {
    assert.equal(validateAnnotationCoordinates("point", [{ x: 0.5, y: 0.5 }]), null);
    assert.match(String(validateAnnotationCoordinates("point", [{ x: 1.2, y: 0 }])), /normalised/);
    assert.match(String(validateAnnotationCoordinates("polygon", [{ x: 0, y: 0 }])), /three/);
  });

  it("supports undo/redo and soft delete", () => {
    const a = createAnnotation({
      caseId: "c",
      imageId: "i",
      annotationType: "proposed_hairline",
      geometryType: "polyline",
      coordinates: [
        { x: 0.2, y: 0.3 },
        { x: 0.8, y: 0.3 },
      ],
      createdBy: "u1",
    });
    let stack = { past: [] as never[], present: [a], future: [] as never[] };
    const deleted = softDeleteAnnotation(a, "2026-07-30T00:00:00.000Z");
    stack = pushAnnotationHistory(stack, [deleted]);
    stack = undoAnnotations(stack);
    assert.equal(stack.present[0]!.deletedAt, null);
    stack = redoAnnotations(stack);
    assert.ok(stack.present[0]!.deletedAt);
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2A observations", () => {
  it("seeds pending domains and marks corrections", () => {
    const list = seedPendingObservations({ caseId: "c", aiProposals: { crown_involvement: { value: "Early", confidence: 0.7 } } });
    assert.ok(list.length >= 10);
    const crown = list.find((o) => o.domain === "crown_involvement")!;
    const next = applyObservationReview(
      crown,
      { status: "confirmed", clinicianApprovedValue: "Moderate" },
      "clinician-1"
    );
    assert.equal(next.status, "corrected");
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2A graft plan", () => {
  it("recalculates totals and excludes deferred zones", () => {
    const plan = seedAiGraftPlan({
      caseId: "c",
      createdBy: "system",
      norwood: "III",
      crown: "advanced",
      id: "plan-1",
      now: "2026-07-30T00:00:00.000Z",
    });
    const totals = computeGraftPlanTotals(plan.zones);
    assert.equal(plan.totalTargetGrafts, totals.totalTargetGrafts);
    assert.ok(plan.deferredZones.includes("crown"));
    const crown = plan.zones.find((z) => z.zone === "crown")!;
    assert.equal(crown.targetGrafts, 0);
  });

  it("validates min/target/max and approval requirements", () => {
    const plan = seedAiGraftPlan({ caseId: "c", createdBy: "system", norwood: "III", evidenceImageIds: [] });
    const bad = {
      ...plan,
      zones: plan.zones.map((z) =>
        z.zone === "hairline" ? { ...z, minimumGrafts: 900, targetGrafts: 500, maximumGrafts: 400 } : z
      ),
    };
    const totals = computeGraftPlanTotals(bad.zones);
    const issues = validateGraftPlan({ ...bad, ...totals }, { requireApprovalFields: true });
    assert.ok(issues.some((i) => i.code === "min_exceeds_target"));
    assert.ok(issues.some((i) => i.code === "approval_requires_evidence"));
  });

  it("blocks projection from unapproved plans", () => {
    const plan = seedAiGraftPlan({ caseId: "c", createdBy: "system", norwood: "II" });
    assert.equal(canGenerateProjectionFromPlan(plan), false);
    const approved = createClinicianPlanRevision(
      plan,
      { status: "approved", approvedBy: "c1", approvedAt: "2026-07-30T00:00:00.000Z" },
      "c1"
    );
    assert.equal(canGenerateProjectionFromPlan(approved), true);
  });

  it("compares plan versions", () => {
    const ai = seedAiGraftPlan({ caseId: "c", createdBy: "system", norwood: "III", id: "v1" });
    const edited = createClinicianPlanRevision(
      ai,
      {
        zones: ai.zones.map((z) =>
          z.zone === "hairline" ? { ...z, targetGrafts: z.targetGrafts + 200, maximumGrafts: z.maximumGrafts + 200 } : z
        ),
        clinicianNote: "Increase hairline for temple recession",
      },
      "c1",
      { id: "v2" }
    );
    const diff = compareGraftPlans(ai, edited);
    assert.ok(diff.totalTargetDelta > 0);
    assert.ok(diff.graftIncreases.some((g) => g.zone === "hairline"));
    const view = buildPlanComparisonView([ai, edited]);
    assert.equal(view.aiStartingPlan?.id, "v1");
    assert.equal(view.currentClinicianVersion?.id, "v2");
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2A projection modes & safety", () => {
  it("uses patient-safe illustrative labels only", () => {
    assert.equal(PRE_SURGERY_PROJECTION_PATIENT_LABELS.conservative, "Conservative planning view");
    assert.equal(PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned, "Planned clinical view");
    assert.equal(
      PRE_SURGERY_PROJECTION_PATIENT_LABELS.optimistic_within_approved_range,
      "Optimistic planning view"
    );
    assert.ok(findUnsafeProjectionLabel("guaranteed final result"));
    assert.ok(findUnsafeProjectionLabel("guaranteed density"));
    assert.equal(findUnsafeProjectionLabel("Planned clinical view"), null);
  });

  it("derives modes from approved graft range", () => {
    const plan = seedAiGraftPlan({ caseId: "c", createdBy: "system", norwood: "III", crown: "early" });
    const cons = deriveProjectionModeAllocation(plan, "conservative");
    const opt = deriveProjectionModeAllocation(plan, "optimistic_within_approved_range");
    assert.ok(cons.totalGrafts <= plan.totalTargetGrafts);
    assert.ok(opt.totalGrafts >= plan.totalTargetGrafts);
    assert.equal(cons.patientSafeLabel, "Conservative planning view");
  });

  it("gates generation until plan approved and clinician requests", async () => {
    const draft = seedAiGraftPlan({
      caseId: "c",
      createdBy: "system",
      norwood: "III",
      evidenceImageIds: ["img-1"],
      id: "p1",
    });
    const gates = assertProjectionGenerationAllowed({
      plan: draft,
      sourceImageRole: "frontal",
      sourceImageReviewStatus: "confirmed",
      sourceImageQualityFlags: [],
      requiredImagesPresent: true,
      proposedHairlineConfirmed: true,
      treatmentAreaConfirmed: true,
      clinicianExplicitlyRequested: true,
      approvedAnnotations: [],
    });
    assert.ok(gates.some((g) => g.code === "plan_not_approved"));

    const approved = createClinicianPlanRevision(
      draft,
      {
        status: "approved",
        approvedBy: "c1",
        approvedAt: "2026-07-30T00:00:00.000Z",
        zones: draft.zones.map((z) => ({ ...z, evidenceImageIds: ["img-1"] })),
      },
      "c1",
      { id: "p2" }
    );

    const review = buildImageReviewFromUpload("c", {
      id: "img-1",
      type: "patient_photo:preop_front",
    });
    review.reviewStatus = "confirmed";

    const result = await requestPreSurgeryProjection({
      caseId: "c",
      plan: approved,
      sourceReview: review,
      sourceImageRef: "storage:cases/c/patient/front.jpg",
      approvedAnnotations: [
        createAnnotation({
          caseId: "c",
          imageId: "img-1",
          annotationType: "proposed_hairline",
          geometryType: "polyline",
          coordinates: [
            { x: 0.2, y: 0.3 },
            { x: 0.8, y: 0.3 },
          ],
          createdBy: "c1",
          approved: true,
        }),
      ],
      mode: "planned",
      requiredImagesPresent: true,
      proposedHairlineConfirmed: true,
      treatmentAreaConfirmed: true,
      requestedBy: "c1",
      deterministicSeed: "seed-1",
      id: "proj-1",
      now: "2026-07-30T00:00:00.000Z",
      // Domain unit test: stub avoids local-illustrative storage binding.
      provider: createStubPreSurgeryProjectionProvider(),
      providerId: "stub-v1",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(
        result.projection.patientSafeLabel,
        `${ARTIFACT_TYPE_LABELS.graft_allocation_map} · ${PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned}`
      );
      assert.equal(result.projection.status, "clinician_review");
      assert.ok(result.projection.outputChecksum);
    }
  });
});
