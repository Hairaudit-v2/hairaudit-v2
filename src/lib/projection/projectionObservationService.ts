/**
 * HA-PROJECTION-1E — Canonical longitudinal observation domain service.
 *
 * Creates immutable observed outcome snapshots attached to frozen 1D projections.
 * No projected-vs-observed comparison.
 */

import { randomUUID } from "node:crypto";
import { checksumCanonical } from "./canonicalChecksum";
import {
  LONGITUDINAL_OUTCOME_STAGES,
} from "./longitudinalEvidence";
import {
  buildLongitudinalOutcomeObservation,
  type BuildLongitudinalOutcomeObservationInput,
} from "./longitudinalOutcomeObservation";
import {
  assertPatientSafeLongitudinalObservation,
} from "./longitudinalObservationSafety";
import {
  buildObservationAuditMetadata,
  createObservationAuditEvent,
  type ProjectionObservationAuditSink,
} from "./projectionObservationAudit";
import type { ProjectionObservationRepository } from "./projectionObservationRepository";
import type {
  CreateProjectionObservationInput,
  CreateProjectionObservationResult,
  ProjectionObservationSnapshot,
} from "./projectionObservationTypes";
import type { ProjectionSnapshotRepository } from "./projectionSnapshotRepository";
import { validateCaseOwnership } from "./projectionSnapshotValidate";
import type { CaseOwnershipRow } from "./projectionSnapshotService";
import type { LongitudinalOutcomeObservation, LongitudinalOutcomeStage } from "./types";
import {
  OBSERVATION_LINEAGE_VERSION,
  OBSERVATION_SCHEMA_VERSION,
} from "./versions";

export type ProjectionObservationServiceDeps = {
  observationRepository: ProjectionObservationRepository;
  /** Required to verify projection exists and ownership matches. */
  projectionRepository: ProjectionSnapshotRepository;
  audit?: ProjectionObservationAuditSink;
  loadCaseOwnership?: (caseId: string) => Promise<CaseOwnershipRow | null>;
};

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function isLongitudinalOutcomeObservation(
  value: unknown
): value is LongitudinalOutcomeObservation {
  if (!value || typeof value !== "object") return false;
  const o = value as LongitudinalOutcomeObservation;
  if (!o.projectionSnapshotId || !o.caseId || !o.patientId) return false;
  if (!LONGITUDINAL_OUTCOME_STAGES.includes(o.stage as LongitudinalOutcomeStage)) return false;
  if (!o.evidence || !Array.isArray(o.evidence.presentRoles)) return false;
  if (!o.recipient || !o.nativeHair || !o.healing) return false;
  if (!Array.isArray(o.overallObservations) || !Array.isArray(o.limitations)) return false;
  return true;
}

function collectObservationTexts(o: LongitudinalOutcomeObservation): string[] {
  const texts: string[] = [...o.limitations, ...o.evidence.limitations];
  const push = (f: { label: string; observation: string } | null | undefined) => {
    if (f) texts.push(f.label, f.observation);
  };
  push(o.recipient.frontalAppearance);
  push(o.recipient.densityAppearance);
  push(o.recipient.transitionAppearance);
  push(o.recipient.directionalAppearance);
  push(o.recipient.crownAppearance);
  if (o.donor) {
    push(o.donor.donorAppearance);
    push(o.donor.visibleDepletionPattern);
    push(o.donor.visibleScarring);
  }
  push(o.nativeHair.visibleNativeHairStatus);
  push(o.nativeHair.treatedVsUntreatedRelationship);
  push(o.healing.visibleHealingStatus);
  for (const c of o.healing.visibleConcerns) push(c);
  for (const ov of o.overallObservations) push(ov);
  return texts;
}

/** Domain payload hashed for idempotency — excludes volatile observedAt when hashing identity. */
export function observationChecksumDomain(
  observation: LongitudinalOutcomeObservation
): unknown {
  const rest = { ...observation };
  delete (rest as { observedAt?: string }).observedAt;
  return rest;
}

export function computeObservationChecksum(
  observation: LongitudinalOutcomeObservation
): string {
  return checksumCanonical(observationChecksumDomain(observation));
}

export class ProjectionObservationService {
  constructor(private readonly deps: ProjectionObservationServiceDeps) {}

  /**
   * Create (or idempotently reuse) an immutable longitudinal observation snapshot.
   */
  async createLongitudinalObservation(
    input: CreateProjectionObservationInput,
    opts?: { caseRow?: CaseOwnershipRow | null; skipOwnershipCheck?: boolean }
  ): Promise<CreateProjectionObservationResult> {
    if (!LONGITUDINAL_OUTCOME_STAGES.includes(input.stage)) {
      await this.audit({
        eventType: "observation_invalid_stage",
        caseId: input.caseId,
        patientId: input.patientId,
        projectionSnapshotId: input.projectionSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: { stage: input.stage },
      });
      return {
        ok: false,
        code: "INVALID_STAGE",
        reason: `Unsupported longitudinal stage: ${String(input.stage)}`,
      };
    }

    if (!isLongitudinalOutcomeObservation(input.observation)) {
      await this.audit({
        eventType: "observation_invalid_evidence",
        caseId: input.caseId,
        patientId: input.patientId,
        projectionSnapshotId: input.projectionSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: { reason: "invalid_observation_shape" },
      });
      return {
        ok: false,
        code: "INVALID_OBSERVATION",
        reason: "Invalid LongitudinalOutcomeObservation payload.",
      };
    }

    // Enforce observation identity matches create input
    if (input.observation.projectionSnapshotId !== input.projectionSnapshotId) {
      return {
        ok: false,
        code: "INVALID_OBSERVATION",
        reason: "Observation projectionSnapshotId does not match create input.",
      };
    }
    if (
      input.observation.caseId !== input.caseId ||
      input.observation.patientId !== input.patientId
    ) {
      return {
        ok: false,
        code: "OWNERSHIP_MISMATCH",
        reason: "Observation case/patient does not match create input.",
      };
    }
    if (input.observation.stage !== input.stage) {
      await this.audit({
        eventType: "observation_invalid_stage",
        caseId: input.caseId,
        patientId: input.patientId,
        projectionSnapshotId: input.projectionSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: {
          inputStage: input.stage,
          observationStage: input.observation.stage,
        },
      });
      return {
        ok: false,
        code: "INVALID_STAGE",
        reason: "Observation stage does not match create input stage.",
      };
    }

    const safety = assertPatientSafeLongitudinalObservation(
      collectObservationTexts(input.observation)
    );
    if (!safety.ok) {
      return {
        ok: false,
        code: "INVALID_OBSERVATION",
        reason: `Observation failed patient-safe checks (${safety.violations.length} violation(s)).`,
      };
    }

    // Verify projection exists and ownership
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
    if (projection.caseId !== input.caseId) {
      await this.audit({
        eventType: "observation_ownership_rejected",
        caseId: input.caseId,
        patientId: input.patientId,
        projectionSnapshotId: input.projectionSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: { reason: "projection_case_mismatch" },
      });
      return {
        ok: false,
        code: "OWNERSHIP_MISMATCH",
        reason: "Projection snapshot does not belong to the given case.",
      };
    }
    if (projection.patientId !== input.patientId) {
      await this.audit({
        eventType: "observation_ownership_rejected",
        caseId: input.caseId,
        patientId: input.patientId,
        projectionSnapshotId: input.projectionSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: { reason: "projection_patient_mismatch" },
      });
      return {
        ok: false,
        code: "OWNERSHIP_MISMATCH",
        reason: "Projection snapshot patient does not match.",
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
          eventType: "observation_ownership_rejected",
          caseId: input.caseId,
          patientId: input.patientId,
          projectionSnapshotId: input.projectionSnapshotId,
          actorId: input.createdBy ?? null,
          metadata: { reason: ownership.reason },
        });
        return { ok: false, code: "OWNERSHIP_MISMATCH", reason: ownership.reason };
      }
    }

    const observationChecksum = computeObservationChecksum(input.observation);

    const existing = await this.deps.observationRepository.findByIdempotencyKey({
      projectionSnapshotId: input.projectionSnapshotId,
      stage: input.stage,
      observationChecksum,
    });

    if (existing) {
      await this.audit({
        eventType: "observation_snapshot_reused",
        caseId: existing.caseId,
        patientId: existing.patientId,
        observationId: existing.id,
        projectionSnapshotId: existing.projectionSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: buildObservationAuditMetadata(existing),
      });
      return {
        ok: true,
        created: false,
        reused: true,
        snapshot: existing,
        supersededPreviousId: null,
      };
    }

    // Supersession for same projection + stage when content differs
    let supersedesId = input.supersedesObservationId ?? null;
    const currentActive = await this.deps.observationRepository.findCurrentActive({
      projectionSnapshotId: input.projectionSnapshotId,
      stage: input.stage,
    });

    const supersessionReason = input.supersessionReasonCode ?? null;
    if (currentActive && currentActive.observationChecksum !== observationChecksum) {
      if (!supersessionReason) {
        return {
          ok: false,
          code: "SUPERSESSION_INVALID",
          reason:
            "An active observation exists for this projection+stage with different content; supersessionReasonCode is required.",
        };
      }
      supersedesId = supersedesId ?? currentActive.id;
    }

    if (supersedesId) {
      const prior = await this.deps.observationRepository.findById(supersedesId);
      if (!prior) {
        return {
          ok: false,
          code: "SUPERSESSION_INVALID",
          reason: "supersedesObservationId not found.",
        };
      }
      if (
        prior.projectionSnapshotId !== input.projectionSnapshotId ||
        prior.caseId !== input.caseId ||
        prior.patientId !== input.patientId ||
        prior.stage !== input.stage
      ) {
        return {
          ok: false,
          code: "SUPERSESSION_INVALID",
          reason: "Prior observation ownership/stage does not match.",
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
    const observedAt = input.observedAt ?? input.observation.observedAt ?? now;

    const snapshot: ProjectionObservationSnapshot = {
      id,
      projectionSnapshotId: input.projectionSnapshotId,
      caseId: input.caseId,
      patientId: input.patientId,
      stage: input.stage,
      observedAt,
      observationStatus: "active",
      observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
      observationLineageVersion: OBSERVATION_LINEAGE_VERSION,
      observationChecksum,
      observationPayload: deepClone(input.observation),
      createdAt: now,
      createdBy: input.createdBy ?? null,
      supersedesObservationId: supersedesId,
      supersededByObservationId: null,
      supersessionReasonCode: supersessionReason,
      sourceReportId: input.sourceReportId ?? null,
      sourceAuditId: input.sourceAuditId ?? null,
    };

    // Integrity: re-hash must match
    const recomputed = computeObservationChecksum(snapshot.observationPayload);
    if (recomputed !== snapshot.observationChecksum) {
      return {
        ok: false,
        code: "INTEGRITY_FAILED",
        reason: "Observation checksum integrity check failed before insert.",
      };
    }

    const inserted = await this.deps.observationRepository.insert(snapshot);

    let supersededPreviousId: string | null = null;
    if (supersedesId) {
      await this.deps.observationRepository.applyMutableMetadata(supersedesId, {
        observationStatus: "superseded",
        supersededByObservationId: inserted.id,
      });
      supersededPreviousId = supersedesId;
      await this.audit({
        eventType: "observation_snapshot_superseded",
        caseId: inserted.caseId,
        patientId: inserted.patientId,
        observationId: supersedesId,
        projectionSnapshotId: inserted.projectionSnapshotId,
        actorId: input.createdBy ?? null,
        metadata: {
          supersededByObservationId: inserted.id,
          supersessionReasonCode: supersessionReason,
          stage: inserted.stage,
        },
      });
    }

    await this.audit({
      eventType: "observation_snapshot_created",
      caseId: inserted.caseId,
      patientId: inserted.patientId,
      observationId: inserted.id,
      projectionSnapshotId: inserted.projectionSnapshotId,
      actorId: input.createdBy ?? null,
      metadata: buildObservationAuditMetadata(inserted),
    });

    return {
      ok: true,
      created: true,
      reused: false,
      snapshot: inserted,
      supersededPreviousId,
    };
  }

  /**
   * Build + persist from uploads/context (thin orchestration helper).
   */
  async createProjectionOutcomeObservation(
    args: BuildLongitudinalOutcomeObservationInput & {
      createdBy?: string | null;
      sourceReportId?: string | null;
      sourceAuditId?: string | null;
      supersedesObservationId?: string | null;
      supersessionReasonCode?: CreateProjectionObservationInput["supersessionReasonCode"];
      now?: string;
      id?: string;
      caseRow?: CaseOwnershipRow | null;
      skipOwnershipCheck?: boolean;
    }
  ): Promise<CreateProjectionObservationResult> {
    const built = buildLongitudinalOutcomeObservation(args);
    if (!built.ok) {
      await this.audit({
        eventType: "observation_invalid_evidence",
        caseId: args.caseId,
        patientId: args.patientId,
        projectionSnapshotId: args.projectionSnapshotId,
        actorId: args.createdBy ?? null,
        metadata: { reason: built.reason },
      });
      return { ok: false, code: "INVALID_EVIDENCE", reason: built.reason };
    }

    return this.createLongitudinalObservation(
      {
        projectionSnapshotId: args.projectionSnapshotId,
        caseId: args.caseId,
        patientId: args.patientId,
        stage: args.stage,
        observation: built.observation,
        observedAt: args.observedAt,
        createdBy: args.createdBy,
        sourceReportId: args.sourceReportId,
        sourceAuditId: args.sourceAuditId,
        supersedesObservationId: args.supersedesObservationId,
        supersessionReasonCode: args.supersessionReasonCode,
        now: args.now,
        id: args.id,
      },
      { caseRow: args.caseRow, skipOwnershipCheck: args.skipOwnershipCheck }
    );
  }

  async getCurrentObservation(args: {
    projectionSnapshotId: string;
    stage: LongitudinalOutcomeStage;
    caseId: string;
    patientId: string;
  }): Promise<
    | { ok: true; snapshot: ProjectionObservationSnapshot | null }
    | { ok: false; code: "OWNERSHIP_MISMATCH" | "PROJECTION_NOT_FOUND"; reason: string }
  > {
    const projection = await this.deps.projectionRepository.findById(
      args.projectionSnapshotId
    );
    if (!projection) {
      return { ok: false, code: "PROJECTION_NOT_FOUND", reason: "Projection not found." };
    }
    if (projection.caseId !== args.caseId || projection.patientId !== args.patientId) {
      await this.audit({
        eventType: "observation_read_denied",
        caseId: args.caseId,
        patientId: args.patientId,
        projectionSnapshotId: args.projectionSnapshotId,
        metadata: { reason: "projection_ownership_mismatch" },
      });
      return { ok: false, code: "OWNERSHIP_MISMATCH", reason: "Ownership mismatch." };
    }
    const snapshot = await this.deps.observationRepository.findCurrentActive({
      projectionSnapshotId: args.projectionSnapshotId,
      stage: args.stage,
    });
    return { ok: true, snapshot };
  }

  async getObservationById(args: {
    id: string;
    caseId: string;
    patientId: string;
  }): Promise<
    | { ok: true; snapshot: ProjectionObservationSnapshot }
    | { ok: false; code: "NOT_FOUND" | "OWNERSHIP_MISMATCH"; reason: string }
  > {
    const snapshot = await this.deps.observationRepository.findById(args.id);
    if (!snapshot) {
      return { ok: false, code: "NOT_FOUND", reason: "Observation not found." };
    }
    if (snapshot.caseId !== args.caseId || snapshot.patientId !== args.patientId) {
      await this.audit({
        eventType: "observation_read_denied",
        caseId: args.caseId,
        patientId: args.patientId,
        observationId: args.id,
        projectionSnapshotId: snapshot.projectionSnapshotId,
        metadata: { reason: "observation_ownership_mismatch" },
      });
      return { ok: false, code: "OWNERSHIP_MISMATCH", reason: "Ownership mismatch." };
    }
    return { ok: true, snapshot };
  }

  /** Always refuse frozen payload mutation. */
  attemptMutateFrozenObservation(): CreateProjectionObservationResult {
    return {
      ok: false,
      code: "MUTATION_FORBIDDEN",
      reason: "Observation payloads are immutable; create a superseding row instead.",
    };
  }

  private async audit(args: Parameters<typeof createObservationAuditEvent>[0]) {
    if (!this.deps.audit) return;
    await this.deps.audit.record(createObservationAuditEvent(args));
  }
}

export function createProjectionObservationService(
  deps: ProjectionObservationServiceDeps
): ProjectionObservationService {
  return new ProjectionObservationService(deps);
}
