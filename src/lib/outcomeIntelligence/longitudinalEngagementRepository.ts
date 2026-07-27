/**
 * FI-OUTCOME-INTELLIGENCE-1D — Engagement event repository (in-memory + contract).
 */

import type { LongitudinalOutcomeStage } from "@/lib/projection/types";
import type {
  LongitudinalEngagementEventRecord,
  LongitudinalEngagementEventStatus,
  LongitudinalReminderEventType,
} from "./longitudinalEngagementTypes";

export type EngagementEventListFilter = {
  patientId?: string;
  projectionSnapshotId?: string;
  stage?: LongitudinalOutcomeStage;
  eventType?: LongitudinalReminderEventType;
  statuses?: LongitudinalEngagementEventStatus[];
  sinceDecisionAt?: string;
};

export type LongitudinalEngagementEventRepository = {
  findById(id: string): Promise<LongitudinalEngagementEventRecord | null>;
  findByDedupeKey(
    dedupeKey: string
  ): Promise<LongitudinalEngagementEventRecord | null>;
  list(filter?: EngagementEventListFilter): Promise<LongitudinalEngagementEventRecord[]>;
  insert(
    record: LongitudinalEngagementEventRecord
  ): Promise<LongitudinalEngagementEventRecord>;
  update(
    id: string,
    patch: Partial<LongitudinalEngagementEventRecord>
  ): Promise<LongitudinalEngagementEventRecord>;
};

function clone(
  r: LongitudinalEngagementEventRecord
): LongitudinalEngagementEventRecord {
  return structuredClone(r);
}

export class InMemoryLongitudinalEngagementEventRepository
  implements LongitudinalEngagementEventRepository
{
  private readonly byId = new Map<string, LongitudinalEngagementEventRecord>();
  private readonly byDedupe = new Map<string, string>();

  async findById(id: string): Promise<LongitudinalEngagementEventRecord | null> {
    const row = this.byId.get(id);
    return row ? clone(row) : null;
  }

  async findByDedupeKey(
    dedupeKey: string
  ): Promise<LongitudinalEngagementEventRecord | null> {
    const id = this.byDedupe.get(dedupeKey);
    if (!id) return null;
    return this.findById(id);
  }

  async list(
    filter?: EngagementEventListFilter
  ): Promise<LongitudinalEngagementEventRecord[]> {
    let rows = [...this.byId.values()];
    if (filter?.patientId) {
      rows = rows.filter((r) => r.patientId === filter.patientId);
    }
    if (filter?.projectionSnapshotId) {
      rows = rows.filter(
        (r) => r.projectionSnapshotId === filter.projectionSnapshotId
      );
    }
    if (filter?.stage) {
      rows = rows.filter((r) => r.stage === filter.stage);
    }
    if (filter?.eventType) {
      rows = rows.filter((r) => r.eventType === filter.eventType);
    }
    if (filter?.statuses?.length) {
      const set = new Set(filter.statuses);
      rows = rows.filter((r) => set.has(r.status));
    }
    if (filter?.sinceDecisionAt) {
      rows = rows.filter((r) => r.decisionAt >= filter.sinceDecisionAt!);
    }
    return rows
      .sort((a, b) =>
        a.decisionAt < b.decisionAt ? -1 : a.decisionAt > b.decisionAt ? 1 : 0
      )
      .map(clone);
  }

  async insert(
    record: LongitudinalEngagementEventRecord
  ): Promise<LongitudinalEngagementEventRecord> {
    if (this.byId.has(record.id)) {
      throw new Error(`Engagement event already exists: ${record.id}`);
    }
    if (this.byDedupe.has(record.dedupeKey)) {
      throw new Error("Engagement event dedupe key already exists");
    }
    this.byId.set(record.id, clone(record));
    this.byDedupe.set(record.dedupeKey, record.id);
    return clone(record);
  }

  async update(
    id: string,
    patch: Partial<LongitudinalEngagementEventRecord>
  ): Promise<LongitudinalEngagementEventRecord> {
    const existing = this.byId.get(id);
    if (!existing) throw new Error(`Engagement event not found: ${id}`);
    const next = {
      ...existing,
      ...patch,
      id: existing.id,
      dedupeKey: existing.dedupeKey,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    this.byId.set(id, clone(next));
    return clone(next);
  }
}
