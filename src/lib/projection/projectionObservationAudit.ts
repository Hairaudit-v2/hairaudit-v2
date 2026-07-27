/**
 * HA-PROJECTION-1E — Bounded audit events for observation snapshots.
 * Identifiers / versions / checksums only — never PHI bodies or signed URLs.
 */

import type { ProjectionObservationSnapshot } from "./projectionObservationTypes";

export type ProjectionObservationAuditEventType =
  | "observation_snapshot_created"
  | "observation_snapshot_reused"
  | "observation_snapshot_superseded"
  | "observation_ownership_rejected"
  | "observation_invalid_stage"
  | "observation_invalid_evidence"
  | "observation_read_denied";

export type ProjectionObservationAuditEvent = {
  eventType: ProjectionObservationAuditEventType;
  observationId: string | null;
  projectionSnapshotId: string | null;
  caseId: string;
  patientId: string | null;
  actorId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ProjectionObservationAuditSink = {
  record(event: ProjectionObservationAuditEvent): void | Promise<void>;
};

export class InMemoryProjectionObservationAuditSink
  implements ProjectionObservationAuditSink
{
  readonly events: ProjectionObservationAuditEvent[] = [];

  record(event: ProjectionObservationAuditEvent): void {
    this.events.push(event);
  }
}

export function buildObservationAuditMetadata(
  snapshot: Pick<
    ProjectionObservationSnapshot,
    | "id"
    | "projectionSnapshotId"
    | "stage"
    | "observationSchemaVersion"
    | "observationChecksum"
    | "observationStatus"
    | "supersedesObservationId"
    | "supersessionReasonCode"
  >
): Record<string, unknown> {
  return {
    observationId: snapshot.id,
    projectionSnapshotId: snapshot.projectionSnapshotId,
    stage: snapshot.stage,
    observationSchemaVersion: snapshot.observationSchemaVersion,
    observationChecksum: snapshot.observationChecksum,
    observationStatus: snapshot.observationStatus,
    supersedesObservationId: snapshot.supersedesObservationId,
    supersessionReasonCode: snapshot.supersessionReasonCode,
  };
}

export function createObservationAuditEvent(args: {
  eventType: ProjectionObservationAuditEventType;
  caseId: string;
  patientId?: string | null;
  observationId?: string | null;
  projectionSnapshotId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  now?: string;
}): ProjectionObservationAuditEvent {
  return {
    eventType: args.eventType,
    observationId: args.observationId ?? null,
    projectionSnapshotId: args.projectionSnapshotId ?? null,
    caseId: args.caseId,
    patientId: args.patientId ?? null,
    actorId: args.actorId ?? null,
    metadata: args.metadata ?? {},
    createdAt: args.now ?? new Date().toISOString(),
  };
}
