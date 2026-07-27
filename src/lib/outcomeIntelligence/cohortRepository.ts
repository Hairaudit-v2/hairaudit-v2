/**
 * FI-OUTCOME-INTELLIGENCE-1A — Cohort repository contract + in-memory impl.
 */

import type { OutcomeLongitudinalCohortRow } from "./cohortTypes";

export type CohortIdempotencyKey = {
  cohortProcedureKey: string;
  projectionSnapshotChecksum: string;
  observationSnapshotChecksum: string;
  comparisonSnapshotChecksum: string;
  projectionDomain: string;
  cohortSchemaVersion: string;
};

export type OutcomeCohortRepository = {
  findById(id: string): Promise<OutcomeLongitudinalCohortRow | null>;
  findByIdempotencyKey(
    key: CohortIdempotencyKey
  ): Promise<OutcomeLongitudinalCohortRow | null>;
  listCurrent(): Promise<OutcomeLongitudinalCohortRow[]>;
  listAll(): Promise<OutcomeLongitudinalCohortRow[]>;
  insert(row: OutcomeLongitudinalCohortRow): Promise<OutcomeLongitudinalCohortRow>;
  markSuperseded(args: {
    cohortProcedureKey: string;
    projectionSnapshotChecksum: string;
    observationSnapshotChecksum: string;
    projectionDomain: string;
    exceptComparisonChecksum: string;
    supersededAt: string;
  }): Promise<number>;
};

function clone(row: OutcomeLongitudinalCohortRow): OutcomeLongitudinalCohortRow {
  return structuredClone(row);
}

export class InMemoryOutcomeCohortRepository implements OutcomeCohortRepository {
  private readonly byId = new Map<string, OutcomeLongitudinalCohortRow>();

  async findById(id: string): Promise<OutcomeLongitudinalCohortRow | null> {
    const row = this.byId.get(id);
    return row ? clone(row) : null;
  }

  async findByIdempotencyKey(
    key: CohortIdempotencyKey
  ): Promise<OutcomeLongitudinalCohortRow | null> {
    for (const row of this.byId.values()) {
      if (
        row.cohortProcedureKey === key.cohortProcedureKey &&
        row.projectionSnapshotChecksum === key.projectionSnapshotChecksum &&
        row.observationSnapshotChecksum === key.observationSnapshotChecksum &&
        row.comparisonSnapshotChecksum === key.comparisonSnapshotChecksum &&
        row.projectionDomain === key.projectionDomain &&
        row.cohortSchemaVersion === key.cohortSchemaVersion
      ) {
        return clone(row);
      }
    }
    return null;
  }

  async listCurrent(): Promise<OutcomeLongitudinalCohortRow[]> {
    return [...this.byId.values()]
      .filter((r) => r.isCurrentSourceLineage)
      .map(clone);
  }

  async listAll(): Promise<OutcomeLongitudinalCohortRow[]> {
    return [...this.byId.values()].map(clone);
  }

  async insert(
    row: OutcomeLongitudinalCohortRow
  ): Promise<OutcomeLongitudinalCohortRow> {
    if (this.byId.has(row.id)) {
      throw new Error(`Cohort row already exists: ${row.id}`);
    }
    // Enforce unique idempotency
    const existing = await this.findByIdempotencyKey({
      cohortProcedureKey: row.cohortProcedureKey,
      projectionSnapshotChecksum: row.projectionSnapshotChecksum,
      observationSnapshotChecksum: row.observationSnapshotChecksum,
      comparisonSnapshotChecksum: row.comparisonSnapshotChecksum,
      projectionDomain: row.projectionDomain,
      cohortSchemaVersion: row.cohortSchemaVersion,
    });
    if (existing) {
      throw new Error("Cohort idempotency key already exists");
    }
    this.byId.set(row.id, clone(row));
    return clone(row);
  }

  async markSuperseded(args: {
    cohortProcedureKey: string;
    projectionSnapshotChecksum: string;
    observationSnapshotChecksum: string;
    projectionDomain: string;
    exceptComparisonChecksum: string;
    supersededAt: string;
  }): Promise<number> {
    let n = 0;
    for (const [id, row] of this.byId.entries()) {
      if (
        row.cohortProcedureKey === args.cohortProcedureKey &&
        row.projectionSnapshotChecksum === args.projectionSnapshotChecksum &&
        row.observationSnapshotChecksum === args.observationSnapshotChecksum &&
        row.projectionDomain === args.projectionDomain &&
        row.comparisonSnapshotChecksum !== args.exceptComparisonChecksum &&
        row.isCurrentSourceLineage
      ) {
        this.byId.set(id, {
          ...row,
          isCurrentSourceLineage: false,
          sourceSupersededAt: args.supersededAt,
        });
        n += 1;
      }
    }
    return n;
  }
}
