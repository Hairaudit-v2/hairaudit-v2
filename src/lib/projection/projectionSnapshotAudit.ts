/**
 * HA-PROJECTION-1D — Bounded audit events for projection snapshots.
 * Identifiers / versions / checksums only — never PHI bodies or signed URLs.
 */

import type { ProjectionSnapshot } from "./projectionSnapshotTypes";

export type ProjectionSnapshotAuditEventType =
  | "projection_snapshot_created"
  | "projection_snapshot_reused"
  | "projection_snapshot_superseded"
  | "projection_snapshot_read"
  | "projection_snapshot_read_denied"
  | "projection_snapshot_integrity_failed";

export type ProjectionSnapshotAuditEvent = {
  eventType: ProjectionSnapshotAuditEventType;
  projectionId: string | null;
  caseId: string;
  patientId: string | null;
  actorId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ProjectionSnapshotAuditSink = {
  record(event: ProjectionSnapshotAuditEvent): void | Promise<void>;
};

export class InMemoryProjectionSnapshotAuditSink implements ProjectionSnapshotAuditSink {
  readonly events: ProjectionSnapshotAuditEvent[] = [];

  record(event: ProjectionSnapshotAuditEvent): void {
    this.events.push(event);
  }
}

export function buildSnapshotAuditMetadata(
  snapshot: Pick<
    ProjectionSnapshot,
    | "id"
    | "reconstructionVersion"
    | "projectionEngineVersion"
    | "snapshotSchemaVersion"
    | "reconstructionInputChecksum"
    | "projectionOutputChecksum"
    | "projectionStatus"
    | "lineageRootId"
    | "supersedesProjectionId"
    | "supersessionReasonCode"
  >
): Record<string, unknown> {
  return {
    projectionId: snapshot.id,
    reconstructionVersion: snapshot.reconstructionVersion,
    projectionEngineVersion: snapshot.projectionEngineVersion,
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
    reconstructionInputChecksum: snapshot.reconstructionInputChecksum,
    projectionOutputChecksum: snapshot.projectionOutputChecksum,
    projectionStatus: snapshot.projectionStatus,
    lineageRootId: snapshot.lineageRootId,
    supersedesProjectionId: snapshot.supersedesProjectionId,
    supersessionReasonCode: snapshot.supersessionReasonCode,
  };
}

export function createAuditEvent(args: {
  eventType: ProjectionSnapshotAuditEventType;
  caseId: string;
  patientId?: string | null;
  projectionId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  now?: string;
}): ProjectionSnapshotAuditEvent {
  return {
    eventType: args.eventType,
    projectionId: args.projectionId ?? null,
    caseId: args.caseId,
    patientId: args.patientId ?? null,
    actorId: args.actorId ?? null,
    metadata: args.metadata ?? {},
    createdAt: args.now ?? new Date().toISOString(),
  };
}
