/**
 * HA-PROJECTION-1D — Canonical projection snapshot domain service.
 *
 * Single creation path for immutable surgery-day projection snapshots.
 * Report rendering must not write persistence directly — call this service.
 */

import { randomUUID } from "node:crypto";
import { computeProjectionChecksums } from "./canonicalChecksum";
import {
  buildSnapshotAuditMetadata,
  createAuditEvent,
  type ProjectionSnapshotAuditSink,
} from "./projectionSnapshotAudit";
import { verifyProjectionSnapshotIntegrity } from "./projectionSnapshotIntegrity";
import type { ProjectionSnapshotRepository } from "./projectionSnapshotRepository";
import type {
  CreateProjectionSnapshotInput,
  CreateProjectionSnapshotResult,
  LongitudinalObservationReference,
  LongitudinalObservationTimepoint,
  ProjectionSnapshot,
} from "./projectionSnapshotTypes";
import {
  validateCaseOwnership,
  validateProjectedOutcomeForSnapshot,
  validateReconstructionForSnapshot,
} from "./projectionSnapshotValidate";
import {
  PROJECTION_ENGINE_VERSION,
  PROJECTION_SNAPSHOT_SCHEMA_VERSION,
  RECONSTRUCTION_CONTRACT_VERSION,
} from "./versions";
import type { SurgeryDayProjectionAssessmentType } from "./types";

export type CaseOwnershipRow = {
  id?: string;
  patient_id?: string | null;
  user_id?: string | null;
};

export type ProjectionSnapshotServiceDeps = {
  repository: ProjectionSnapshotRepository;
  audit?: ProjectionSnapshotAuditSink;
  /** Resolve case ownership; required for create/read when enforceOwnership is true. */
  loadCaseOwnership?: (caseId: string) => Promise<CaseOwnershipRow | null>;
};

function deepFreezeClone<T>(value: T): T {
  return structuredClone(value);
}

function buildConfidenceSummary(
  reconstruction: ProjectionSnapshot["reconstructionSnapshot"],
  projected: ProjectionSnapshot["projectionSnapshot"]
): ProjectionSnapshot["confidenceSummary"] {
  return {
    reconstructionConfidence: projected.reconstructionConfidence,
    projectionConfidence: projected.projectionConfidence,
    characteristicCount: projected.projectedCharacteristics.length,
    limitationCount:
      projected.limitations.length +
      reconstruction.evidence.limitations.length +
      projected.whatCannotYetBeDetermined.length,
  };
}

function buildEvidenceSummary(
  reconstruction: ProjectionSnapshot["reconstructionSnapshot"],
  projected: ProjectionSnapshot["projectionSnapshot"]
): ProjectionSnapshot["evidenceSummary"] {
  return {
    presentRoles: [...reconstruction.evidence.presentRoles],
    baselineAvailable: reconstruction.baseline.available,
    assessmentType: projected.assessmentType,
    reconstructionAssessmentType: reconstruction.assessmentType,
  };
}

export class ProjectionSnapshotService {
  constructor(private readonly deps: ProjectionSnapshotServiceDeps) {}

  /**
   * Create (or idempotently reuse) an immutable projection snapshot.
   */
  async createProjectionSnapshot(
    input: CreateProjectionSnapshotInput,
    opts?: { caseRow?: CaseOwnershipRow | null; skipOwnershipCheck?: boolean }
  ): Promise<CreateProjectionSnapshotResult> {
    const recon = validateReconstructionForSnapshot(input.reconstruction);
    if (!recon.ok) {
      return { ok: false, code: "INVALID_RECONSTRUCTION", reason: recon.reason };
    }

    const proj = validateProjectedOutcomeForSnapshot(
      input.projectedOutcome,
      recon.reconstruction
    );
    if (!proj.ok) {
      return { ok: false, code: "INVALID_PROJECTION", reason: proj.reason };
    }

    if (!opts?.skipOwnershipCheck) {
      const caseRow =
        opts?.caseRow ??
        (this.deps.loadCaseOwnership
          ? await this.deps.loadCaseOwnership(input.caseId)
          : null);
      const ownership = validateCaseOwnership({
        caseId: input.caseId,
        patientId: input.patientId,
        caseRow,
      });
      if (!ownership.ok) {
        await this.audit({
          eventType: "projection_snapshot_read_denied",
          caseId: input.caseId,
          patientId: input.patientId,
          actorId: input.createdBy ?? null,
          metadata: { reason: ownership.reason, operation: "create" },
        });
        return { ok: false, code: "OWNERSHIP_MISMATCH", reason: ownership.reason };
      }
    }

    const checksums = computeProjectionChecksums({
      reconstruction: recon.reconstruction,
      projectedOutcome: proj.projectedOutcome,
    });

    const reconstructionVersion = RECONSTRUCTION_CONTRACT_VERSION;
    const projectionEngineVersion = PROJECTION_ENGINE_VERSION;
    const projectionType = proj.projectedOutcome.assessmentType;

    const existing = await this.deps.repository.findByIdempotencyKey({
      caseId: input.caseId,
      projectionType,
      reconstructionVersion,
      projectionEngineVersion,
      snapshotSchemaVersion: PROJECTION_SNAPSHOT_SCHEMA_VERSION,
      reconstructionInputChecksum: checksums.reconstructionInputChecksum,
      projectionOutputChecksum: checksums.projectionOutputChecksum,
    });

    if (existing) {
      await this.audit({
        eventType: "projection_snapshot_reused",
        caseId: existing.caseId,
        patientId: existing.patientId,
        projectionId: existing.id,
        actorId: input.createdBy ?? null,
        metadata: buildSnapshotAuditMetadata(existing),
      });
      return {
        ok: true,
        created: false,
        reused: true,
        snapshot: existing,
        supersededPreviousId: null,
      };
    }

    let supersedesId: string | null = input.supersedesProjectionId ?? null;
    let lineageRootId: string | null = null;
    let prior: ProjectionSnapshot | null = null;

    if (supersedesId) {
      prior = await this.deps.repository.findById(supersedesId);
      if (!prior) {
        return {
          ok: false,
          code: "SUPERSESSION_INVALID",
          reason: "Prior projection snapshot not found for supersession.",
        };
      }
      if (prior.caseId !== input.caseId || prior.patientId !== input.patientId) {
        return {
          ok: false,
          code: "SUPERSESSION_INVALID",
          reason: "Supersession requires matching case and patient ownership.",
        };
      }
      if (!input.supersessionReasonCode) {
        return {
          ok: false,
          code: "SUPERSESSION_INVALID",
          reason: "supersessionReasonCode is required when superseding.",
        };
      }
      lineageRootId = prior.lineageRootId;
    } else {
      // Auto-supersede current active when creating a materially different projection
      // for the same case/type without an explicit prior id.
      const current = await this.deps.repository.findCurrentActive({
        caseId: input.caseId,
        projectionType,
      });
      if (current) {
        prior = current;
        supersedesId = current.id;
        lineageRootId = current.lineageRootId;
        if (!input.supersessionReasonCode) {
          return {
            ok: false,
            code: "SUPERSESSION_INVALID",
            reason:
              "An active projection already exists. Provide supersedesProjectionId + supersessionReasonCode, or reuse identical content.",
          };
        }
      }
    }

    const id = input.id ?? randomUUID();
    const createdAt = input.now ?? new Date().toISOString();
    if (!lineageRootId) lineageRootId = id;

    const snapshot: ProjectionSnapshot = {
      id,
      caseId: input.caseId,
      patientId: input.patientId,
      procedureId: input.caseId,
      projectionType,
      projectionStatus: "active",
      reconstructionVersion,
      projectionEngineVersion,
      snapshotSchemaVersion: PROJECTION_SNAPSHOT_SCHEMA_VERSION,
      // Aligns with SURGERY_DAY_PROJECTION_REPORT_VERSION in surgeryDayProjectionReport.ts
      reportTemplateVersion: input.reportTemplateVersion ?? 1,
      reconstructionInputChecksum: checksums.reconstructionInputChecksum,
      projectionInputChecksum: checksums.projectionInputChecksum,
      projectionOutputChecksum: checksums.projectionOutputChecksum,
      reconstructionSnapshot: deepFreezeClone(recon.reconstruction),
      projectionSnapshot: deepFreezeClone(proj.projectedOutcome),
      confidenceSummary: buildConfidenceSummary(recon.reconstruction, proj.projectedOutcome),
      evidenceSummary: buildEvidenceSummary(recon.reconstruction, proj.projectedOutcome),
      createdAt,
      createdBy: input.createdBy ?? "system",
      supersedesProjectionId: supersedesId,
      supersededByProjectionId: null,
      lineageRootId,
      supersessionReasonCode: supersedesId
        ? (input.supersessionReasonCode ?? null)
        : null,
      sourceReportId: input.sourceReportId ?? null,
      sourceAssessmentId: input.sourceAssessmentId ?? null,
    };

    const integrity = verifyProjectionSnapshotIntegrity(snapshot);
    if (!integrity.ok) {
      await this.audit({
        eventType: "projection_snapshot_integrity_failed",
        caseId: snapshot.caseId,
        patientId: snapshot.patientId,
        projectionId: snapshot.id,
        actorId: input.createdBy ?? null,
        metadata: { reason: integrity.reason, stage: "pre_insert" },
      });
      return { ok: false, code: "INTEGRITY_FAILED", reason: integrity.reason };
    }

    const inserted = await this.deps.repository.insert(snapshot);

    if (prior && supersedesId) {
      await this.deps.repository.applyMutableMetadata(prior.id, {
        projectionStatus: "superseded",
        supersededByProjectionId: inserted.id,
      });
      await this.audit({
        eventType: "projection_snapshot_superseded",
        caseId: prior.caseId,
        patientId: prior.patientId,
        projectionId: prior.id,
        actorId: input.createdBy ?? null,
        metadata: {
          ...buildSnapshotAuditMetadata(prior),
          supersededByProjectionId: inserted.id,
          supersessionReasonCode: inserted.supersessionReasonCode,
        },
      });
    }

    await this.audit({
      eventType: "projection_snapshot_created",
      caseId: inserted.caseId,
      patientId: inserted.patientId,
      projectionId: inserted.id,
      actorId: input.createdBy ?? null,
      metadata: buildSnapshotAuditMetadata(inserted),
    });

    return {
      ok: true,
      created: true,
      reused: false,
      snapshot: inserted,
      supersededPreviousId: supersedesId,
    };
  }

  /** Latest active (non-superseded) projection for a case / optional type. */
  async getCurrentProjection(args: {
    caseId: string;
    patientId: string;
    projectionType?: SurgeryDayProjectionAssessmentType | null;
    actorId?: string | null;
    skipOwnershipCheck?: boolean;
    caseRow?: CaseOwnershipRow | null;
  }): Promise<CreateProjectionSnapshotResult> {
    const denied = await this.enforceReadOwnership(args);
    if (denied) return denied;

    const snapshot = await this.deps.repository.findCurrentActive({
      caseId: args.caseId,
      projectionType: args.projectionType ?? null,
    });
    if (!snapshot) {
      return { ok: false, code: "NOT_FOUND", reason: "No active projection snapshot found." };
    }
    return this.returnRead(snapshot, args.actorId ?? null);
  }

  async getProjectionById(args: {
    projectionId: string;
    caseId: string;
    patientId: string;
    actorId?: string | null;
    skipOwnershipCheck?: boolean;
    caseRow?: CaseOwnershipRow | null;
  }): Promise<CreateProjectionSnapshotResult> {
    const denied = await this.enforceReadOwnership(args);
    if (denied) return denied;

    const snapshot = await this.deps.repository.findById(args.projectionId);
    if (!snapshot) {
      return { ok: false, code: "NOT_FOUND", reason: "Projection snapshot not found." };
    }
    if (snapshot.caseId !== args.caseId || snapshot.patientId !== args.patientId) {
      await this.audit({
        eventType: "projection_snapshot_read_denied",
        caseId: args.caseId,
        patientId: args.patientId,
        projectionId: args.projectionId,
        actorId: args.actorId ?? null,
        metadata: { reason: "cross_ownership" },
      });
      return {
        ok: false,
        code: "OWNERSHIP_MISMATCH",
        reason: "Projection snapshot ownership mismatch.",
      };
    }
    return this.returnRead(snapshot, args.actorId ?? null);
  }

  async listProjectionLineage(args: {
    caseId: string;
    patientId: string;
    lineageRootId?: string | null;
    actorId?: string | null;
    skipOwnershipCheck?: boolean;
    caseRow?: CaseOwnershipRow | null;
  }): Promise<
    | { ok: true; snapshots: ProjectionSnapshot[] }
    | Extract<CreateProjectionSnapshotResult, { ok: false }>
  > {
    const denied = await this.enforceReadOwnership(args);
    if (denied) return denied;

    let snapshots: ProjectionSnapshot[];
    if (args.lineageRootId) {
      snapshots = await this.deps.repository.listByLineageRoot(args.lineageRootId);
      snapshots = snapshots.filter(
        (s) => s.caseId === args.caseId && s.patientId === args.patientId
      );
    } else {
      snapshots = (await this.deps.repository.listByCase(args.caseId)).filter(
        (s) => s.patientId === args.patientId
      );
    }

    for (const s of snapshots) {
      await this.audit({
        eventType: "projection_snapshot_read",
        caseId: s.caseId,
        patientId: s.patientId,
        projectionId: s.id,
        actorId: args.actorId ?? null,
        metadata: { ...buildSnapshotAuditMetadata(s), operation: "list_lineage" },
      });
    }

    return { ok: true, snapshots };
  }

  /**
   * Refuse in-place mutation of frozen fields.
   * Only status / superseded_by may change via repository.applyMutableMetadata.
   */
  async attemptMutateFrozenProjection(
    _projectionId?: string,
    _forbiddenPatch?: Record<string, unknown>
  ): Promise<CreateProjectionSnapshotResult> {
    void _projectionId;
    void _forbiddenPatch;
    return {
      ok: false,
      code: "MUTATION_FORBIDDEN",
      reason:
        "Frozen projection fields cannot be mutated. Create a new snapshot to revise.",
    };
  }

  async verifyIntegrity(args: {
    projectionId: string;
    caseId: string;
    patientId: string;
    actorId?: string | null;
    skipOwnershipCheck?: boolean;
    caseRow?: CaseOwnershipRow | null;
  }): Promise<CreateProjectionSnapshotResult> {
    const loaded = await this.getProjectionById(args);
    if (!loaded.ok) return loaded;
    const integrity = verifyProjectionSnapshotIntegrity(loaded.snapshot);
    if (!integrity.ok) {
      await this.audit({
        eventType: "projection_snapshot_integrity_failed",
        caseId: loaded.snapshot.caseId,
        patientId: loaded.snapshot.patientId,
        projectionId: loaded.snapshot.id,
        actorId: args.actorId ?? null,
        metadata: {
          reason: integrity.reason,
          expected: integrity.expected,
          actual: integrity.actual,
        },
      });
      return { ok: false, code: "INTEGRITY_FAILED", reason: integrity.reason };
    }
    return loaded;
  }

  /**
   * Future longitudinal contract helper — does not persist observations yet.
   * Ensures comparisons always reference the original projection_id.
   */
  buildLongitudinalObservationReference(args: {
    snapshot: ProjectionSnapshot;
    observationTimepoint: LongitudinalObservationTimepoint;
    observationDate: string;
    measurementVersion?: string | null;
  }): LongitudinalObservationReference {
    return {
      projectionId: args.snapshot.id,
      procedureId: args.snapshot.procedureId,
      caseId: args.snapshot.caseId,
      observationTimepoint: args.observationTimepoint,
      observationDate: args.observationDate,
      measurementVersion: args.measurementVersion ?? null,
    };
  }

  private async returnRead(
    snapshot: ProjectionSnapshot,
    actorId: string | null
  ): Promise<CreateProjectionSnapshotResult> {
    const integrity = verifyProjectionSnapshotIntegrity(snapshot);
    if (!integrity.ok) {
      await this.audit({
        eventType: "projection_snapshot_integrity_failed",
        caseId: snapshot.caseId,
        patientId: snapshot.patientId,
        projectionId: snapshot.id,
        actorId,
        metadata: {
          reason: integrity.reason,
          expected: integrity.expected,
          actual: integrity.actual,
        },
      });
      return { ok: false, code: "INTEGRITY_FAILED", reason: integrity.reason };
    }
    await this.audit({
      eventType: "projection_snapshot_read",
      caseId: snapshot.caseId,
      patientId: snapshot.patientId,
      projectionId: snapshot.id,
      actorId,
      metadata: buildSnapshotAuditMetadata(snapshot),
    });
    return {
      ok: true,
      created: false,
      reused: false,
      snapshot,
      supersededPreviousId: null,
    };
  }

  private async enforceReadOwnership(args: {
    caseId: string;
    patientId: string;
    actorId?: string | null;
    skipOwnershipCheck?: boolean;
    caseRow?: CaseOwnershipRow | null;
  }): Promise<Extract<CreateProjectionSnapshotResult, { ok: false }> | null> {
    if (args.skipOwnershipCheck) return null;
    const caseRow =
      args.caseRow ??
      (this.deps.loadCaseOwnership ? await this.deps.loadCaseOwnership(args.caseId) : null);
    const ownership = validateCaseOwnership({
      caseId: args.caseId,
      patientId: args.patientId,
      caseRow,
    });
    if (!ownership.ok) {
      await this.audit({
        eventType: "projection_snapshot_read_denied",
        caseId: args.caseId,
        patientId: args.patientId,
        actorId: args.actorId ?? null,
        metadata: { reason: ownership.reason },
      });
      return { ok: false, code: "OWNERSHIP_MISMATCH", reason: ownership.reason };
    }
    return null;
  }

  private async audit(
    args: Parameters<typeof createAuditEvent>[0]
  ): Promise<void> {
    if (!this.deps.audit) return;
    await this.deps.audit.record(createAuditEvent(args));
  }
}

/** Convenience factory for tests / local domain use. */
export function createProjectionSnapshotService(
  deps: ProjectionSnapshotServiceDeps
): ProjectionSnapshotService {
  return new ProjectionSnapshotService(deps);
}
