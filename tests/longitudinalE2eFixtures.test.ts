/**
 * FI-OUTCOME-INTELLIGENCE-1F — Fixture builder unit / integration tests.
 * Run: pnpm test:outcome-e2e-1f
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertLongitudinalE2eFixturesAllowed,
  longitudinalE2eExternalCaseId,
  longitudinalE2eEmail,
  LONGITUDINAL_E2E_FIXTURE_PREFIX,
} from "./fixtures/longitudinalE2e/constants";
import { LONGITUDINAL_FIXTURE_MANIFEST } from "./fixtures/longitudinalE2e/manifest";
import {
  seedLongitudinalProjectionFixture,
  reseedLongitudinalProjectionFixture,
} from "./fixtures/longitudinalE2e/seedInMemory";
import { ensureSyntheticLongitudinalImages } from "./fixtures/longitudinalE2e/syntheticImages";
import { createLongitudinalEngagementService } from "@/lib/outcomeIntelligence/longitudinalEngagementService";
import { InMemoryEngagementAuditSink } from "@/lib/outcomeIntelligence/longitudinalEngagementService";
import { createProjectionSnapshotService } from "@/lib/projection/projectionSnapshotService";
import { fixtureA_baselinePlusSurgeryDay } from "./fixtures/surgeryDayProjection/fixtures";
import { createProjectionObservationService } from "@/lib/projection/projectionObservationService";
import { InMemoryProjectionObservationAuditSink } from "@/lib/projection/projectionObservationAudit";
import { createProjectionComparisonService } from "@/lib/projection/projectionComparisonService";
import { InMemoryProjectionComparisonAuditSink } from "@/lib/projection/projectionComparisonAudit";
import { buildLongitudinalOutcomeObservation } from "@/lib/projection/longitudinalOutcomeObservation";
import { buildLongitudinalProjectionReviewReport } from "@/lib/reports/longitudinalProjectionReview";
import { CAPTURE_PLAN_VERSION } from "@/lib/outcomeIntelligence/longitudinalCaptureTypes";
import { ENGAGEMENT_POLICY_VERSION } from "@/lib/outcomeIntelligence/longitudinalEngagementTypes";

describe("FI-OUTCOME-INTELLIGENCE-1F fixture namespace", () => {
  it("1. uses FI-OI-1F- prefix and synthetic emails", () => {
    assert.equal(LONGITUDINAL_E2E_FIXTURE_PREFIX, "FI-OI-1F-");
    assert.match(longitudinalE2eExternalCaseId("FRONTAL"), /^FI-OI-1F:/);
    assert.match(longitudinalE2eEmail("FRONTAL"), /@hairaudit\.test$/);
    assert.ok(LONGITUDINAL_FIXTURE_MANIFEST.length >= 9);
  });

  it("2. production guard blocks without enable flag", () => {
    const prev = process.env.FI_LONGITUDINAL_E2E_FIXTURES_ENABLED;
    delete process.env.FI_LONGITUDINAL_E2E_FIXTURES_ENABLED;
    assert.throws(() => assertLongitudinalE2eFixturesAllowed("development"));
    process.env.FI_LONGITUDINAL_E2E_FIXTURES_ENABLED = "true";
    assert.throws(() => assertLongitudinalE2eFixturesAllowed("production"));
    process.env.LONGITUDINAL_E2E_ALLOW_PRODUCTION = "true";
    assert.doesNotThrow(() => assertLongitudinalE2eFixturesAllowed("production"));
    delete process.env.LONGITUDINAL_E2E_ALLOW_PRODUCTION;
    if (prev === undefined) delete process.env.FI_LONGITUDINAL_E2E_FIXTURES_ENABLED;
    else process.env.FI_LONGITUDINAL_E2E_FIXTURES_ENABLED = prev;
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1F seedLongitudinalProjectionFixture", () => {
  it("3. seeds frontal fixture to due", async () => {
    const bundle = await seedLongitudinalProjectionFixture({
      fixtureKey: "FRONTAL",
      now: "2026-07-28T12:00:00.000Z",
    });
    const m6 = bundle.plan.milestones.find((m) => m.stage === "month_6");
    assert.ok(m6);
    assert.equal(m6!.status, "due");
    assert.ok(m6!.requiredEvidenceRoles.includes("followup_front"));
    assert.ok(!m6!.requiredEvidenceRoles.includes("followup_crown"));
    assert.equal(bundle.projection.caseId, bundle.caseId);
  });

  it("4. seeds crown fixture requiring crown", async () => {
    const bundle = await seedLongitudinalProjectionFixture({
      fixtureKey: "CROWN",
      now: "2026-07-28T12:00:00.000Z",
    });
    const m6 = bundle.plan.milestones.find((m) => m.stage === "month_6");
    assert.ok(m6);
    assert.ok(m6!.requiredEvidenceRoles.includes("followup_crown"));
    assert.equal(m6!.status, "evidence_incomplete");
  });

  it("5. seeds incomplete resume fixture missing recipient close-up", async () => {
    const bundle = await seedLongitudinalProjectionFixture({
      fixtureKey: "RESUME",
      now: "2026-07-28T12:00:00.000Z",
    });
    const m6 = bundle.plan.milestones.find((m) => m.stage === "month_6");
    assert.ok(m6);
    assert.equal(m6!.status, "evidence_incomplete");
    assert.ok(
      m6!.missingRequiredEvidenceRoles.includes("followup_recipient_closeup")
    );
    assert.ok(!m6!.missingRequiredEvidenceRoles.includes("followup_front"));
  });

  it("6. reseed is idempotent for projection identity", async () => {
    const first = await seedLongitudinalProjectionFixture({
      fixtureKey: "FRONTAL",
      caseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      patientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      projectionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      now: "2026-07-28T12:00:00.000Z",
    });
    const second = await reseedLongitudinalProjectionFixture(first);
    assert.equal(second.projection.id, first.projection.id);
    assert.equal(second.caseId, first.caseId);
    assert.equal(second.plan.projectionSnapshotId, first.projection.id);
  });

  it("7. cross-patient fixtures use distinct identities", async () => {
    const a = await seedLongitudinalProjectionFixture({
      fixtureKey: "ISOLATION-A",
      now: "2026-07-28T12:00:00.000Z",
    });
    const b = await seedLongitudinalProjectionFixture({
      fixtureKey: "ISOLATION-B",
      now: "2026-07-28T12:00:00.000Z",
    });
    assert.notEqual(a.caseId, b.caseId);
    assert.notEqual(a.patientId, b.patientId);
    assert.notEqual(a.projection.id, b.projection.id);
  });

  it("8. frozen lineage observation/comparison match projection id", async () => {
    const bundle = await seedLongitudinalProjectionFixture({
      fixtureKey: "BASELINE-PLUS",
      now: "2026-07-28T12:00:00.000Z",
    });
    assert.ok(bundle.observation);
    assert.ok(bundle.comparison);
    assert.equal(
      bundle.observation!.projectionSnapshotId,
      bundle.projection.id
    );
    assert.equal(
      bundle.comparison!.projectionSnapshotId,
      bundle.projection.id
    );
    assert.equal(
      bundle.comparison!.observationSnapshotId,
      bundle.observation!.id
    );
    const m12 = bundle.plan.milestones.find((m) => m.stage === "month_12");
    assert.equal(m12?.status, "observed");
  });

  it("9. recommended-skip reaches ready_for_review without donor", async () => {
    const bundle = await seedLongitudinalProjectionFixture({
      fixtureKey: "RECOMMENDED-SKIP",
      now: "2026-07-28T12:00:00.000Z",
    });
    const m6 = bundle.plan.milestones.find((m) => m.stage === "month_6");
    assert.equal(m6?.status, "ready_for_review");
    assert.ok(
      m6!.missingRecommendedEvidenceRoles.includes("followup_donor_rear") ||
        m6!.recommendedEvidenceRoles.includes("followup_donor_rear")
    );
  });

  it("10. missed M6 does not block M9 due", async () => {
    const bundle = await seedLongitudinalProjectionFixture({
      fixtureKey: "MISSED-M6",
      now: "2026-07-28T12:00:00.000Z",
    });
    const m6 = bundle.plan.milestones.find((m) => m.stage === "month_6");
    const m9 = bundle.plan.milestones.find((m) => m.stage === "month_9");
    assert.equal(m6?.status, "missed");
    assert.equal(m9?.status, "due");
  });

  it("11. engagement deep-link uses canonical follow-up href", async () => {
    const bundle = await seedLongitudinalProjectionFixture({
      fixtureKey: "REMINDER",
      now: "2026-07-28T12:00:00.000Z",
    });
    assert.ok(bundle.captureHref);
    assert.match(
      bundle.captureHref!,
      new RegExp(`/cases/${bundle.caseId}/patient/follow-up/month_6`)
    );
    assert.ok(bundle.engagementEvent);
    assert.equal(
      bundle.engagementEvent!.policyVersion,
      ENGAGEMENT_POLICY_VERSION
    );
  });

  it("12. stale reminder suppressed after evidence complete", async () => {
    const due = await seedLongitudinalProjectionFixture({
      fixtureKey: "STALE-REMINDER",
      now: "2026-07-28T12:00:00.000Z",
    });
    assert.ok(due.engagementEvent);

    const ready = await seedLongitudinalProjectionFixture({
      fixtureKey: "STALE-REMINDER",
      mode: "seed-to-ready",
      caseId: due.caseId,
      patientId: due.patientId,
      projectionId: due.projection.id,
      procedureDate: due.procedureDate,
      now: due.now,
      seedEngagement: false,
    });
    const eng = createLongitudinalEngagementService({
      eventRepository: due.repos.engagementRepo,
      config: {
        enabled: true,
        emailEnabled: false,
        smsEnabled: false,
        pushEnabled: false,
        persistEvents: true,
        isProduction: false,
      },
      auditSink: new InMemoryEngagementAuditSink(),
    });
    const m6 = ready.plan.milestones.find((m) => m.stage === "month_6")!;
    const { deriveNextAction } = await import(
      "@/lib/outcomeIntelligence/longitudinalCaptureDto"
    );
    const next = deriveNextAction({
      status: m6.status,
      stage: m6.stage,
      caseId: ready.plan.caseId,
      reviewAvailable: m6.reviewAvailable,
      missingRequiredCount: m6.missingRequiredEvidenceRoles.length,
    });
    const current = {
      projectionSnapshotId: ready.plan.projectionSnapshotId,
      caseId: ready.plan.caseId,
      patientId: ready.plan.patientId,
      stage: m6.stage,
      targetDate: m6.targetDate,
      windowStart: m6.windowStart,
      windowEnd: m6.windowEnd,
      status: m6.status,
      missingRequiredEvidenceRoles: m6.missingRequiredEvidenceRoles,
      missingRequiredLabels: [] as string[],
      observationSnapshotId: m6.observationSnapshotId,
      reviewAvailable: m6.reviewAvailable,
      nextAction: {
        type: next.type,
        href: next.href,
      },
      capturePolicyVersion: ready.plan.planVersion,
      captureProtocolVersion: ready.plan.protocolVersion,
      planCreatedAt: ready.plan.createdAt,
    };
    const reval = await eng.revalidateBeforeDelivery({
      eventId: due.engagementEvent!.id,
      current,
      now: due.now,
    });
    assert.equal(reval.ok, true);
    assert.equal(reval.stillValid, false);
    assert.ok(reval.suppressionCode);
  });

  it("13. historical lineage remains after projection supersession", async () => {
    const hist = await seedLongitudinalProjectionFixture({
      fixtureKey: "HISTORICAL",
      now: "2026-07-28T12:00:00.000Z",
    });
    assert.ok(hist.observation && hist.comparison);

    const ownership = {
      id: hist.caseId,
      patient_id: hist.patientId,
      user_id: hist.patientId,
    };
    const snapService = createProjectionSnapshotService({
      repository: hist.repos.projectionRepo,
      loadCaseOwnership: async () => ownership,
    });
    const { reconstruction, projectedOutcome } = fixtureA_baselinePlusSurgeryDay();
    reconstruction.procedureContext.procedureDate = hist.procedureDate;
    reconstruction.procedureContext.reportedGraftCount = 9999;
    const p2 = await snapService.createProjectionSnapshot(
      {
        caseId: hist.caseId,
        patientId: hist.patientId,
        reconstruction,
        projectedOutcome,
        supersedesProjectionId: hist.projection.id,
        supersessionReasonCode: "source_correction",
        now: "2026-07-29T12:00:00.000Z",
      },
      { caseRow: ownership }
    );
    assert.equal(p2.ok, true);
    if (!p2.ok) return;

    const historical = await hist.repos.projectionRepo.findById(hist.projection.id);
    assert.ok(historical);
    assert.equal(historical!.projectionStatus, "superseded");
    const obs = await hist.repos.observationRepo.findById(hist.observation!.id);
    assert.equal(obs!.projectionSnapshotId, hist.projection.id);
    const cmp = await hist.repos.comparisonRepo.findById(hist.comparison!.id);
    assert.equal(cmp!.projectionSnapshotId, hist.projection.id);

    const report = buildLongitudinalProjectionReviewReport({
      projection: historical!,
      observation: hist.observation!,
      comparison: hist.comparison!,
    });
    assert.equal(report.ok, true);
  });

  it("14. observation correction leaves prior comparison immutable", async () => {
    const base = await seedLongitudinalProjectionFixture({
      fixtureKey: "BASELINE-PLUS",
      now: "2026-07-28T12:00:00.000Z",
    });
    const ownership = {
      id: base.caseId,
      patient_id: base.patientId,
      user_id: base.patientId,
    };
    const o1 = base.observation!;
    const c1 = base.comparison!;

    const month = "12";
    const built = buildLongitudinalOutcomeObservation({
      projectionSnapshotId: base.projection.id,
      caseId: base.caseId,
      patientId: base.patientId,
      stage: "month_12",
      observedAt: "2026-01-20T00:00:00.000Z",
      uploads: [
        { id: "f2", type: `patient_photo:postop_month${month}_front`, captured_at: "2026-01-20T00:00:00.000Z" },
        { id: "t2", type: `patient_photo:postop_month${month}_top`, captured_at: "2026-01-20T00:00:00.000Z" },
        { id: "d2", type: `patient_photo:postop_month${month}_donor`, captured_at: "2026-01-20T00:00:00.000Z" },
      ],
      caseContext: {
        procedureDate: base.procedureDate,
        treatedAreas: ["hairline", "frontal"],
      },
      baselineAvailable: true,
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;

    const obsService = createProjectionObservationService({
      observationRepository: base.repos.observationRepo,
      projectionRepository: base.repos.projectionRepo,
      audit: new InMemoryProjectionObservationAuditSink(),
      loadCaseOwnership: async () => ownership,
    });
    const o2 = await obsService.createLongitudinalObservation(
      {
        projectionSnapshotId: base.projection.id,
        caseId: base.caseId,
        patientId: base.patientId,
        stage: "month_12",
        observation: built.observation,
        supersedesObservationId: o1.id,
        supersessionReasonCode: "source_correction",
        now: "2026-01-21T00:00:00.000Z",
      },
      { caseRow: ownership }
    );
    assert.equal(o2.ok, true);
    if (!o2.ok) return;

    const cmpService = createProjectionComparisonService({
      comparisonRepository: base.repos.comparisonRepo,
      observationRepository: base.repos.observationRepo,
      projectionRepository: base.repos.projectionRepo,
      audit: new InMemoryProjectionComparisonAuditSink(),
      loadCaseOwnership: async () => ownership,
    });
    const c2 = await cmpService.createProjectionComparison(
      {
        projectionSnapshotId: base.projection.id,
        observationSnapshotId: o2.snapshot.id,
        caseId: base.caseId,
        patientId: base.patientId,
        now: "2026-01-22T00:00:00.000Z",
      },
      { caseRow: ownership }
    );
    assert.equal(c2.ok, true);
    if (!c2.ok) return;

    const priorCmp = await base.repos.comparisonRepo.findById(c1.id);
    assert.ok(priorCmp);
    assert.equal(priorCmp!.observationSnapshotId, o1.id);
    assert.equal(c2.snapshot.observationSnapshotId, o2.snapshot.id);
    assert.notEqual(c2.snapshot.id, c1.id);
  });

  it("15. capture plan retains v1 policy identity", async () => {
    const bundle = await seedLongitudinalProjectionFixture({
      fixtureKey: "FRONTAL",
      now: "2026-07-28T12:00:00.000Z",
    });
    assert.equal(bundle.plan.planVersion, CAPTURE_PLAN_VERSION);
  });

  it("16. synthetic images are valid JPEGs", async () => {
    const images = await ensureSyntheticLongitudinalImages();
    assert.ok(images.front);
    const fs = await import("node:fs");
    const buf = fs.readFileSync(images.front);
    assert.ok(buf.length > 500);
    assert.equal(buf[0], 0xff);
    assert.equal(buf[1], 0xd8);
  });

  it("17. surgery-day-only fixture seeds without baseline claim path", async () => {
    const bundle = await seedLongitudinalProjectionFixture({
      fixtureKey: "SURGERY-ONLY",
      now: "2026-07-28T12:00:00.000Z",
    });
    assert.ok(bundle.observation);
    assert.ok(bundle.comparison);
    const report = buildLongitudinalProjectionReviewReport({
      projection: bundle.projection,
      observation: bundle.observation!,
      comparison: bundle.comparison!,
    });
    assert.equal(report.ok, true);
    if (!report.ok || !report.report) return;
    const blob = JSON.stringify(report.report);
    assert.doesNotMatch(blob, /successful transplant/i);
    assert.doesNotMatch(blob, /growth\s*%/i);
  });
});
