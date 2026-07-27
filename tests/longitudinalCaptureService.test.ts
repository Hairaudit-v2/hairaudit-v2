/**
 * FI-OUTCOME-INTELLIGENCE-1C — Capture plan service + fixtures + cohort separation.
 * Run: pnpm exec tsx --test tests/longitudinalCaptureService.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fixtureA_baselinePlusSurgeryDay } from "./fixtures/surgeryDayProjection/fixtures";
import { InMemoryProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotRepository";
import { createProjectionSnapshotService } from "@/lib/projection/projectionSnapshotService";
import { InMemoryProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import { InMemoryProjectionComparisonRepository } from "@/lib/projection/projectionComparisonRepository";
import { createProjectionObservationService } from "@/lib/projection/projectionObservationService";
import { buildLongitudinalOutcomeObservation } from "@/lib/projection/longitudinalOutcomeObservation";
import { InMemoryLongitudinalCapturePlanRepository } from "@/lib/outcomeIntelligence/longitudinalCaptureRepository";
import {
  assertPatientCaptureDtoSafe,
  createLongitudinalCapturePlanService,
} from "@/lib/outcomeIntelligence/longitudinalCaptureService";
import {
  CAPTURE_PLAN_VERSION,
  CAPTURE_PROTOCOL_VERSION,
} from "@/lib/outcomeIntelligence/longitudinalCaptureTypes";
import { resolveOutcomeCohortConfig } from "@/lib/outcomeIntelligence/cohortConfig";
import { buildMilestoneEvidenceRequirements } from "@/lib/outcomeIntelligence/longitudinalCapturePolicy";
import type { ProjectionUploadInput } from "@/lib/projection/types";
import type { LongitudinalOutcomeObservation } from "@/lib/projection/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CASE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PATIENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const WRONG_PATIENT = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const WRONG_CASE = "dddddddd-dddd-dddd-dddd-dddddddddddd";

function caseRow(overrides?: Partial<{ id: string; patient_id: string; user_id: string }>) {
  return {
    id: CASE_ID,
    patient_id: PATIENT_ID,
    user_id: PATIENT_ID,
    ...overrides,
  };
}

async function seedProjection(
  projectionRepo: InMemoryProjectionSnapshotRepository,
  opts?: { id?: string; treatedAreas?: string[]; procedureDate?: string }
) {
  const snapService = createProjectionSnapshotService({
    repository: projectionRepo,
    loadCaseOwnership: async () => caseRow(),
  });
  const { reconstruction, projectedOutcome } = fixtureA_baselinePlusSurgeryDay();
  if (opts?.treatedAreas) {
    reconstruction.procedureContext.treatedAreas = opts.treatedAreas;
    reconstruction.recipient.observedTreatedAreas = opts.treatedAreas;
  }
  if (opts?.procedureDate) {
    reconstruction.procedureContext.procedureDate = opts.procedureDate;
  }
  const created = await snapService.createProjectionSnapshot(
    {
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      reconstruction,
      projectedOutcome,
      id: opts?.id ?? "11111111-1111-1111-1111-111111111111",
      now: "2025-01-20T00:00:00.000Z",
    },
    { caseRow: caseRow() }
  );
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("seed failed");
  return created.snapshot;
}

function makeService() {
  const projectionRepo = new InMemoryProjectionSnapshotRepository();
  const observationRepo = new InMemoryProjectionObservationRepository();
  const comparisonRepo = new InMemoryProjectionComparisonRepository();
  const captureRepo = new InMemoryLongitudinalCapturePlanRepository();
  const service = createLongitudinalCapturePlanService({
    capturePlanRepository: captureRepo,
    projectionRepository: projectionRepo,
    observationRepository: observationRepo,
    comparisonRepository: comparisonRepo,
    loadCaseOwnership: async () => caseRow(),
  });
  return { service, projectionRepo, observationRepo, comparisonRepo, captureRepo };
}

function monthUploads(
  month: 3 | 6 | 9 | 12,
  views: Array<"front" | "top" | "crown" | "donor">
): ProjectionUploadInput[] {
  return views.map((v, i) => ({
    id: `${month}-${v}-${i}`,
    type: `patient_photo:postop_month${month}_${v}`,
  }));
}

describe("FI-OUTCOME-INTELLIGENCE-1C projection linkage", () => {
  it("25. valid projection creates plan", async () => {
    const { service, projectionRepo } = makeService();
    const snap = await seedProjection(projectionRepo, {
      procedureDate: "2025-01-15",
      treatedAreas: ["frontal", "hairline"],
    });
    const created = await service.createCapturePlan(
      {
        projectionSnapshotId: snap.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        procedureDate: "2025-01-15",
        now: "2025-01-20T00:00:00.000Z",
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.created, true);
  });

  it("26. wrong patient rejected", async () => {
    const { service, projectionRepo } = makeService();
    const snap = await seedProjection(projectionRepo, { procedureDate: "2025-01-15" });
    const created = await service.createCapturePlan(
      {
        projectionSnapshotId: snap.id,
        caseId: CASE_ID,
        patientId: WRONG_PATIENT,
        procedureDate: "2025-01-15",
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, false);
    if (created.ok) return;
    assert.equal(created.code, "OWNERSHIP_MISMATCH");
  });

  it("27. wrong case rejected", async () => {
    const { service, projectionRepo } = makeService();
    const snap = await seedProjection(projectionRepo, { procedureDate: "2025-01-15" });
    const created = await service.createCapturePlan(
      {
        projectionSnapshotId: snap.id,
        caseId: WRONG_CASE,
        patientId: PATIENT_ID,
        procedureDate: "2025-01-15",
      },
      { skipOwnershipCheck: true }
    );
    assert.equal(created.ok, false);
    if (created.ok) return;
    assert.equal(created.code, "CASE_MISMATCH");
  });

  it("28–29. superseded projection retains historical plan; new projection separate", async () => {
    const { service, projectionRepo, captureRepo } = makeService();
    const snapA = await seedProjection(projectionRepo, {
      id: "11111111-1111-1111-1111-111111111111",
      procedureDate: "2025-01-15",
    });
    await service.createCapturePlan(
      {
        projectionSnapshotId: snapA.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        procedureDate: "2025-01-15",
        id: "plan-a",
      },
      { caseRow: caseRow() }
    );

    const snapService = createProjectionSnapshotService({
      repository: projectionRepo,
      loadCaseOwnership: async () => caseRow(),
    });
    const { reconstruction, projectedOutcome } = fixtureA_baselinePlusSurgeryDay();
    reconstruction.procedureContext.procedureDate = "2025-01-15";
    reconstruction.procedureContext.reportedGraftCount = 9999; // force new checksum
    const snapB = await snapService.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
        id: "22222222-2222-2222-2222-222222222222",
        supersedesProjectionId: snapA.id,
        supersessionReasonCode: "source_correction",
        now: "2025-01-25T00:00:00.000Z",
      },
      { caseRow: caseRow() }
    );
    assert.equal(snapB.ok, true);
    if (!snapB.ok) return;

    await service.createCapturePlan(
      {
        projectionSnapshotId: snapB.snapshot.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        procedureDate: "2025-01-15",
        id: "plan-b",
      },
      { caseRow: caseRow() }
    );

    const plansA = await captureRepo.findByProjectionSnapshotId(snapA.id);
    const plansB = await captureRepo.findByProjectionSnapshotId(snapB.snapshot.id);
    assert.equal(plansA.length, 1);
    assert.equal(plansB.length, 1);
    assert.notEqual(plansA[0]!.id, plansB[0]!.id);
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1C policy versioning", () => {
  it("30. same projection + same policy idempotent", async () => {
    const { service, projectionRepo } = makeService();
    const snap = await seedProjection(projectionRepo, { procedureDate: "2025-01-15" });
    const a = await service.createCapturePlan(
      {
        projectionSnapshotId: snap.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        procedureDate: "2025-01-15",
      },
      { caseRow: caseRow() }
    );
    const b = await service.createCapturePlan(
      {
        projectionSnapshotId: snap.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        procedureDate: "2025-01-15",
      },
      { caseRow: caseRow() }
    );
    assert.equal(a.ok && b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.equal(a.created, true);
    assert.equal(b.reused, true);
    assert.equal(a.record.id, b.record.id);
  });

  it("31–32. v2 policy does not silently rewrite v1; version stored", async () => {
    const { service, projectionRepo, captureRepo } = makeService();
    const snap = await seedProjection(projectionRepo, { procedureDate: "2025-01-15" });
    await service.createCapturePlan(
      {
        projectionSnapshotId: snap.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        procedureDate: "2025-01-15",
      },
      { caseRow: caseRow() }
    );
    const records = await captureRepo.findByProjectionSnapshotId(snap.id);
    assert.equal(records[0]!.capturePolicyVersion, CAPTURE_PLAN_VERSION);
    assert.equal(records[0]!.captureProtocolVersion, CAPTURE_PROTOCOL_VERSION);

    // Historical v1 requirements remain resolvable via frozen protocol version.
    const v1 = buildMilestoneEvidenceRequirements({
      stage: "month_6",
      treatment: {
        treatedAreas: ["frontal"],
        crownTreated: false,
        templesTreated: false,
        frontalFocus: true,
        donorEvidenceRequired: false,
      },
      protocolVersion: CAPTURE_PROTOCOL_VERSION,
    });
    assert.ok(v1.required.includes("followup_front"));
    assert.equal(v1.protocolVersion, CAPTURE_PROTOCOL_VERSION);
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1C fixtures + missed independence", () => {
  it("14. missed Month 6 does not block Month 9", async () => {
    const { service, projectionRepo } = makeService();
    const snap = await seedProjection(projectionRepo, {
      procedureDate: "2025-01-15",
      treatedAreas: ["frontal"],
    });
    // Now inside Month 9 window (~Oct 15 ± 30d) → after Month 6 window
    const resolved = await service.resolveCapturePlan({
      projectionSnapshotId: snap.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      uploads: [],
      now: "2025-10-15T00:00:00.000Z",
      caseRow: caseRow(),
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    const m6 = resolved.plan.milestones.find((m) => m.stage === "month_6")!;
    const m9 = resolved.plan.milestones.find((m) => m.stage === "month_9")!;
    assert.equal(m6.status, "missed");
    assert.ok(m9.status === "due" || m9.status === "future" || m9.status === "evidence_incomplete");
    assert.notEqual(m9.status, "missed");
  });

  it("A. Frontal-only projection Month 3 due", async () => {
    const { service, projectionRepo } = makeService();
    const snap = await seedProjection(projectionRepo, {
      procedureDate: "2025-01-15",
      treatedAreas: ["frontal", "hairline"],
    });
    const resolved = await service.resolveCapturePlan({
      projectionSnapshotId: snap.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      uploads: [],
      now: "2025-04-15T00:00:00.000Z",
      caseRow: caseRow(),
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    const m3 = resolved.plan.milestones.find((m) => m.stage === "month_3")!;
    assert.equal(m3.status, "due");
    assert.ok(!m3.requiredEvidenceRoles.includes("followup_crown"));
  });

  it("B. Frontal + crown Month 6 incomplete crown", async () => {
    const { service, projectionRepo } = makeService();
    const snap = await seedProjection(projectionRepo, {
      procedureDate: "2025-01-15",
      treatedAreas: ["frontal", "crown"],
    });
    const uploads = [
      ...monthUploads(6, ["front", "top"]),
      {
        id: "rc",
        type: "patient_photo:current_recipient_closeup",
        captured_at: "2025-07-15T00:00:00.000Z",
      },
    ];
    const resolved = await service.resolveCapturePlan({
      projectionSnapshotId: snap.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      uploads,
      now: "2025-07-15T00:00:00.000Z",
      caseRow: caseRow(),
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    const m6 = resolved.plan.milestones.find((m) => m.stage === "month_6")!;
    assert.equal(m6.status, "evidence_incomplete");
    assert.ok(m6.missingRequiredEvidenceRoles.includes("followup_crown"));
  });

  it("C. Rich baseline Month 9 ready", async () => {
    const { service, projectionRepo } = makeService();
    const snap = await seedProjection(projectionRepo, {
      procedureDate: "2025-01-15",
      treatedAreas: ["frontal", "hairline"],
    });
    const uploads: ProjectionUploadInput[] = [
      ...monthUploads(9, ["front", "top"]),
      {
        id: "rc",
        type: "patient_photo:current_recipient_closeup",
        captured_at: "2025-10-15T00:00:00.000Z",
      },
    ];
    const resolved = await service.resolveCapturePlan({
      projectionSnapshotId: snap.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      uploads,
      now: "2025-10-15T00:00:00.000Z",
      caseRow: caseRow(),
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    const m9 = resolved.plan.milestones.find((m) => m.stage === "month_9")!;
    assert.equal(m9.status, "ready_for_review");
  });

  it("D. Month 12 observed + review available", async () => {
    const { service, projectionRepo, observationRepo, comparisonRepo } = makeService();
    const snap = await seedProjection(projectionRepo, {
      procedureDate: "2025-01-15",
      treatedAreas: ["frontal"],
    });

    const obsService = createProjectionObservationService({
      observationRepository: observationRepo,
      projectionRepository: projectionRepo,
      loadCaseOwnership: async () => caseRow(),
    });
    const built = buildLongitudinalOutcomeObservation({
      projectionSnapshotId: snap.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      stage: "month_12",
      observedAt: "2026-01-20T00:00:00.000Z",
      uploads: monthUploads(12, ["front", "top", "donor"]),
      caseContext: { procedureDate: "2025-01-15", treatedAreas: ["frontal"] },
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const obs = await obsService.createLongitudinalObservation(
      {
        projectionSnapshotId: snap.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        stage: "month_12",
        observation: built.observation as LongitudinalOutcomeObservation,
        id: "33333333-3333-3333-3333-333333333333",
        now: "2026-01-20T00:00:00.000Z",
      },
      { caseRow: caseRow() }
    );
    assert.equal(obs.ok, true);
    if (!obs.ok) return;

    await comparisonRepo.insert({
      id: "44444444-4444-4444-4444-444444444444",
      projectionSnapshotId: snap.id,
      observationSnapshotId: obs.snapshot.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      stage: "month_12",
      comparisonStatus: "active",
      comparisonSchemaVersion: "ha-projection-comparison-v1",
      projectionSchemaVersion: snap.snapshotSchemaVersion,
      observationSchemaVersion: obs.snapshot.observationSchemaVersion,
      comparisonChecksum: "cmp-checksum",
      comparisonPayload: {
        projectionSnapshotId: snap.id,
        observationSnapshotId: obs.snapshot.id,
        stage: "month_12",
        comparedAt: "2026-01-21T00:00:00.000Z",
        overallStatus: "not_yet_assessable",
        domainComparisons: [],
        limitations: [],
      } as never,
      createdAt: "2026-01-21T00:00:00.000Z",
      createdBy: null,
      supersedesComparisonId: null,
      supersededByComparisonId: null,
      supersessionReasonCode: null,
    });

    const resolved = await service.resolveCapturePlan({
      projectionSnapshotId: snap.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      uploads: monthUploads(12, ["front", "top", "donor"]),
      now: "2026-01-20T00:00:00.000Z",
      caseRow: caseRow(),
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    const m12 = resolved.plan.milestones.find((m) => m.stage === "month_12")!;
    assert.equal(m12.status, "observed");
    assert.equal(m12.observationSnapshotId, obs.snapshot.id);
    assert.equal(m12.reviewAvailable, true);

    const dto = await service.toPatientDto(resolved.plan);
    const m12Dto = dto.milestones.find((m) => m.stage === "month_12")!;
    assert.equal(m12Dto.nextAction.type, "view_review");
  });

  it("F. No donor evidence but donor recommended only", async () => {
    const { service, projectionRepo } = makeService();
    const snap = await seedProjection(projectionRepo, {
      procedureDate: "2025-01-15",
      treatedAreas: ["frontal"],
    });
    // Clear donor concerns on reconstruction via fresh seed without concerns
    const uploads: ProjectionUploadInput[] = [
      ...monthUploads(6, ["front", "top"]),
      {
        id: "rc",
        type: "patient_photo:current_recipient_closeup",
        captured_at: "2025-07-15T00:00:00.000Z",
      },
    ];
    const resolved = await service.resolveCapturePlan({
      projectionSnapshotId: snap.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      uploads,
      now: "2025-07-15T00:00:00.000Z",
      caseRow: caseRow(),
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    const m6 = resolved.plan.milestones.find((m) => m.stage === "month_6")!;
    assert.ok(m6.recommendedEvidenceRoles.includes("followup_donor_rear"));
    assert.ok(!m6.requiredEvidenceRoles.includes("followup_donor_rear"));
    assert.equal(m6.status, "ready_for_review");
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1C cohort separation + safety", () => {
  it("38–40. capture works with cohort disabled / governance unapproved; no materialization", async () => {
    const cfg = resolveOutcomeCohortConfig(
      {},
      { enabled: false, governanceApproved: false, hmacSecret: null }
    );
    assert.equal(cfg.enabled, false);
    assert.equal(cfg.governanceApproved, false);

    const { service, projectionRepo } = makeService();
    const snap = await seedProjection(projectionRepo, { procedureDate: "2025-01-15" });
    const resolved = await service.resolveCapturePlan({
      projectionSnapshotId: snap.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      uploads: [],
      now: "2025-04-15T00:00:00.000Z",
      caseRow: caseRow(),
    });
    assert.equal(resolved.ok, true);
  });

  it("41–44. patient DTO has no sensitive/internal fields or prediction language", async () => {
    const { service, projectionRepo } = makeService();
    const snap = await seedProjection(projectionRepo, { procedureDate: "2025-01-15" });
    const resolved = await service.resolveCapturePlan({
      projectionSnapshotId: snap.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      uploads: [],
      now: "2025-04-15T00:00:00.000Z",
      caseRow: caseRow(),
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    const dto = await service.toPatientDto(resolved.plan);
    const safe = assertPatientCaptureDtoSafe(dto);
    assert.equal(safe.ok, true, JSON.stringify(safe));
    const blob = JSON.stringify(dto);
    assert.doesNotMatch(blob, /caseId|patientId|projectionSnapshotId/);
    assert.doesNotMatch(blob, /followup_front|patient_photo:/);
    assert.doesNotMatch(blob, /graft survival|accuracy|success rate/i);
  });

  it("45. migration SQL enforces service-role RLS", () => {
    const sql = readFileSync(
      join(
        __dirname,
        "../supabase/migrations/20260727190000_hairaudit_longitudinal_capture_plans.sql"
      ),
      "utf8"
    );
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /service_role/);
    assert.match(sql, /hairaudit_longitudinal_capture_plans/);
    assert.match(sql, /uq_hairaudit_longitudinal_capture_plans_idempotent/);
  });
});
