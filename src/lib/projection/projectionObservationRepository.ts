/**
 * HA-PROJECTION-1E — Observation repository contract + in-memory implementation.
 */

import type { LongitudinalOutcomeStage } from "./types";
import type {
  ProjectionObservationMutableMetadata,
  ProjectionObservationSnapshot,
} from "./projectionObservationTypes";

export type ProjectionObservationRepository = {
  findById(id: string): Promise<ProjectionObservationSnapshot | null>;
  findByIdempotencyKey(key: {
    projectionSnapshotId: string;
    stage: LongitudinalOutcomeStage;
    observationChecksum: string;
  }): Promise<ProjectionObservationSnapshot | null>;
  findCurrentActive(args: {
    projectionSnapshotId: string;
    stage: LongitudinalOutcomeStage;
  }): Promise<ProjectionObservationSnapshot | null>;
  listByProjection(projectionSnapshotId: string): Promise<ProjectionObservationSnapshot[]>;
  listByCase(caseId: string): Promise<ProjectionObservationSnapshot[]>;
  insert(snapshot: ProjectionObservationSnapshot): Promise<ProjectionObservationSnapshot>;
  applyMutableMetadata(
    id: string,
    patch: ProjectionObservationMutableMetadata
  ): Promise<ProjectionObservationSnapshot | null>;
};

function clone(s: ProjectionObservationSnapshot): ProjectionObservationSnapshot {
  return structuredClone(s);
}

export class InMemoryProjectionObservationRepository
  implements ProjectionObservationRepository
{
  private readonly byId = new Map<string, ProjectionObservationSnapshot>();

  async findById(id: string): Promise<ProjectionObservationSnapshot | null> {
    const row = this.byId.get(id);
    return row ? clone(row) : null;
  }

  async findByIdempotencyKey(key: {
    projectionSnapshotId: string;
    stage: LongitudinalOutcomeStage;
    observationChecksum: string;
  }): Promise<ProjectionObservationSnapshot | null> {
    for (const row of this.byId.values()) {
      if (
        row.projectionSnapshotId === key.projectionSnapshotId &&
        row.stage === key.stage &&
        row.observationChecksum === key.observationChecksum
      ) {
        return clone(row);
      }
    }
    return null;
  }

  async findCurrentActive(args: {
    projectionSnapshotId: string;
    stage: LongitudinalOutcomeStage;
  }): Promise<ProjectionObservationSnapshot | null> {
    const matches = [...this.byId.values()]
      .filter(
        (r) =>
          r.projectionSnapshotId === args.projectionSnapshotId &&
          r.stage === args.stage &&
          r.observationStatus === "active"
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return matches[0] ? clone(matches[0]) : null;
  }

  async listByProjection(
    projectionSnapshotId: string
  ): Promise<ProjectionObservationSnapshot[]> {
    return [...this.byId.values()]
      .filter((r) => r.projectionSnapshotId === projectionSnapshotId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
      .map(clone);
  }

  async listByCase(caseId: string): Promise<ProjectionObservationSnapshot[]> {
    return [...this.byId.values()]
      .filter((r) => r.caseId === caseId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
      .map(clone);
  }

  async insert(
    snapshot: ProjectionObservationSnapshot
  ): Promise<ProjectionObservationSnapshot> {
    if (this.byId.has(snapshot.id)) {
      throw new Error(`Observation snapshot already exists: ${snapshot.id}`);
    }
    this.byId.set(snapshot.id, clone(snapshot));
    return clone(snapshot);
  }

  async applyMutableMetadata(
    id: string,
    patch: ProjectionObservationMutableMetadata
  ): Promise<ProjectionObservationSnapshot | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const next: ProjectionObservationSnapshot = {
      ...existing,
      observationStatus: patch.observationStatus ?? existing.observationStatus,
      supersededByObservationId:
        patch.supersededByObservationId !== undefined
          ? patch.supersededByObservationId
          : existing.supersededByObservationId,
    };
    this.byId.set(id, next);
    return clone(next);
  }
}
