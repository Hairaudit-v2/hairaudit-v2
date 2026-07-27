/**
 * HA-PROJECTION-1D — Snapshot repository contract + in-memory implementation for tests.
 */

import type {
  ProjectionSnapshot,
  ProjectionSnapshotMutableMetadata,
} from "./projectionSnapshotTypes";
import type { SurgeryDayProjectionAssessmentType as AssessmentType } from "./types";

export type ProjectionSnapshotRepository = {
  findById(id: string): Promise<ProjectionSnapshot | null>;
  findByIdempotencyKey(key: {
    caseId: string;
    projectionType: AssessmentType;
    reconstructionVersion: string;
    projectionEngineVersion: string;
    snapshotSchemaVersion: string;
    reconstructionInputChecksum: string;
    projectionOutputChecksum: string;
  }): Promise<ProjectionSnapshot | null>;
  findCurrentActive(args: {
    caseId: string;
    projectionType?: AssessmentType | null;
  }): Promise<ProjectionSnapshot | null>;
  listByLineageRoot(lineageRootId: string): Promise<ProjectionSnapshot[]>;
  listByCase(caseId: string): Promise<ProjectionSnapshot[]>;
  insert(snapshot: ProjectionSnapshot): Promise<ProjectionSnapshot>;
  /**
   * Allowed post-commit mutations: status + superseded_by pointer only.
   * Must refuse any attempt to change frozen payload/checksum fields.
   */
  applyMutableMetadata(
    id: string,
    patch: ProjectionSnapshotMutableMetadata
  ): Promise<ProjectionSnapshot | null>;
};

function cloneSnapshot(s: ProjectionSnapshot): ProjectionSnapshot {
  return structuredClone(s);
}

export class InMemoryProjectionSnapshotRepository implements ProjectionSnapshotRepository {
  private readonly byId = new Map<string, ProjectionSnapshot>();

  async findById(id: string): Promise<ProjectionSnapshot | null> {
    const row = this.byId.get(id);
    return row ? cloneSnapshot(row) : null;
  }

  async findByIdempotencyKey(key: {
    caseId: string;
    projectionType: AssessmentType;
    reconstructionVersion: string;
    projectionEngineVersion: string;
    snapshotSchemaVersion: string;
    reconstructionInputChecksum: string;
    projectionOutputChecksum: string;
  }): Promise<ProjectionSnapshot | null> {
    for (const row of this.byId.values()) {
      if (
        row.caseId === key.caseId &&
        row.projectionType === key.projectionType &&
        row.reconstructionVersion === key.reconstructionVersion &&
        row.projectionEngineVersion === key.projectionEngineVersion &&
        row.snapshotSchemaVersion === key.snapshotSchemaVersion &&
        row.reconstructionInputChecksum === key.reconstructionInputChecksum &&
        row.projectionOutputChecksum === key.projectionOutputChecksum
      ) {
        return cloneSnapshot(row);
      }
    }
    return null;
  }

  async findCurrentActive(args: {
    caseId: string;
    projectionType?: AssessmentType | null;
  }): Promise<ProjectionSnapshot | null> {
    const matches = [...this.byId.values()]
      .filter(
        (r) =>
          r.caseId === args.caseId &&
          r.projectionStatus === "active" &&
          (!args.projectionType || r.projectionType === args.projectionType)
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return matches[0] ? cloneSnapshot(matches[0]) : null;
  }

  async listByLineageRoot(lineageRootId: string): Promise<ProjectionSnapshot[]> {
    return [...this.byId.values()]
      .filter((r) => r.lineageRootId === lineageRootId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
      .map(cloneSnapshot);
  }

  async listByCase(caseId: string): Promise<ProjectionSnapshot[]> {
    return [...this.byId.values()]
      .filter((r) => r.caseId === caseId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
      .map(cloneSnapshot);
  }

  async insert(snapshot: ProjectionSnapshot): Promise<ProjectionSnapshot> {
    if (this.byId.has(snapshot.id)) {
      throw new Error(`Projection snapshot already exists: ${snapshot.id}`);
    }
    this.byId.set(snapshot.id, cloneSnapshot(snapshot));
    return cloneSnapshot(snapshot);
  }

  async applyMutableMetadata(
    id: string,
    patch: ProjectionSnapshotMutableMetadata
  ): Promise<ProjectionSnapshot | null> {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const next: ProjectionSnapshot = {
      ...existing,
      ...(patch.projectionStatus !== undefined
        ? { projectionStatus: patch.projectionStatus }
        : {}),
      ...(patch.supersededByProjectionId !== undefined
        ? { supersededByProjectionId: patch.supersededByProjectionId }
        : {}),
    };
    this.byId.set(id, next);
    return cloneSnapshot(next);
  }
}
