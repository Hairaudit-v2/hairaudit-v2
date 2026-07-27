/**
 * FI-OUTCOME-INTELLIGENCE-1C — Capture plan repository (in-memory + contract).
 */

import type { LongitudinalCapturePlanRecord } from "./longitudinalCaptureTypes";

export type CapturePlanIdempotencyKey = {
  projectionSnapshotId: string;
  capturePolicyVersion: string;
  captureProtocolVersion: string;
};

export type LongitudinalCapturePlanRepository = {
  findById(id: string): Promise<LongitudinalCapturePlanRecord | null>;
  findByIdempotencyKey(
    key: CapturePlanIdempotencyKey
  ): Promise<LongitudinalCapturePlanRecord | null>;
  findByProjectionSnapshotId(
    projectionSnapshotId: string
  ): Promise<LongitudinalCapturePlanRecord[]>;
  listAll(): Promise<LongitudinalCapturePlanRecord[]>;
  insert(
    record: LongitudinalCapturePlanRecord
  ): Promise<LongitudinalCapturePlanRecord>;
};

function clone(r: LongitudinalCapturePlanRecord): LongitudinalCapturePlanRecord {
  return structuredClone(r);
}

export class InMemoryLongitudinalCapturePlanRepository
  implements LongitudinalCapturePlanRepository
{
  private readonly byId = new Map<string, LongitudinalCapturePlanRecord>();

  async findById(id: string): Promise<LongitudinalCapturePlanRecord | null> {
    const row = this.byId.get(id);
    return row ? clone(row) : null;
  }

  async findByIdempotencyKey(
    key: CapturePlanIdempotencyKey
  ): Promise<LongitudinalCapturePlanRecord | null> {
    for (const row of this.byId.values()) {
      if (
        row.projectionSnapshotId === key.projectionSnapshotId &&
        row.capturePolicyVersion === key.capturePolicyVersion &&
        row.captureProtocolVersion === key.captureProtocolVersion
      ) {
        return clone(row);
      }
    }
    return null;
  }

  async findByProjectionSnapshotId(
    projectionSnapshotId: string
  ): Promise<LongitudinalCapturePlanRecord[]> {
    return [...this.byId.values()]
      .filter((r) => r.projectionSnapshotId === projectionSnapshotId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
      .map(clone);
  }

  async listAll(): Promise<LongitudinalCapturePlanRecord[]> {
    return [...this.byId.values()].map(clone);
  }

  async insert(
    record: LongitudinalCapturePlanRecord
  ): Promise<LongitudinalCapturePlanRecord> {
    if (this.byId.has(record.id)) {
      throw new Error(`Capture plan already exists: ${record.id}`);
    }
    const existing = await this.findByIdempotencyKey({
      projectionSnapshotId: record.projectionSnapshotId,
      capturePolicyVersion: record.capturePolicyVersion,
      captureProtocolVersion: record.captureProtocolVersion,
    });
    if (existing) {
      throw new Error("Capture plan idempotency key already exists");
    }
    this.byId.set(record.id, clone(record));
    return clone(record);
  }
}
