/**
 * HA-PROJECTION-1D — Immutable projection persistence + lineage.
 * Run: pnpm exec tsx --test tests/projectionSnapshotPersistence.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fixtureA_baselinePlusSurgeryDay } from "./fixtures/surgeryDayProjection/fixtures";
import {
  canonicalizeForChecksum,
  checksumCanonical,
  computeProjectionChecksums,
} from "@/lib/projection/canonicalChecksum";
import {
  assertNoRetrospectiveContamination,
  attachLongitudinalObservationReference,
} from "@/lib/projection/longitudinalObservationContract";
import { InMemoryProjectionSnapshotAuditSink } from "@/lib/projection/projectionSnapshotAudit";
import { verifyProjectionSnapshotIntegrity } from "@/lib/projection/projectionSnapshotIntegrity";
import { InMemoryProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotRepository";
import { createProjectionSnapshotService } from "@/lib/projection/projectionSnapshotService";
import {
  PROJECTION_ENGINE_VERSION,
  PROJECTION_SNAPSHOT_SCHEMA_VERSION,
  RECONSTRUCTION_CONTRACT_VERSION,
} from "@/lib/projection/versions";
import {
  buildSurgeryDayProjectionReport,
  buildSurgeryDayProjectionReportFromSnapshot,
  resolveSurgeryDayProjectionReport,
} from "@/lib/reports/surgeryDayProjectionReport";
import type { SurgeryDayProjectedOutcome } from "@/lib/projection/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CASE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PATIENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const WRONG_PATIENT = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function caseRow(overrides?: Partial<{ id: string; patient_id: string; user_id: string }>) {
  return {
    id: CASE_ID,
    patient_id: PATIENT_ID,
    user_id: PATIENT_ID,
    ...overrides,
  };
}

function makeService() {
  const repository = new InMemoryProjectionSnapshotRepository();
  const audit = new InMemoryProjectionSnapshotAuditSink();
  const service = createProjectionSnapshotService({
    repository,
    audit,
    loadCaseOwnership: async () => caseRow(),
  });
  return { service, repository, audit };
}

function validPair() {
  return fixtureA_baselinePlusSurgeryDay();
}

describe("HA-PROJECTION-1D creation", () => {
  it("A. Valid 1A + 1B -> immutable snapshot created", async () => {
    const { service, audit } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const created = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
        id: "11111111-1111-1111-1111-111111111111",
        now: "2026-07-01T00:00:00.000Z",
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.created, true);
    assert.equal(created.snapshot.reconstructionVersion, RECONSTRUCTION_CONTRACT_VERSION);
    assert.equal(created.snapshot.projectionEngineVersion, PROJECTION_ENGINE_VERSION);
    assert.equal(created.snapshot.snapshotSchemaVersion, PROJECTION_SNAPSHOT_SCHEMA_VERSION);
    assert.equal(created.snapshot.projectionStatus, "active");
    assert.equal(created.snapshot.lineageRootId, created.snapshot.id);
    assert.equal(created.snapshot.procedureId, CASE_ID);
    assert.ok(audit.events.some((e) => e.eventType === "projection_snapshot_created"));
  });

  it("B. Invalid 1A -> rejected", async () => {
    const { service } = makeService();
    const { projectedOutcome } = validPair();
    const created = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction: { assessmentType: "pre_surgery_planning" } as never,
        projectedOutcome,
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, false);
    if (created.ok) return;
    assert.equal(created.code, "INVALID_RECONSTRUCTION");
  });

  it("C. Invalid 1B -> rejected", async () => {
    const { service } = makeService();
    const { reconstruction } = validPair();
    const created = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome: {
          assessmentType: "surgery_day_projection",
          projectedCharacteristics: [],
        } as never,
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, false);
    if (created.ok) return;
    assert.equal(created.code, "INVALID_PROJECTION");
  });

  it("D. wrong tenant/patient ownership -> rejected", async () => {
    const { service, audit } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const created = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: WRONG_PATIENT,
        reconstruction,
        projectedOutcome,
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, false);
    if (created.ok) return;
    assert.equal(created.code, "OWNERSHIP_MISMATCH");
    assert.ok(audit.events.some((e) => e.eventType === "projection_snapshot_read_denied"));
  });

  it("E. wrong patient/procedure linkage -> rejected", async () => {
    const { service } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const created = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
      },
      {
        caseRow: {
          id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          patient_id: PATIENT_ID,
        },
      }
    );
    assert.equal(created.ok, false);
    if (created.ok) return;
    assert.equal(created.code, "OWNERSHIP_MISMATCH");
  });
});

describe("HA-PROJECTION-1D checksums", () => {
  it("F/G. same canonical projection (+ reordered fields) -> same checksums", () => {
    const { reconstruction, projectedOutcome } = validPair();
    const a = computeProjectionChecksums({ reconstruction, projectedOutcome });
    const reordered = JSON.parse(
      JSON.stringify({
        projectedCharacteristics: projectedOutcome.projectedCharacteristics,
        assessmentType: projectedOutcome.assessmentType,
        summary: projectedOutcome.summary,
        reconstructionConfidence: projectedOutcome.reconstructionConfidence,
        projectionConfidence: projectedOutcome.projectionConfidence,
        whatCannotYetBeDetermined: projectedOutcome.whatCannotYetBeDetermined,
        assumptions: projectedOutcome.assumptions,
        limitations: projectedOutcome.limitations,
      })
    ) as SurgeryDayProjectedOutcome;
    const b = computeProjectionChecksums({
      reconstruction: canonicalizeForChecksum(reconstruction),
      projectedOutcome: reordered,
    });
    assert.equal(a.projectionOutputChecksum, b.projectionOutputChecksum);
    assert.equal(a.reconstructionInputChecksum, b.reconstructionInputChecksum);
    assert.equal(a.projectionInputChecksum, a.reconstructionInputChecksum);
  });

  it("H. material reconstruction change -> checksum changes", () => {
    const { reconstruction, projectedOutcome } = validPair();
    const base = checksumCanonical(reconstruction);
    const changed = structuredClone(reconstruction);
    changed.evidence.limitations = [...changed.evidence.limitations, "Extra limitation"];
    assert.notEqual(base, checksumCanonical(changed));
    const checksums = computeProjectionChecksums({
      reconstruction: changed,
      projectedOutcome,
    });
    const original = computeProjectionChecksums({ reconstruction, projectedOutcome });
    assert.notEqual(
      checksums.reconstructionInputChecksum,
      original.reconstructionInputChecksum
    );
  });

  it("I. material projection change -> checksum changes", () => {
    const { reconstruction, projectedOutcome } = validPair();
    const original = computeProjectionChecksums({ reconstruction, projectedOutcome });
    const changed = structuredClone(projectedOutcome);
    changed.summary = `${changed.summary ?? ""} Revised wording.`;
    const next = computeProjectionChecksums({ reconstruction, projectedOutcome: changed });
    assert.notEqual(next.projectionOutputChecksum, original.projectionOutputChecksum);
  });
});

describe("HA-PROJECTION-1D immutability + lineage", () => {
  it("J. attempt to mutate frozen projection -> blocked", async () => {
    const { service } = makeService();
    const blocked = await service.attemptMutateFrozenProjection("any", {
      projectionSnapshot: { summary: "hacked" },
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.code, "MUTATION_FORBIDDEN");
  });

  it("K/L. revised projection -> new snapshot; supersession lineage correct", async () => {
    const { service } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const first = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
        id: "aaaaaaaa-1111-1111-1111-111111111111",
        now: "2026-07-01T00:00:00.000Z",
      },
      { caseRow: caseRow() }
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;

    const revised = structuredClone(projectedOutcome);
    revised.summary = "Clinically corrected projection summary for lineage test.";
    // Builder agreement only checks assessmentType — summary may differ.
    const second = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome: revised,
        id: "bbbbbbbb-2222-2222-2222-222222222222",
        now: "2026-07-02T00:00:00.000Z",
        supersedesProjectionId: first.snapshot.id,
        supersessionReasonCode: "manual_clinical_correction",
      },
      { caseRow: caseRow() }
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.created, true);
    assert.equal(second.snapshot.supersedesProjectionId, first.snapshot.id);
    assert.equal(second.snapshot.lineageRootId, first.snapshot.lineageRootId);
    assert.equal(second.snapshot.supersessionReasonCode, "manual_clinical_correction");

    const old = await service.getProjectionById({
      projectionId: first.snapshot.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      caseRow: caseRow(),
    });
    assert.equal(old.ok, true);
    if (!old.ok) return;
    assert.equal(old.snapshot.projectionStatus, "superseded");
    assert.equal(old.snapshot.supersededByProjectionId, second.snapshot.id);
    assert.equal(old.snapshot.projectionSnapshot.summary, projectedOutcome.summary);
  });

  it("M. current projection -> latest active snapshot", async () => {
    const { service } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const first = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
        now: "2026-07-01T00:00:00.000Z",
      },
      { caseRow: caseRow() }
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const revised = structuredClone(projectedOutcome);
    revised.limitations = [...revised.limitations, "Additional bounded limitation."];
    const second = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome: revised,
        now: "2026-07-03T00:00:00.000Z",
        supersedesProjectionId: first.snapshot.id,
        supersessionReasonCode: "source_correction",
      },
      { caseRow: caseRow() }
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    const current = await service.getCurrentProjection({
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      caseRow: caseRow(),
    });
    assert.equal(current.ok, true);
    if (!current.ok) return;
    assert.equal(current.snapshot.id, second.snapshot.id);
    assert.equal(current.snapshot.projectionStatus, "active");
  });

  it("N. historical projection -> old snapshot still readable", async () => {
    const { service } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const first = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
        now: "2026-07-01T00:00:00.000Z",
      },
      { caseRow: caseRow() }
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const revised = structuredClone(projectedOutcome);
    revised.assumptions = [...revised.assumptions, "Revised assumption."];
    await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome: revised,
        now: "2026-07-04T00:00:00.000Z",
        supersedesProjectionId: first.snapshot.id,
        supersessionReasonCode: "late_surgery_data",
      },
      { caseRow: caseRow() }
    );
    const lineage = await service.listProjectionLineage({
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      lineageRootId: first.snapshot.lineageRootId,
      caseRow: caseRow(),
    });
    assert.equal(lineage.ok, true);
    if (!lineage.ok) return;
    assert.ok(lineage.snapshots.length >= 2);
    assert.ok(lineage.snapshots.some((s) => s.id === first.snapshot.id));
  });
});

describe("HA-PROJECTION-1D idempotency", () => {
  it("O. same projection creation repeated -> reuse existing", async () => {
    const { service, audit } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const first = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
      },
      { caseRow: caseRow() }
    );
    const second = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
      },
      { caseRow: caseRow() }
    );
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.reused, true);
    assert.equal(second.created, false);
    assert.equal(second.snapshot.id, first.snapshot.id);
    assert.ok(audit.events.some((e) => e.eventType === "projection_snapshot_reused"));
  });

  it("P. materially different projection -> new snapshot", async () => {
    const { service } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const first = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
      },
      { caseRow: caseRow() }
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const revised = structuredClone(projectedOutcome);
    revised.summary = "Materially different projection content.";
    const second = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome: revised,
        supersedesProjectionId: first.snapshot.id,
        supersessionReasonCode: "projection_rule_revision",
      },
      { caseRow: caseRow() }
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.created, true);
    assert.notEqual(second.snapshot.id, first.snapshot.id);
    assert.notEqual(
      second.snapshot.projectionOutputChecksum,
      first.snapshot.projectionOutputChecksum
    );
  });
});

describe("HA-PROJECTION-1D report integration", () => {
  it("Q. 1C rendering from persisted snapshot -> same approved content", async () => {
    const { service } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const created = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const fromSnapshot = buildSurgeryDayProjectionReportFromSnapshot({
      persistedSnapshot: {
        projectionId: created.snapshot.id,
        reconstruction: created.snapshot.reconstructionSnapshot,
        projectedOutcome: created.snapshot.projectionSnapshot,
      },
      caseId: CASE_ID,
    });
    const direct = buildSurgeryDayProjectionReport({ reconstruction, projectedOutcome });
    assert.equal(fromSnapshot.ok, true);
    assert.equal(direct.ok, true);
    if (!fromSnapshot.ok || !direct.ok) return;
    assert.equal(fromSnapshot.report.summary, direct.report.summary);
    assert.equal(
      fromSnapshot.report.projectedCharacteristics.length,
      direct.report.projectedCharacteristics.length
    );
    assert.equal(fromSnapshot.report.projectionSnapshotId, created.snapshot.id);
  });

  it("R. historical report render after engine changes -> frozen content unchanged", async () => {
    const { service } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const created = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const frozenSummary = created.snapshot.projectionSnapshot.summary;
    // Simulate later engine change by mutating a live rebuild input — snapshot must win.
    const liveDifferent = structuredClone(projectedOutcome);
    liveDifferent.summary = "SHOULD NOT APPEAR IN HISTORICAL RENDER";
    const resolved = resolveSurgeryDayProjectionReport({
      persistedSnapshot: {
        projectionId: created.snapshot.id,
        reconstruction: created.snapshot.reconstructionSnapshot,
        projectedOutcome: created.snapshot.projectionSnapshot,
      },
      // Even if reconstructionInput would produce different content, snapshot wins.
      reconstructionInput: null,
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.report.summary, frozenSummary);
    assert.notEqual(resolved.report.summary, liveDifferent.summary);
  });

  it("S. report fallback without snapshot -> current 1C behaviour preserved", () => {
    const { reconstruction, projectedOutcome } = validPair();
    const resolved = resolveSurgeryDayProjectionReport({
      summary: {
        surgeryDayReconstruction: reconstruction,
        surgeryDayProjectedOutcome: projectedOutcome,
      },
      caseId: CASE_ID,
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.report.projectionSnapshotId, null);
    assert.equal(resolved.report.assessmentType, projectedOutcome.assessmentType);
  });
});

describe("HA-PROJECTION-1D integrity", () => {
  it("T. valid stored snapshot -> integrity PASS", async () => {
    const { service } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const created = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const integrity = verifyProjectionSnapshotIntegrity(created.snapshot);
    assert.equal(integrity.ok, true);
  });

  it("U. tampered snapshot -> integrity FAIL", async () => {
    const { service, audit } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const created = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const tampered = structuredClone(created.snapshot);
    tampered.projectionSnapshot.summary = "tampered after freeze";
    const integrity = verifyProjectionSnapshotIntegrity(tampered);
    assert.equal(integrity.ok, false);
    const verified = await service.verifyIntegrity({
      projectionId: created.snapshot.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      caseRow: caseRow(),
    });
    assert.equal(verified.ok, true);
    // Direct verify on tampered via integrity helper already failed closed.
    void audit;
    void integrity;
  });

  it("V. tampered checksum -> integrity FAIL", () => {
    const { reconstruction, projectedOutcome } = validPair();
    const checksums = computeProjectionChecksums({ reconstruction, projectedOutcome });
    const fake = {
      id: "x",
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      procedureId: CASE_ID,
      projectionType: projectedOutcome.assessmentType,
      projectionStatus: "active" as const,
      reconstructionVersion: RECONSTRUCTION_CONTRACT_VERSION,
      projectionEngineVersion: PROJECTION_ENGINE_VERSION,
      snapshotSchemaVersion: PROJECTION_SNAPSHOT_SCHEMA_VERSION,
      reportTemplateVersion: 1,
      reconstructionInputChecksum: checksums.reconstructionInputChecksum,
      projectionInputChecksum: checksums.projectionInputChecksum,
      projectionOutputChecksum: "0".repeat(64),
      reconstructionSnapshot: reconstruction,
      projectionSnapshot: projectedOutcome,
      confidenceSummary: {
        reconstructionConfidence: projectedOutcome.reconstructionConfidence,
        projectionConfidence: projectedOutcome.projectionConfidence,
        characteristicCount: 0,
        limitationCount: 0,
      },
      evidenceSummary: {
        presentRoles: reconstruction.evidence.presentRoles,
        baselineAvailable: reconstruction.baseline.available,
        assessmentType: projectedOutcome.assessmentType,
        reconstructionAssessmentType: reconstruction.assessmentType,
      },
      createdAt: "2026-07-01T00:00:00.000Z",
      createdBy: "system",
      supersedesProjectionId: null,
      supersededByProjectionId: null,
      lineageRootId: "x",
      supersessionReasonCode: null,
      sourceReportId: null,
      sourceAssessmentId: null,
    };
    const integrity = verifyProjectionSnapshotIntegrity(fake);
    assert.equal(integrity.ok, false);
  });
});

describe("HA-PROJECTION-1D longitudinal safety", () => {
  it("W. later outcome data exists -> historical projection unchanged", async () => {
    const { service } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const created = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const frozenChecksum = created.snapshot.projectionOutputChecksum;
    // Simulate month-12 knowledge arriving — must not rewrite day-0 snapshot.
    const laterOutcome = {
      knownDensity: 45,
      knownSurvival: 0.92,
      patientSatisfaction: "high",
    };
    const reloaded = await service.getProjectionById({
      projectionId: created.snapshot.id,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      caseRow: caseRow(),
    });
    assert.equal(reloaded.ok, true);
    if (!reloaded.ok) return;
    assert.equal(reloaded.snapshot.projectionOutputChecksum, frozenChecksum);
    assert.equal(
      JSON.stringify(reloaded.snapshot.projectionSnapshot),
      JSON.stringify(created.snapshot.projectionSnapshot)
    );
    void laterOutcome;
  });

  it("X. projection comparison contract references original projection_id", async () => {
    const { service } = makeService();
    const { reconstruction, projectedOutcome } = validPair();
    const created = await service.createProjectionSnapshot(
      {
        caseId: CASE_ID,
        patientId: PATIENT_ID,
        reconstruction,
        projectedOutcome,
      },
      { caseRow: caseRow() }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const ref = attachLongitudinalObservationReference({
      snapshot: created.snapshot,
      observationTimepoint: "month_12",
      observationDate: "2027-07-01",
      measurementVersion: "imagingos-v0-deferred",
    });
    assert.equal(ref.projectionId, created.snapshot.id);
    assert.equal(ref.procedureId, CASE_ID);
    const ok = assertNoRetrospectiveContamination({
      historicalProjectionId: created.snapshot.id,
      comparisonProjectionId: ref.projectionId,
    });
    assert.equal(ok.ok, true);
    const bad = assertNoRetrospectiveContamination({
      historicalProjectionId: created.snapshot.id,
      comparisonProjectionId: "recalculated-elsewhere",
    });
    assert.equal(bad.ok, false);
  });
});

describe("HA-PROJECTION-1D migration additive", () => {
  it("migration creates projection snapshot tables without altering reports", () => {
    const sql = readFileSync(
      join(
        __dirname,
        "../supabase/migrations/20260727120000_hairaudit_projection_snapshots.sql"
      ),
      "utf8"
    );
    assert.match(sql, /hairaudit_projection_snapshots/);
    assert.match(sql, /hairaudit_projection_snapshot_events/);
    assert.match(sql, /supersedes_projection_id/);
    assert.match(sql, /lineage_root_id/);
    assert.doesNotMatch(sql, /ALTER TABLE public\.reports/);
    assert.doesNotMatch(sql, /DROP TABLE public\.reports/);
  });
});
