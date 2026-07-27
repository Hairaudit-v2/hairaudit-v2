/**
 * HA-PROJECTION-1F — Bounded audit events for comparison snapshots.
 * Identifiers / versions / checksums only — never PHI bodies or signed URLs.
 */

import type { ProjectionComparisonSnapshot } from "./projectionComparisonTypes";

export type ProjectionComparisonAuditEventType =
  | "comparison_created"
  | "comparison_reused"
  | "comparison_superseded"
  | "comparison_lineage_rejected"
  | "comparison_ownership_rejected"
  | "comparison_invalid_stage"
  | "comparison_unsafe_rejected"
  | "comparison_read_denied";

export type ProjectionComparisonAuditEvent = {
  eventType: ProjectionComparisonAuditEventType;
  comparisonId: string | null;
  projectionSnapshotId: string | null;
  observationSnapshotId: string | null;
  caseId: string;
  patientId: string | null;
  actorId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ProjectionComparisonAuditSink = {
  record(event: ProjectionComparisonAuditEvent): void | Promise<void>;
};

export class InMemoryProjectionComparisonAuditSink
  implements ProjectionComparisonAuditSink
{
  readonly events: ProjectionComparisonAuditEvent[] = [];

  record(event: ProjectionComparisonAuditEvent): void {
    this.events.push(event);
  }
}

export function buildComparisonAuditMetadata(
  snapshot: Pick<
    ProjectionComparisonSnapshot,
    | "id"
    | "projectionSnapshotId"
    | "observationSnapshotId"
    | "stage"
    | "comparisonSchemaVersion"
    | "comparisonChecksum"
    | "comparisonStatus"
    | "supersedesComparisonId"
    | "supersessionReasonCode"
    | "comparisonPayload"
  >
): Record<string, unknown> {
  return {
    comparisonId: snapshot.id,
    projectionSnapshotId: snapshot.projectionSnapshotId,
    observationSnapshotId: snapshot.observationSnapshotId,
    stage: snapshot.stage,
    comparisonSchemaVersion: snapshot.comparisonSchemaVersion,
    comparisonChecksum: snapshot.comparisonChecksum,
    comparisonStatus: snapshot.comparisonStatus,
    supersedesComparisonId: snapshot.supersedesComparisonId,
    supersessionReasonCode: snapshot.supersessionReasonCode,
    overallStatus: snapshot.comparisonPayload.overallStatus,
  };
}

export function createComparisonAuditEvent(args: {
  eventType: ProjectionComparisonAuditEventType;
  caseId: string;
  patientId?: string | null;
  comparisonId?: string | null;
  projectionSnapshotId?: string | null;
  observationSnapshotId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  now?: string;
}): ProjectionComparisonAuditEvent {
  return {
    eventType: args.eventType,
    comparisonId: args.comparisonId ?? null,
    projectionSnapshotId: args.projectionSnapshotId ?? null,
    observationSnapshotId: args.observationSnapshotId ?? null,
    caseId: args.caseId,
    patientId: args.patientId ?? null,
    actorId: args.actorId ?? null,
    metadata: args.metadata ?? {},
    createdAt: args.now ?? new Date().toISOString(),
  };
}
