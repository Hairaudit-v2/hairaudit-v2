/**
 * HA-PROJECTION-1F — Comparison service: lineage, ownership, immutability, migration.
 * Run: pnpm exec tsx --test tests/projectionComparisonService.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fixtureA_baselinePlusSurgeryDay } from "./fixtures/surgeryDayProjection/fixtures";
import { InMemoryProjectionComparisonAuditSink } from "@/lib/projection/projectionComparisonAudit";
import { InMemoryProjectionComparisonRepository } from "@/lib/projection/projectionComparisonRepository";
import { createProjectionComparisonService } from "@/lib/projection/projectionComparisonService";
import { InMemoryProjectionObservationAuditSink } from "@/lib/projection/projectionObservationAudit";
import { InMemoryProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import { createProjectionObservationService } from "@/lib/projection/projectionObservationService";
import { InMemoryProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotRepository";
import { createProjectionSnapshotService } from "@/lib/projection/projectionSnapshotService";
import { buildLongitudinalOutcomeObservation } from "@/lib/projection/longitudinalOutcomeObservation";
import {
  COMPARISON_SCHEMA_VERSION,
} from "@/lib/projection/versions";
import type { LongitudinalOutcomeObservation } from "@/lib/projection/types";
import type { ProjectionComparisonSnapshot } from "@/lib/projection/projectionComparisonTypes";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CASE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PATIENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const WRONG_PATIENT = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const WRONG_CASE = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const PROCEDURE = "2025-01-15T00:00:00.000Z";

function caseRow(overrides?: Partial<{ id: string; patient_id: string; user_id: string }>) {
  return {
    id: CASE_ID,
    patient_id: PATIENT_ID,
    user_id: PATIENT_ID,
    ...overrides,
  };
}

function makeObservationPayload(
  projectionSnapshotId: string,
  stage: "month_3" | "month_6" | "month_9" | "month_12" = "month_6",
  overrides?: Partial<LongitudinalOutcomeObservation>
): LongitudinalOutcomeObservation {
  const month = stage.replace("month_", "");
  const capture =
    stage === "month_3"
      ? "2025-04-15T00:00:00.000Z"
      : stage === "month_6"
        ? "2025-07-20T00:00:00.000Z"
        : stage === "month_9"
          ? "2025-10-15T00:00:00.000Z"
          : "2026-01-15T00:00:00.000Z";
  const built = buildLongitudinalOutcomeObservation({
    projectionSnapshotId,
    caseId: CASE_ID,
    patientId: PATIENT_ID,
    stage,
    observedAt: capture,
    uploads: [
      {
        id: "f",
        type: `patient_photo:postop_month${month}_front`,
        captured_at: capture,
      },
      {
        id: "t",
        type: `patient_photo:postop_month${month}_top`,
        captured_at: capture,
      },
      {
        id: "d",
        type: `patient_photo:postop_month${month}_donor`,
        captured_at: capture,
      },
    ],
    caseContext: {
      procedureDate: PROCEDURE,
      treatedAreas: ["frontal", "hairline"],
    },
    baselineAvailable: true,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  return { ...built.observation, ...overrides };
}

async function seedProjection(projectionRepo: InMemoryProjectionSnapshotRepository) {
  const snapService = createProjectionSnapshotService({
    repository: projectionRepo,
    loadCaseOwnership: async () => caseRow(),
  });
  const { reconstruction, projectedOutcome } = fixtureA_baselinePlusSurgeryDay();
  const created = await snapService.createProjectionSnapshot(
    {
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      reconstruction,
      projectedOutcome,
      id: "11111111-1111-1111-1111-111111111111",
      now: "2025-01-20T00:00:00.000Z",
    },
    { caseRow: caseRow() }
  );
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("seed projection failed");
  return created.snapshot;
}

async function seedObservation(
  observationRepo: InMemoryProjectionObservationRepository,
  projectionRepo: InMemoryProjectionSnapshotRepository,
  projectionId: string,
  stage: "month_3" | "month_6" | "month_9" | "month_12" = "month_6",
  id?: string,
  observationOverride?: LongitudinalOutcomeObservation
) {
  const service = createProjectionObservationService({
    observationRepository: observationRepo,
    projectionRepository: projectionRepo,
    audit: new InMemoryProjectionObservationAuditSink(),
    loadCaseOwnership: async () => caseRow(),
  });
  const obs = observationOverride ?? makeObservationPayload(projectionId, stage);
  const created = await service.createLongitudinalObservation(
    {
      projectionSnapshotId: projectionId,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      stage,
      observation: obs,
      id: id ?? "22222222-2222-2222-2222-222222222222",
      now: "2025-07-20T00:00:00.000Z",
    },
    { caseRow: caseRow() }
  );
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error(created.reason);
  return created.snapshot;
}

function makeService() {
  const projectionRepo = new InMemoryProjectionSnapshotRepository();
  const observationRepo = new InMemoryProjectionObservationRepository();
  const comparisonRepo = new InMemoryProjectionComparisonRepository();
  const audit = new InMemoryProjectionComparisonAuditSink();
  const service = createProjectionComparisonService({
    comparisonRepository: comparisonRepo,
    observationRepository: observationRepo,
    projectionRepository: projectionRepo,
    audit,
    loadCaseOwnership: async () => caseRow(),
  });
  return { service, projectionRepo, observationRepo, comparisonRepo, audit };
}

describe("HA-PROJECTION-1F lineage / ownership", () => {
  it("1. valid projection + linked observation accepted", async () => {
    const { service, projectionRepo, observationRepo, audit } = makeService();
    const projection = await seedProjection(projectionRepo);
    const observation = await seedObservation(
      observationRepo,
      projectionRepo,
      projection.id
    );
    const result = await service.createProjectionComparison(
      {
        projectionSnapshotId: projection.id,
        observationSnapshotId: observation.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        id: "cmp-0001-0001-0001-000000000001",
      },
      { caseRow: caseRow() }
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.created, true);
    assert.equal(result.snapshot.projectionSnapshotId, projection.id);
    assert.equal(result.snapshot.observationSnapshotId, observation.id);
    assert.equal(result.snapshot.comparisonSchemaVersion, COMPARISON_SCHEMA_VERSION);
    assert.ok(audit.events.some((e) => e.eventType === "comparison_created"));
  });

  it("2. observation linked to another projection rejected", async () => {
    const { service, projectionRepo, observationRepo, audit } = makeService();
    const projection = await seedProjection(projectionRepo);

    // Second projection
    const snapService = createProjectionSnapshotService({
      repository: projectionRepo,
      loadCaseOwnership: async () => caseRow(),
    });
    const { reconstruction, projectedOutcome } = fixtureA_baselinePlusSurgeryDay();
    const altered = {
      ...projectedOutcome,
      summary: `${projectedOutcome.summary ?? ""} Alternate lineage.`.trim(),
      limitations: [...projectedOutcome.limitations, "Alternate projection note."],
    };
    const second = await snapService.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome: altered,
        supersedesProjectionId: projection.id,
        supersessionReasonCode: "source_correction",
        id: "33333333-3333-3333-3333-333333333333",
      },
      { caseRow: caseRow() }
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;

    // Observation attached to first projection
    const observation = await seedObservation(
      observationRepo,
      projectionRepo,
      projection.id
    );

    // Attempt compare second projection with observation belonging to first
    const result = await service.createProjectionComparison(
      {
        projectionSnapshotId: second.snapshot.id,
        observationSnapshotId: observation.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
      },
      { caseRow: caseRow(), skipOwnershipCheck: true }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "LINEAGE_MISMATCH");
    assert.ok(audit.events.some((e) => e.eventType === "comparison_lineage_rejected"));
  });

  it("3. wrong case rejected", async () => {
    const { service, projectionRepo, observationRepo } = makeService();
    const projection = await seedProjection(projectionRepo);
    const observation = await seedObservation(
      observationRepo,
      projectionRepo,
      projection.id
    );
    const result = await service.createProjectionComparison(
      {
        projectionSnapshotId: projection.id,
        observationSnapshotId: observation.id,
        caseId: WRONG_CASE,
        patientId: PATIENT_ID,
      },
      { skipOwnershipCheck: true }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "OWNERSHIP_MISMATCH");
  });

  it("4. wrong patient rejected", async () => {
    const { service, projectionRepo, observationRepo, audit } = makeService();
    const projection = await seedProjection(projectionRepo);
    const observation = await seedObservation(
      observationRepo,
      projectionRepo,
      projection.id
    );
    const result = await service.createProjectionComparison(
      {
        projectionSnapshotId: projection.id,
        observationSnapshotId: observation.id,
        caseId: CASE_ID,
        patientId: WRONG_PATIENT,
      },
      { skipOwnershipCheck: true }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "OWNERSHIP_MISMATCH");
    assert.ok(audit.events.some((e) => e.eventType === "comparison_ownership_rejected"));
  });
});

describe("HA-PROJECTION-1F persistence / immutability", () => {
  it("31. identical frozen inputs idempotent", async () => {
    const { service, projectionRepo, observationRepo, audit } = makeService();
    const projection = await seedProjection(projectionRepo);
    const observation = await seedObservation(
      observationRepo,
      projectionRepo,
      projection.id
    );

    const first = await service.createProjectionComparison(
      {
        projectionSnapshotId: projection.id,
        observationSnapshotId: observation.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        id: "cmp-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
      { caseRow: caseRow() }
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;

    const second = await service.createProjectionComparison(
      {
        projectionSnapshotId: projection.id,
        observationSnapshotId: observation.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        id: "cmp-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      },
      { caseRow: caseRow() }
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.reused, true);
    assert.equal(second.created, false);
    assert.equal(second.snapshot.id, first.snapshot.id);
    assert.ok(audit.events.some((e) => e.eventType === "comparison_reused"));
  });

  it("32-33. corrected observation creates new comparison; old remains immutable", async () => {
    const { service, projectionRepo, observationRepo, comparisonRepo } = makeService();
    const projection = await seedProjection(projectionRepo);
    const obsService = createProjectionObservationService({
      observationRepository: observationRepo,
      projectionRepository: projectionRepo,
      loadCaseOwnership: async () => caseRow(),
    });

    const obs1 = makeObservationPayload(projection.id, "month_6");
    const firstObs = await obsService.createLongitudinalObservation(
      {
        projectionSnapshotId: projection.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        stage: "month_6",
        observation: obs1,
        id: "obs-1111-1111-1111-111111111111",
      },
      { caseRow: caseRow() }
    );
    assert.equal(firstObs.ok, true);
    if (!firstObs.ok) return;

    const c1 = await service.createProjectionComparison(
      {
        projectionSnapshotId: projection.id,
        observationSnapshotId: firstObs.snapshot.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        id: "cmp-1111-1111-1111-111111111111",
      },
      { caseRow: caseRow() }
    );
    assert.equal(c1.ok, true);
    if (!c1.ok) return;
    const c1Payload = structuredClone(c1.snapshot.comparisonPayload);
    const c1Checksum = c1.snapshot.comparisonChecksum;

    const obs2Payload: LongitudinalOutcomeObservation = {
      ...obs1,
      limitations: [...obs1.limitations, "Additional image-limited correction note."],
    };
    const secondObs = await obsService.createLongitudinalObservation(
      {
        projectionSnapshotId: projection.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        stage: "month_6",
        observation: obs2Payload,
        supersessionReasonCode: "source_correction",
        id: "obs-2222-2222-2222-222222222222",
      },
      { caseRow: caseRow() }
    );
    assert.equal(secondObs.ok, true);
    if (!secondObs.ok) return;

    const c2 = await service.createProjectionComparison(
      {
        projectionSnapshotId: projection.id,
        observationSnapshotId: secondObs.snapshot.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        id: "cmp-2222-2222-2222-222222222222",
      },
      { caseRow: caseRow() }
    );
    assert.equal(c2.ok, true);
    if (!c2.ok) return;
    assert.equal(c2.created, true);
    assert.notEqual(c2.snapshot.id, c1.snapshot.id);
    assert.equal(c2.snapshot.observationSnapshotId, secondObs.snapshot.id);

    const prior = await comparisonRepo.findById(c1.snapshot.id);
    assert.ok(prior);
    assert.equal(prior!.comparisonStatus, "active"); // C1 remains valid historical comparison vs O1
    assert.deepEqual(prior!.comparisonPayload, c1Payload);
    assert.equal(prior!.comparisonChecksum, c1Checksum);
    assert.equal(service.attemptMutateFrozenComparison().ok, false);
  });

  it("34. version / rule revision creates new comparison rather than rewriting", async () => {
    const { service, projectionRepo, observationRepo, comparisonRepo } = makeService();
    const projection = await seedProjection(projectionRepo);
    const observation = await seedObservation(
      observationRepo,
      projectionRepo,
      projection.id,
      "month_6",
      "obs-3333-3333-3333-333333333333"
    );

    const first = await service.createProjectionComparison(
      {
        projectionSnapshotId: projection.id,
        observationSnapshotId: observation.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        id: "cmp-3333-3333-3333-333333333333",
      },
      { caseRow: caseRow() }
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;

    // Simulate rule revision by inserting a divergent active row checksum manually,
    // then creating via supersession path with comparison_rule_revision.
    const mutated: ProjectionComparisonSnapshot = {
      ...structuredClone(first.snapshot),
      id: "cmp-4444-4444-4444-444444444444",
      comparisonChecksum: `${first.snapshot.comparisonChecksum}-revised`,
      comparisonSchemaVersion: "ha-projection-comparison-v1-revised-test",
      createdAt: "2025-07-21T00:00:00.000Z",
      supersedesComparisonId: first.snapshot.id,
      supersessionReasonCode: "comparison_rule_revision",
    };
    // Mark prior superseded through repository metadata after insert of "new" version stand-in
    await comparisonRepo.applyMutableMetadata(first.snapshot.id, {
      comparisonStatus: "superseded",
      supersededByComparisonId: mutated.id,
    });
    await comparisonRepo.insert(mutated);

    const prior = await comparisonRepo.findById(first.snapshot.id);
    assert.ok(prior);
    assert.equal(prior!.comparisonStatus, "superseded");
    assert.equal(prior!.comparisonChecksum, first.snapshot.comparisonChecksum);
    assert.notEqual(mutated.comparisonChecksum, first.snapshot.comparisonChecksum);
  });

  it("independent stage comparisons coexist (month3 + month6)", async () => {
    const { service, projectionRepo, observationRepo } = makeService();
    const projection = await seedProjection(projectionRepo);
    const o3 = await seedObservation(
      observationRepo,
      projectionRepo,
      projection.id,
      "month_3",
      "obs-m3-0000-0000-000000000001",
      makeObservationPayload(projection.id, "month_3")
    );
    const o6 = await seedObservation(
      observationRepo,
      projectionRepo,
      projection.id,
      "month_6",
      "obs-m6-0000-0000-000000000001",
      makeObservationPayload(projection.id, "month_6")
    );

    const c3 = await service.createProjectionComparison(
      {
        projectionSnapshotId: projection.id,
        observationSnapshotId: o3.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        id: "cmp-m3-0000-0000-000000000001",
      },
      { caseRow: caseRow() }
    );
    const c6 = await service.createProjectionComparison(
      {
        projectionSnapshotId: projection.id,
        observationSnapshotId: o6.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        id: "cmp-m6-0000-0000-000000000001",
      },
      { caseRow: caseRow() }
    );
    assert.equal(c3.ok && c6.ok, true);
    if (!c3.ok || !c6.ok) return;
    assert.equal(c3.snapshot.stage, "month_3");
    assert.equal(c6.snapshot.stage, "month_6");
    assert.notEqual(c3.snapshot.id, c6.snapshot.id);
  });
});

describe("HA-PROJECTION-1F migration / RLS", () => {
  it("migration is additive with service-role RLS", () => {
    const sqlPath = join(
      __dirname,
      "..",
      "supabase",
      "migrations",
      "20260727160000_hairaudit_projection_comparisons.sql"
    );
    const sql = readFileSync(sqlPath, "utf8");

    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.hairaudit_projection_comparisons/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.hairaudit_projection_comparison_events/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /auth\.role\(\) = 'service_role'/);
    assert.match(
      sql,
      /REVOKE ALL ON public\.hairaudit_projection_comparisons FROM anon, authenticated/
    );
    assert.match(sql, /GRANT ALL ON public\.hairaudit_projection_comparisons TO service_role/);
    assert.match(sql, /projection_snapshot_id/);
    assert.match(sql, /observation_snapshot_id/);
    assert.match(sql, /uq_hairaudit_projection_comparisons_idempotent/);
    assert.match(sql, /idx_hairaudit_projection_comparisons_current/);
    assert.doesNotMatch(sql, /ALTER TABLE public\.reports/);
    assert.doesNotMatch(sql, /DROP TABLE/);
    assert.match(
      sql,
      /REFERENCES public\.hairaudit_projection_snapshots\(id\) ON DELETE RESTRICT/
    );
    assert.match(
      sql,
      /REFERENCES public\.hairaudit_projection_observations\(id\) ON DELETE RESTRICT/
    );
    assert.match(sql, /comparison_schema_version/);
    assert.match(sql, /supersedes_comparison_id/);
  });
});
