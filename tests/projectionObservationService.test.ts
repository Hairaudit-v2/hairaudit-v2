/**
 * HA-PROJECTION-1E — Observation service: lineage, ownership, immutability, migration.
 * Run: pnpm exec tsx --test tests/projectionObservationService.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fixtureA_baselinePlusSurgeryDay } from "./fixtures/surgeryDayProjection/fixtures";
import { InMemoryProjectionObservationAuditSink } from "@/lib/projection/projectionObservationAudit";
import { InMemoryProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import {
  computeObservationChecksum,
  createProjectionObservationService,
} from "@/lib/projection/projectionObservationService";
import { InMemoryProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotRepository";
import { createProjectionSnapshotService } from "@/lib/projection/projectionSnapshotService";
import { buildLongitudinalOutcomeObservation } from "@/lib/projection/longitudinalOutcomeObservation";
import {
  OBSERVATION_LINEAGE_VERSION,
  OBSERVATION_SCHEMA_VERSION,
} from "@/lib/projection/versions";
import type { LongitudinalOutcomeObservation } from "@/lib/projection/types";

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
  if (!created.ok) throw new Error("seed failed");
  return created.snapshot;
}

function makeObservation(
  projectionSnapshotId: string,
  stage: "month_3" | "month_6" | "month_9" | "month_12" = "month_6",
  overrides?: Partial<LongitudinalOutcomeObservation>
): LongitudinalOutcomeObservation {
  const month = stage.replace("month_", "");
  const built = buildLongitudinalOutcomeObservation({
    projectionSnapshotId,
    caseId: CASE_ID,
    patientId: PATIENT_ID,
    stage,
    observedAt: "2025-07-20T00:00:00.000Z",
    uploads: [
      {
        id: "f",
        type: `patient_photo:postop_month${month}_front`,
        captured_at: "2025-07-20T00:00:00.000Z",
      },
      {
        id: "t",
        type: `patient_photo:postop_month${month}_top`,
        captured_at: "2025-07-20T00:00:00.000Z",
      },
      {
        id: "d",
        type: `patient_photo:postop_month${month}_donor`,
        captured_at: "2025-07-20T00:00:00.000Z",
      },
    ],
    caseContext: {
      procedureDate: PROCEDURE,
      treatedAreas: ["frontal", "hairline"],
    },
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  return { ...built.observation, ...overrides };
}

function makeService() {
  const projectionRepo = new InMemoryProjectionSnapshotRepository();
  const observationRepo = new InMemoryProjectionObservationRepository();
  const audit = new InMemoryProjectionObservationAuditSink();
  const service = createProjectionObservationService({
    observationRepository: observationRepo,
    projectionRepository: projectionRepo,
    audit,
    loadCaseOwnership: async () => caseRow(),
  });
  return { service, projectionRepo, observationRepo, audit };
}

describe("HA-PROJECTION-1E ownership / lineage", () => {
  it("9. observation must reference valid projection snapshot", async () => {
    const { service } = makeService();
    const obs = makeObservation("00000000-0000-0000-0000-000000000099");
    const result = await service.createLongitudinalObservation(
      {
        projectionSnapshotId: "00000000-0000-0000-0000-000000000099",
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        stage: "month_6",
        observation: obs,
      },
      { caseRow: caseRow(), skipOwnershipCheck: true }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "PROJECTION_NOT_FOUND");
  });

  it("10. wrong case rejected", async () => {
    const { service, projectionRepo } = makeService();
    const projection = await seedProjection(projectionRepo);
    const obs = makeObservation(projection.id);
    const result = await service.createLongitudinalObservation(
      {
        projectionSnapshotId: projection.id,
        caseId: WRONG_CASE,
        patientId: PATIENT_ID,
        stage: "month_6",
        observation: { ...obs, caseId: WRONG_CASE },
      },
      { skipOwnershipCheck: true }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "OWNERSHIP_MISMATCH");
  });

  it("11. wrong patient rejected", async () => {
    const { service, projectionRepo, audit } = makeService();
    const projection = await seedProjection(projectionRepo);
    const obs = makeObservation(projection.id);
    const result = await service.createLongitudinalObservation(
      {
        projectionSnapshotId: projection.id,
        caseId: CASE_ID,
        patientId: WRONG_PATIENT,
        stage: "month_6",
        observation: { ...obs, patientId: WRONG_PATIENT },
      },
      { skipOwnershipCheck: true }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "OWNERSHIP_MISMATCH");
    assert.ok(audit.events.some((e) => e.eventType === "observation_ownership_rejected"));
  });

  it("12-13. superseded projection remains valid historical lineage target; observation stays attached", async () => {
    const { service, projectionRepo } = makeService();
    const snapService = createProjectionSnapshotService({
      repository: projectionRepo,
      loadCaseOwnership: async () => caseRow(),
    });
    const { reconstruction, projectedOutcome } = fixtureA_baselinePlusSurgeryDay();
    const first = await snapService.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
        id: "11111111-1111-1111-1111-111111111111",
      },
      { caseRow: caseRow() }
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;

    // Supersede with slightly different projection text
    const altered = {
      ...projectedOutcome,
      summary: `${projectedOutcome.summary ?? ""} Additional correction note.`.trim(),
      limitations: [...projectedOutcome.limitations, "Corrected source metadata."],
    };
    const second = await snapService.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome: altered,
        supersedesProjectionId: first.snapshot.id,
        supersessionReasonCode: "source_correction",
        id: "22222222-2222-2222-2222-222222222222",
      },
      { caseRow: caseRow() }
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;

    const obs = makeObservation(first.snapshot.id);
    const created = await service.createLongitudinalObservation(
      {
        projectionSnapshotId: first.snapshot.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        stage: "month_6",
        observation: obs,
        id: "obs-0001-0001-0001-000000000001",
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.snapshot.projectionSnapshotId, first.snapshot.id);
    assert.notEqual(created.snapshot.projectionSnapshotId, second.snapshot.id);

    // Historical read still works against superseded projection
    const loaded = await service.getObservationById({
      id: created.snapshot.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
    });
    assert.equal(loaded.ok, true);
    if (!loaded.ok) return;
    assert.equal(loaded.snapshot.projectionSnapshotId, first.snapshot.id);
  });
});

describe("HA-PROJECTION-1E immutability", () => {
  it("14. same payload replay is idempotent", async () => {
    const { service, projectionRepo, audit } = makeService();
    const projection = await seedProjection(projectionRepo);
    const obs = makeObservation(projection.id);

    const first = await service.createLongitudinalObservation(
      {
        projectionSnapshotId: projection.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        stage: "month_6",
        observation: obs,
        id: "obs-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
      { caseRow: caseRow() }
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;

    const second = await service.createLongitudinalObservation(
      {
        projectionSnapshotId: projection.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        stage: "month_6",
        observation: obs,
        id: "obs-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      },
      { caseRow: caseRow() }
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.reused, true);
    assert.equal(second.created, false);
    assert.equal(second.snapshot.id, first.snapshot.id);
    assert.ok(audit.events.some((e) => e.eventType === "observation_snapshot_reused"));
  });

  it("15-17. changed payload creates new row; previous not mutated; supersession link correct", async () => {
    const { service, projectionRepo, observationRepo } = makeService();
    const projection = await seedProjection(projectionRepo);
    const obs = makeObservation(projection.id);

    const first = await service.createLongitudinalObservation(
      {
        projectionSnapshotId: projection.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        stage: "month_6",
        observation: obs,
        id: "obs-1111-1111-1111-111111111111",
      },
      { caseRow: caseRow() }
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const originalChecksum = first.snapshot.observationChecksum;
    const originalPayload = structuredClone(first.snapshot.observationPayload);

    const changed: LongitudinalOutcomeObservation = {
      ...obs,
      limitations: [...obs.limitations, "Additional image-limited note for correction."],
    };
    assert.notEqual(computeObservationChecksum(changed), originalChecksum);

    const second = await service.createLongitudinalObservation(
      {
        projectionSnapshotId: projection.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        stage: "month_6",
        observation: changed,
        supersessionReasonCode: "source_correction",
        id: "obs-2222-2222-2222-222222222222",
      },
      { caseRow: caseRow() }
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.created, true);
    assert.equal(second.supersededPreviousId, first.snapshot.id);
    assert.equal(second.snapshot.supersedesObservationId, first.snapshot.id);

    const prior = await observationRepo.findById(first.snapshot.id);
    assert.ok(prior);
    assert.equal(prior!.observationStatus, "superseded");
    assert.equal(prior!.supersededByObservationId, second.snapshot.id);
    assert.deepEqual(prior!.observationPayload, originalPayload);
    assert.equal(prior!.observationChecksum, originalChecksum);

    assert.equal(
      service.attemptMutateFrozenObservation().ok,
      false
    );
  });

  it("stores schema versions and checksums", async () => {
    const { service, projectionRepo } = makeService();
    const projection = await seedProjection(projectionRepo);
    const obs = makeObservation(projection.id);
    const created = await service.createLongitudinalObservation(
      {
        projectionSnapshotId: projection.id,
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        stage: "month_6",
        observation: obs,
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.snapshot.observationSchemaVersion, OBSERVATION_SCHEMA_VERSION);
    assert.equal(created.snapshot.observationLineageVersion, OBSERVATION_LINEAGE_VERSION);
    assert.equal(
      created.snapshot.observationChecksum,
      computeObservationChecksum(obs)
    );
  });
});

describe("HA-PROJECTION-1E migration / RLS", () => {
  it("migration is additive with service-role RLS", () => {
    const sqlPath = join(
      __dirname,
      "..",
      "supabase",
      "migrations",
      "20260727140000_hairaudit_projection_observations.sql"
    );
    const sql = readFileSync(sqlPath, "utf8");

    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.hairaudit_projection_observations/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.hairaudit_projection_observation_events/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /auth\.role\(\) = 'service_role'/);
    assert.match(sql, /REVOKE ALL ON public\.hairaudit_projection_observations FROM anon, authenticated/);
    assert.match(sql, /GRANT ALL ON public\.hairaudit_projection_observations TO service_role/);
    assert.match(sql, /projection_snapshot_id/);
    assert.match(sql, /uq_hairaudit_projection_observations_idempotent/);
    assert.match(sql, /idx_hairaudit_projection_observations_current/);
    assert.doesNotMatch(sql, /ALTER TABLE public\.reports/);
    assert.doesNotMatch(sql, /DROP TABLE/);
    assert.match(sql, /REFERENCES public\.hairaudit_projection_snapshots\(id\) ON DELETE RESTRICT/);
    assert.match(sql, /observation_schema_version/);
    assert.match(sql, /supersedes_observation_id/);
  });
});
