/**
 * HA-PRE-SURGERY-INTELLIGENCE-2B — Production readiness unit tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  approveIllustrativeProjection,
  assertGraftPlanPayloadImmutable,
  buildClinicianReportSlice,
  buildImageReviewFromUpload,
  checkProjectionProviderHealth,
  createAnnotation,
  createClinicianPlanRevision,
  decidePreSurgeryClinicianAccess,
  findUnsafeProjectionLabel,
  getDefaultPreSurgeryProjectionProvider,
  PRE_SURGERY_PROJECTION_PATIENT_LABELS,
  rejectIllustrativeProjection,
  requestPreSurgeryProjection,
  resolveGraftPlanBaseForEdit,
  restoreAnnotation,
  seedAiGraftPlan,
  softDeleteAnnotation,
} from "@/lib/preSurgeryIntelligence";
import { generatePreSurgeryPlanningReport } from "@/lib/reports/preSurgeryPlanningReport";

describe("HA-PRE-SURGERY-INTELLIGENCE-2B access matrix", () => {
  const base = {
    caseUserId: "patient-1",
    casePatientId: "patient-1",
    caseDoctorId: "doctor-1",
    caseClinicId: "clinic-1",
  };

  it("allows auditor, assigned doctor, assigned clinic", () => {
    assert.equal(
      decidePreSurgeryClinicianAccess({ ...base, userId: "aud-1", isAuditor: true }).allowed,
      true
    );
    assert.deepEqual(
      decidePreSurgeryClinicianAccess({ ...base, userId: "doctor-1", isAuditor: false }),
      { allowed: true, role: "assigned_doctor" }
    );
    assert.deepEqual(
      decidePreSurgeryClinicianAccess({ ...base, userId: "clinic-1", isAuditor: false }),
      { allowed: true, role: "assigned_clinic" }
    );
  });

  it("denies patient owner and unrelated professional", () => {
    assert.deepEqual(
      decidePreSurgeryClinicianAccess({ ...base, userId: "patient-1", isAuditor: false }),
      { allowed: false, reason: "patient_owner" }
    );
    assert.deepEqual(
      decidePreSurgeryClinicianAccess({ ...base, userId: "other-doc", isAuditor: false }),
      { allowed: false, reason: "unrelated_professional" }
    );
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2B concurrency", () => {
  it("blocks silent overwrite on stale base version", () => {
    const v1 = seedAiGraftPlan({ caseId: "c", createdBy: "a", norwood: "III", id: "p1" });
    const v2 = createClinicianPlanRevision(v1, { clinicianNote: "first edit" }, "a", { id: "p2" });
    const conflict = resolveGraftPlanBaseForEdit({
      plans: [
        { ...v1, status: "superseded" },
        { ...v2, status: "clinician_reviewed" },
      ],
      basePlanId: "p1",
      expectedBaseVersion: 1,
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) {
      assert.equal(conflict.conflict.code, "version_conflict");
      assert.equal(conflict.conflict.currentHeadVersion, 2);
    }
  });

  it("allows explicit force rebase from head", () => {
    const v1 = seedAiGraftPlan({ caseId: "c", createdBy: "a", norwood: "III", id: "p1" });
    const v2 = createClinicianPlanRevision(v1, { clinicianNote: "first edit" }, "a", { id: "p2" });
    const resolved = resolveGraftPlanBaseForEdit({
      plans: [
        { ...v1, status: "superseded" },
        { ...v2, status: "clinician_reviewed" },
      ],
      basePlanId: "p1",
      expectedBaseVersion: 1,
      forceRebaseFromHead: true,
    });
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.equal(resolved.base.id, "p2");
  });

  it("rejects in-place mutation of historical plan payloads", () => {
    const plan = seedAiGraftPlan({ caseId: "c", createdBy: "a", norwood: "II", id: "p1" });
    const err = assertGraftPlanPayloadImmutable(plan, {
      totalTargetGrafts: plan.totalTargetGrafts + 50,
    });
    assert.ok(err);
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2B annotations restore", () => {
  it("soft-deletes and restores without destroying history", () => {
    const a = createAnnotation({
      caseId: "c",
      imageId: "i",
      annotationType: "proposed_hairline",
      geometryType: "polyline",
      coordinates: [
        { x: 0.2, y: 0.3 },
        { x: 0.8, y: 0.3 },
      ],
      createdBy: "u",
      id: "ann-1",
    });
    const deleted = softDeleteAnnotation(a, "2026-07-30T01:00:00.000Z");
    assert.ok(deleted.deletedAt);
    const restored = restoreAnnotation(deleted);
    assert.equal(restored.deletedAt, null);
    assert.equal(restored.id, "ann-1");
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2B report integration", () => {
  it("embeds only approved observations/plan and freezes provenance", () => {
    const plan = seedAiGraftPlan({
      caseId: "00000000-0000-4000-8000-000000000088",
      createdBy: "clin",
      norwood: "III",
      evidenceImageIds: ["img-1"],
      id: "plan-approved",
    });
    const approved = createClinicianPlanRevision(
      plan,
      {
        status: "approved",
        approvedBy: "clin",
        approvedAt: "2026-07-30T02:00:00.000Z",
        zones: plan.zones.map((z) => ({ ...z, evidenceImageIds: ["img-1"] })),
        clinicianNote: "INTERNAL DRAFT — must not appear in patient report",
      },
      "clin",
      { id: "plan-v2" }
    );

    const slice = buildClinicianReportSlice({
      observations: [
        {
          id: "o1",
          caseId: plan.caseId,
          domain: "crown_involvement",
          schemaVersion: "ha-pre-surgery-observation-v1",
          aiProposedValue: "Early",
          aiConfidence: 0.6,
          evidenceImageIds: ["img-1"],
          clinicianApprovedValue: "Moderate",
          note: "draft clinician note — exclude",
          status: "corrected",
          reviewedBy: "clin",
          reviewedAt: "2026-07-30T02:00:00.000Z",
          createdAt: "2026-07-30T01:00:00.000Z",
          updatedAt: "2026-07-30T02:00:00.000Z",
        },
        {
          id: "o2",
          caseId: plan.caseId,
          domain: "donor_calibre_appearance",
          schemaVersion: "ha-pre-surgery-observation-v1",
          aiProposedValue: "Fine",
          aiConfidence: 0.5,
          evidenceImageIds: [],
          clinicianApprovedValue: "Fine",
          note: null,
          status: "pending_review",
          reviewedBy: null,
          reviewedAt: null,
          createdAt: "2026-07-30T01:00:00.000Z",
          updatedAt: "2026-07-30T01:00:00.000Z",
        },
      ],
      graftPlans: [plan, approved],
      projections: [
        {
          id: "proj-1",
          caseId: plan.caseId,
          graftPlanId: approved.id,
          graftPlanVersion: approved.version,
          sourceImageId: "img-1",
          mode: "planned",
          patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned,
          status: "generated",
          engineVersion: "ha-pre-surgery-projection-v1",
          generationVersion: "ha-pre-surgery-projection-v1",
          deterministicSeed: null,
          storagePath: "secret/path",
          validationPass: [],
          limitations: [],
          planningAssumptions: [],
          requestedBy: "clin",
          requestedAt: "2026-07-30T02:00:00.000Z",
          generatedAt: "2026-07-30T02:00:00.000Z",
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          inputChecksum: "abc",
          outputChecksum: "def",
        },
      ],
      now: "2026-07-30T03:00:00.000Z",
    });

    assert.equal(slice.observations.length, 1);
    assert.equal(slice.observations[0]!.domain, "crown_involvement");
    assert.ok(slice.graftPlan);
    assert.equal(slice.graftPlan!.graftPlanVersion, approved.version);
    assert.equal(slice.patientSafeProjectionLabels.length, 0);
    assert.equal(slice.provenance?.approvedGraftPlanId, approved.id);

    const report = generatePreSurgeryPlanningReport({
      caseId: plan.caseId,
      summary: { forensic_audit: { overall_score: 70, key_findings: [], photo_observations: [] } },
      clinicianReportSlice: slice,
    });
    assert.equal(report.clinicianPlanProvenance?.approvedGraftPlanVersion, approved.version);
    assert.equal(report.clinicianApprovedObservations?.length, 1);
    assert.equal(report.clinicianApprovedProjectionLabels?.length, 0);
    const blob = JSON.stringify(report);
    assert.doesNotMatch(blob, /INTERNAL DRAFT/);
    assert.doesNotMatch(blob, /secret\/path/);
    assert.doesNotMatch(blob, /guaranteed/i);
  });
});

describe("HA-PRE-SURGERY-INTELLIGENCE-2B projection readiness", () => {
  it("uses stub as production-safe default and passes healthcheck", async () => {
    const { providerId, provider } = getDefaultPreSurgeryProjectionProvider();
    assert.equal(providerId, "stub-v1");
    const health = await checkProjectionProviderHealth(provider, providerId);
    assert.equal(health.healthy, true);
  });

  it("degrades safely on provider timeout", async () => {
    const hanging = {
      async generateProjection() {
        await new Promise(() => undefined);
        return {
          ok: true as const,
          outputStorageRef: "x",
          outputChecksum: "y",
          limitations: [],
          planningAssumptions: [],
          mode: "planned" as const,
        };
      },
    };
    const plan = seedAiGraftPlan({
      caseId: "c",
      createdBy: "c",
      norwood: "III",
      evidenceImageIds: ["img-1"],
      id: "p1",
    });
    const approved = createClinicianPlanRevision(
      plan,
      {
        status: "approved",
        approvedBy: "c",
        approvedAt: "2026-07-30T00:00:00.000Z",
        zones: plan.zones.map((z) => ({ ...z, evidenceImageIds: ["img-1"] })),
      },
      "c",
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
      sourceImageRef: "storage:x",
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
          createdBy: "c",
          approved: true,
        }),
      ],
      mode: "planned",
      requiredImagesPresent: true,
      proposedHairlineConfirmed: true,
      treatmentAreaConfirmed: true,
      requestedBy: "c",
      provider: hanging,
      providerId: "hang",
      timeoutMs: 50,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.degradable, true);
      assert.ok(result.errors.some((e) => e.code === "provider_timeout"));
    }
  });

  it("requires clinician approval before patient-visible status", () => {
    const generated = {
      id: "proj",
      caseId: "c",
      graftPlanId: "p1",
      graftPlanVersion: 1,
      sourceImageId: "img",
      mode: "planned" as const,
      patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned,
      status: "generated" as const,
      engineVersion: "ha-pre-surgery-projection-v1",
      generationVersion: "ha-pre-surgery-projection-v1",
      deterministicSeed: null,
      storagePath: "path",
      validationPass: [],
      limitations: ["Illustrative planning aid — not a guaranteed outcome."],
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
    const approved = approveIllustrativeProjection(generated, "c");
    assert.ok(!("error" in approved));
    if (!("error" in approved)) assert.equal(approved.status, "approved");
    const rejected = rejectIllustrativeProjection(generated, "c", "blur");
    assert.equal(rejected.status, "rejected");
    assert.equal(findUnsafeProjectionLabel("Illustrative planned projection"), null);
  });
});
