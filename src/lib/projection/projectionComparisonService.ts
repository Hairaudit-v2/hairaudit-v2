/**
 * HA-PROJECTION-1F — Canonical projected vs observed comparison domain service.
 *
 * Compares frozen 1D projection snapshots against linked frozen 1E observations.
 * No cohort analytics, surgeon ranking, or accuracy percentages.
 */

import { randomUUID } from "node:crypto";
import {
  buildProjectionObservedComparison,
  computeComparisonChecksum,
  resolveProjectionContentChecksum,
} from "./projectionComparison";
import {
  buildComparisonAuditMetadata,
  createComparisonAuditEvent,
  type ProjectionComparisonAuditSink,
} from "./projectionComparisonAudit";
import type { ProjectionComparisonRepository } from "./projectionComparisonRepository";
import type {
  CreateProjectionComparisonInput,
  CreateProjectionComparisonResult,
  ProjectionComparisonSnapshot,
} from "./projectionComparisonTypes";
import type { ProjectionObservationRepository } from "./projectionObservationRepository";
import type { ProjectionSnapshotRepository } from "./projectionSnapshotRepository";
import { validateCaseOwnership } from "./projectionSnapshotValidate";
import type { CaseOwnershipRow } from "./projectionSnapshotService";
import { LONGITUDINAL_OUTCOME_STAGES } from "./longitudinalEvidence";
import { COMPARISON_SCHEMA_VERSION } from "./versions";

export type ProjectionComparisonServiceDeps = {
  comparisonRepository: ProjectionComparisonRepository;
  observationRepository: ProjectionObservationRepository;
  projectionRepository: ProjectionSnapshotRepository;
  audit?: ProjectionComparisonAuditSink;
  loadCaseOwnership?: (caseId: string) => Promise<CaseOwnershipRow | null>;
};

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export class ProjectionComparisonService {
  constructor(private readonly deps: ProjectionComparisonServiceDeps) {}

  /**
   * Create (or idempotently reuse) an immutable comparison snapshot.
   */
  async createProjectionComparison(
    input: CreateProjectionComparisonInput,
    opts?: { caseRow?: CaseOwnershipRow | null; skipOwnershipCheck?: boolean }
  ): Promise<CreateProjectionComparisonResult> {
    const projection = await this.deps.projectionRepository.findById(
      input.projectionSnapshotId
    );
    if (!projection) {
      return {
        ok: false,
        code: "PROJECTION_NOT_FOUND",
        reason: "Projection snapshot not found.",
      };
    }

    const observation = await this.deps.observationRepository.findById(
      input.observationSnapshotId
    );
    if (!observation) {
      return {
        ok: false,
        code: "OBSERVATION_NOT_FOUND",
        reason: "Observation snapshot not found.",
      };
    }

    if (!LONGITUDINAL_OUTCOME_STAGES.includes(observation.stage)) {
      await this.audit({
        eventType: "comparison_invalid_stage",
        caseId: input.caseId,
        patientId: input.patientId,
        projectionSnapshotId: input.projectionSnapshotId,
        observationSnapshotId: input.observationSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: { stage: observation.stage },
      });
      return {
        ok: false,
        code: "INVALID_STAGE",
        reason: `Unsupported longitudinal stage: ${String(observation.stage)}`,
      };
    }

    // Explicit lineage — do not infer by case alone
    if (observation.projectionSnapshotId !== projection.id) {
      await this.audit({
        eventType: "comparison_lineage_rejected",
        caseId: input.caseId,
        patientId: input.patientId,
        projectionSnapshotId: input.projectionSnapshotId,
        observationSnapshotId: input.observationSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: {
          reason: "observation_projection_mismatch",
          observationProjectionSnapshotId: observation.projectionSnapshotId,
        },
      });
      return {
        ok: false,
        code: "LINEAGE_MISMATCH",
        reason: "Observation is not attached to the given projection snapshot.",
      };
    }

    if (
      projection.caseId !== input.caseId ||
      observation.caseId !== input.caseId ||
      projection.patientId !== input.patientId ||
      observation.patientId !== input.patientId
    ) {
      await this.audit({
        eventType: "comparison_ownership_rejected",
        caseId: input.caseId,
        patientId: input.patientId,
        projectionSnapshotId: input.projectionSnapshotId,
        observationSnapshotId: input.observationSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: { reason: "case_or_patient_mismatch" },
      });
      return {
        ok: false,
        code: "OWNERSHIP_MISMATCH",
        reason: "Projection/observation ownership does not match create input.",
      };
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
          eventType: "comparison_ownership_rejected",
          caseId: input.caseId,
          patientId: input.patientId,
          projectionSnapshotId: input.projectionSnapshotId,
          observationSnapshotId: input.observationSnapshotId,
          actorId: input.createdBy ?? null,
          metadata: { reason: ownership.reason },
        });
        return { ok: false, code: "OWNERSHIP_MISMATCH", reason: ownership.reason };
      }
    }

    const built = buildProjectionObservedComparison({
      projection,
      observation,
      generatedAt: input.now,
    });

    if (!built.ok) {
      if (built.code === "LINEAGE_MISMATCH") {
        await this.audit({
          eventType: "comparison_lineage_rejected",
          caseId: input.caseId,
          patientId: input.patientId,
          projectionSnapshotId: input.projectionSnapshotId,
          observationSnapshotId: input.observationSnapshotId,
          actorId: input.createdBy ?? null,
          metadata: { reason: built.reason },
        });
      } else if (built.code === "UNSAFE_COMPARISON") {
        await this.audit({
          eventType: "comparison_unsafe_rejected",
          caseId: input.caseId,
          patientId: input.patientId,
          projectionSnapshotId: input.projectionSnapshotId,
          observationSnapshotId: input.observationSnapshotId,
          actorId: input.createdBy ?? null,
          metadata: { reason: built.reason },
        });
      }
      return {
        ok: false,
        code: built.code,
        reason: built.reason,
      };
    }

    const projectionChecksum = resolveProjectionContentChecksum(projection);
    const comparisonChecksum = computeComparisonChecksum(built.comparison, {
      projectionChecksum,
      observationChecksum: observation.observationChecksum,
    });

    const existing = await this.deps.comparisonRepository.findByIdempotencyKey({
      projectionSnapshotId: projection.id,
      observationSnapshotId: observation.id,
      comparisonChecksum,
    });

    if (existing) {
      await this.audit({
        eventType: "comparison_reused",
        caseId: existing.caseId,
        patientId: existing.patientId,
        comparisonId: existing.id,
        projectionSnapshotId: existing.projectionSnapshotId,
        observationSnapshotId: existing.observationSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: buildComparisonAuditMetadata(existing),
      });
      return {
        ok: true,
        created: false,
        reused: true,
        snapshot: existing,
        supersededPreviousId: null,
      };
    }

    // Same projection+observation with different checksum → supersession (rule revision / correction)
    let supersedesId = input.supersedesComparisonId ?? null;
    const currentActive = await this.deps.comparisonRepository.findCurrentActive({
      projectionSnapshotId: projection.id,
      observationSnapshotId: observation.id,
    });
    const supersessionReason = input.supersessionReasonCode ?? null;

    if (currentActive && currentActive.comparisonChecksum !== comparisonChecksum) {
      if (!supersessionReason) {
        return {
          ok: false,
          code: "SUPERSESSION_INVALID",
          reason:
            "An active comparison exists for this projection+observation with different content; supersessionReasonCode is required.",
        };
      }
      supersedesId = supersedesId ?? currentActive.id;
    }

    if (supersedesId) {
      const prior = await this.deps.comparisonRepository.findById(supersedesId);
      if (!prior) {
        return {
          ok: false,
          code: "SUPERSESSION_INVALID",
          reason: "supersedesComparisonId not found.",
        };
      }
      if (
        prior.projectionSnapshotId !== projection.id ||
        prior.observationSnapshotId !== observation.id ||
        prior.caseId !== input.caseId ||
        prior.patientId !== input.patientId
      ) {
        return {
          ok: false,
          code: "SUPERSESSION_INVALID",
          reason: "Prior comparison ownership/lineage does not match.",
        };
      }
      if (!supersessionReason) {
        return {
          ok: false,
          code: "SUPERSESSION_INVALID",
          reason: "supersessionReasonCode is required when superseding.",
        };
      }
    }

    const now = input.now ?? new Date().toISOString();
    const id = input.id ?? randomUUID();

    const snapshot: ProjectionComparisonSnapshot = {
      id,
      projectionSnapshotId: projection.id,
      observationSnapshotId: observation.id,
      caseId: projection.caseId,
      patientId: projection.patientId,
      stage: observation.stage,
      comparisonStatus: "active",
      comparisonSchemaVersion: COMPARISON_SCHEMA_VERSION,
      projectionSchemaVersion: projection.snapshotSchemaVersion,
      observationSchemaVersion: observation.observationSchemaVersion,
      comparisonChecksum,
      comparisonPayload: deepClone(built.comparison),
      createdAt: now,
      createdBy: input.createdBy ?? null,
      supersedesComparisonId: supersedesId,
      supersededByComparisonId: null,
      supersessionReasonCode: supersessionReason,
    };

    const recomputed = computeComparisonChecksum(snapshot.comparisonPayload, {
      projectionChecksum,
      observationChecksum: observation.observationChecksum,
    });
    if (recomputed !== snapshot.comparisonChecksum) {
      return {
        ok: false,
        code: "INTEGRITY_FAILED",
        reason: "Comparison checksum integrity check failed before insert.",
      };
    }

    const inserted = await this.deps.comparisonRepository.insert(snapshot);

    let supersededPreviousId: string | null = null;
    if (supersedesId) {
      await this.deps.comparisonRepository.applyMutableMetadata(supersedesId, {
        comparisonStatus: "superseded",
        supersededByComparisonId: inserted.id,
      });
      supersededPreviousId = supersedesId;
      await this.audit({
        eventType: "comparison_superseded",
        caseId: inserted.caseId,
        patientId: inserted.patientId,
        comparisonId: supersedesId,
        projectionSnapshotId: inserted.projectionSnapshotId,
        observationSnapshotId: inserted.observationSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: {
          supersededByComparisonId: inserted.id,
          supersessionReasonCode: supersessionReason,
          stage: inserted.stage,
        },
      });
    }

    await this.audit({
      eventType: "comparison_created",
      caseId: inserted.caseId,
      patientId: inserted.patientId,
      comparisonId: inserted.id,
      projectionSnapshotId: inserted.projectionSnapshotId,
      observationSnapshotId: inserted.observationSnapshotId,
      actorId: input.createdBy ?? null,
      metadata: buildComparisonAuditMetadata(inserted),
    });

    return {
      ok: true,
      created: true,
      reused: false,
      snapshot: inserted,
      supersededPreviousId,
    };
  }

  async getComparisonById(args: {
    id: string;
    caseId: string;
    patientId: string;
  }): Promise<
    | { ok: true; snapshot: ProjectionComparisonSnapshot }
    | { ok: false; code: "NOT_FOUND" | "OWNERSHIP_MISMATCH"; reason: string }
  > {
    const snapshot = await this.deps.comparisonRepository.findById(args.id);
    if (!snapshot) {
      return { ok: false, code: "NOT_FOUND", reason: "Comparison not found." };
    }
    if (snapshot.caseId !== args.caseId || snapshot.patientId !== args.patientId) {
      await this.audit({
        eventType: "comparison_read_denied",
        caseId: args.caseId,
        patientId: args.patientId,
        comparisonId: args.id,
        projectionSnapshotId: snapshot.projectionSnapshotId,
        observationSnapshotId: snapshot.observationSnapshotId,
        metadata: { reason: "comparison_ownership_mismatch" },
      });
      return { ok: false, code: "OWNERSHIP_MISMATCH", reason: "Ownership mismatch." };
    }
    return { ok: true, snapshot };
  }

  async getCurrentComparisonForObservation(args: {
    projectionSnapshotId: string;
    observationSnapshotId: string;
    caseId: string;
    patientId: string;
  }): Promise<
    | { ok: true; snapshot: ProjectionComparisonSnapshot | null }
    | {
        ok: false;
        code: "OWNERSHIP_MISMATCH" | "PROJECTION_NOT_FOUND" | "OBSERVATION_NOT_FOUND";
        reason: string;
      }
  > {
    const projection = await this.deps.projectionRepository.findById(
      args.projectionSnapshotId
    );
    if (!projection) {
      return { ok: false, code: "PROJECTION_NOT_FOUND", reason: "Projection not found." };
    }
    const observation = await this.deps.observationRepository.findById(
      args.observationSnapshotId
    );
    if (!observation) {
      return { ok: false, code: "OBSERVATION_NOT_FOUND", reason: "Observation not found." };
    }
    if (
      projection.caseId !== args.caseId ||
      projection.patientId !== args.patientId ||
      observation.caseId !== args.caseId ||
      observation.patientId !== args.patientId
    ) {
      await this.audit({
        eventType: "comparison_read_denied",
        caseId: args.caseId,
        patientId: args.patientId,
        projectionSnapshotId: args.projectionSnapshotId,
        observationSnapshotId: args.observationSnapshotId,
        metadata: { reason: "ownership_mismatch" },
      });
      return { ok: false, code: "OWNERSHIP_MISMATCH", reason: "Ownership mismatch." };
    }
    const snapshot = await this.deps.comparisonRepository.findCurrentActive({
      projectionSnapshotId: args.projectionSnapshotId,
      observationSnapshotId: args.observationSnapshotId,
    });
    return { ok: true, snapshot };
  }

  /** Always refuse frozen payload mutation. */
  attemptMutateFrozenComparison(): CreateProjectionComparisonResult {
    return {
      ok: false,
      code: "MUTATION_FORBIDDEN",
      reason: "Comparison payloads are immutable; create a superseding row instead.",
    };
  }

  private async audit(args: Parameters<typeof createComparisonAuditEvent>[0]) {
    if (!this.deps.audit) return;
    await this.deps.audit.record(createComparisonAuditEvent(args));
  }
}

export function createProjectionComparisonService(
  deps: ProjectionComparisonServiceDeps
): ProjectionComparisonService {
  return new ProjectionComparisonService(deps);
}
