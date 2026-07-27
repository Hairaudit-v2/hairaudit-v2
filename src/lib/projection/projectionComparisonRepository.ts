/**
 * HA-PROJECTION-1F — Comparison repository contract + in-memory implementation.
 */

import type {
  ProjectionComparisonMutableMetadata,
  ProjectionComparisonSnapshot,
} from "./projectionComparisonTypes";

export type ProjectionComparisonRepository = {
  findById(id: string): Promise<ProjectionComparisonSnapshot | null>;
  findByIdempotencyKey(key: {
    projectionSnapshotId: string;
    observationSnapshotId: string;
    comparisonChecksum: string;
  }): Promise<ProjectionComparisonSnapshot | null>;
  findCurrentActive(args: {
    projectionSnapshotId: string;
    observationSnapshotId: string;
  }): Promise<ProjectionComparisonSnapshot | null>;
  listByProjection(projectionSnapshotId: string): Promise<ProjectionComparisonSnapshot[]>;
  listByObservation(observationSnapshotId: string): Promise<ProjectionComparisonSnapshot[]>;
  listByCase(caseId: string): Promise<ProjectionComparisonSnapshot[]>;
  insert(snapshot: ProjectionComparisonSnapshot): Promise<ProjectionComparisonSnapshot>;
  applyMutableMetadata(
    id: string,
    patch: ProjectionComparisonMutableMetadata
  ): Promise<ProjectionComparisonSnapshot | null>;
};

function clone(s: ProjectionComparisonSnapshot): ProjectionComparisonSnapshot {
  return structuredClone(s);
}

export class InMemoryProjectionComparisonRepository
  implements ProjectionComparisonRepository
{
  private readonly byId = new Map<string, ProjectionComparisonSnapshot>();

  async findById(id: string): Promise<ProjectionComparisonSnapshot | null> {
    const row = this.byId.get(id);
    return row ? clone(row) : null;
  }

  async findByIdempotencyKey(key: {
    projectionSnapshotId: string;
    observationSnapshotId: string;
    comparisonChecksum: string;
  }): Promise<ProjectionComparisonSnapshot | null> {
    for (const row of this.byId.values()) {
      if (
        row.projectionSnapshotId === key.projectionSnapshotId &&
        row.observationSnapshotId === key.observationSnapshotId &&
        row.comparisonChecksum === key.comparisonChecksum
      ) {
        return clone(row);
      }
    }
    return null;
  }

  async findCurrentActive(args: {
    projectionSnapshotId: string;
    observationSnapshotId: string;
  }): Promise<ProjectionComparisonSnapshot | null> {
    const matches = [...this.byId.values()]
      .filter(
        (r) =>
          r.projectionSnapshotId === args.projectionSnapshotId &&
          r.observationSnapshotId === args.observationSnapshotId &&
          r.comparisonStatus === "active"
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return matches[0] ? clone(matches[0]) : null;
  }

  async listByProjection(
    projectionSnapshotId: string
  ): Promise<ProjectionComparisonSnapshot[]> {
    return [...this.byId.values()]
      .filter((r) => r.projectionSnapshotId === projectionSnapshotId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
      .map(clone);
  }

  async listByObservation(
    observationSnapshotId: string
  ): Promise<ProjectionComparisonSnapshot[]> {
    return [...this.byId.values()]
      .filter((r) => r.observationSnapshotId === observationSnapshotId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
      .map(clone);
  }

  async listByCase(caseId: string): Promise<ProjectionComparisonSnapshot[]> {
    return [...this.byId.values()]
      .filter((r) => r.caseId === caseId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
      .map(clone);
  }

  async insert(
    snapshot: ProjectionComparisonSnapshot
  ): Promise<ProjectionComparisonSnapshot> {
    if (this.byId.has(snapshot.id)) {
      throw new Error(`Comparison snapshot already exists: ${snapshot.id}`);
    }
    this.byId.set(snapshot.id, clone(snapshot));
    return clone(snapshot);
  }

  async applyMutableMetadata(
    id: string,
    patch: ProjectionComparisonMutableMetadata
  ): Promise<ProjectionComparisonSnapshot | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const next: ProjectionComparisonSnapshot = {
      ...existing,
      comparisonStatus: patch.comparisonStatus ?? existing.comparisonStatus,
      supersededByComparisonId:
        patch.supersededByComparisonId !== undefined
          ? patch.supersededByComparisonId
          : existing.supersededByComparisonId,
    };
    this.byId.set(id, next);
    return clone(next);
  }
}
