/**
 * FI image-intelligence job persistence — Phase 3C
 *
 * Idempotency and dry-run result storage for the background worker.
 * Service-role Supabase writes; in-memory fallback when DB unavailable.
 *
 * See: docs/hairaudit-v2-phase-3c-image-intelligence-persistence.md
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

import type { FiImageIntelligenceResult } from "./fiImageIntelligenceResult";

export const FI_IMAGE_INTELLIGENCE_PROCESSED_JOBS_TABLE =
  "fi_image_intelligence_processed_jobs" as const;

export type FiImageIntelligenceJobPersistStatus = "processing" | "completed" | "failed";

export type FiImageIntelligenceProcessedJobRecord = {
  id: string;
  idempotency_key: string;
  case_id: string;
  upload_id: string;
  event_name: string;
  source_system: string;
  status: FiImageIntelligenceJobPersistStatus;
  result: FiImageIntelligenceResult | null;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FiImageIntelligencePersistenceAdapter = {
  findProcessedJobByIdempotencyKey(
    idempotencyKey: string
  ): Promise<FiImageIntelligenceProcessedJobRecord | null>;
  markJobProcessing(args: {
    idempotency_key: string;
    case_id: string;
    upload_id: string;
    event_name: string;
    source_system?: string;
  }): Promise<MarkJobProcessingResult>;
  markJobCompleted(args: {
    idempotency_key: string;
    result: FiImageIntelligenceResult;
    processed_at?: string;
  }): Promise<PersistMutationResult>;
  markJobFailed(args: {
    idempotency_key: string;
    error_message: string;
    processed_at?: string;
  }): Promise<PersistMutationResult>;
};

export type MarkJobProcessingResult =
  | { ok: true; record: FiImageIntelligenceProcessedJobRecord; created: boolean }
  | { ok: false; error: string };

export type PersistMutationResult = { ok: true } | { ok: false; error: string };

type DbRow = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJobRecord(row: DbRow): FiImageIntelligenceProcessedJobRecord {
  const resultRaw = row.result;
  return {
    id: String(row.id),
    idempotency_key: String(row.idempotency_key),
    case_id: String(row.case_id),
    upload_id: String(row.upload_id),
    event_name: String(row.event_name),
    source_system: String(row.source_system ?? "hairaudit"),
    status: row.status as FiImageIntelligenceJobPersistStatus,
    result:
      isRecord(resultRaw) ? (resultRaw as unknown as FiImageIntelligenceResult) : null,
    error_message: row.error_message != null ? String(row.error_message) : null,
    processed_at: row.processed_at != null ? String(row.processed_at) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function memoryJobId(idempotencyKey: string): string {
  return `memory:${idempotencyKey}`;
}

/** In-memory adapter for tests and DB-unavailable fallback. */
export function createMemoryFiImageIntelligencePersistence(): FiImageIntelligencePersistenceAdapter {
  const jobs = new Map<string, FiImageIntelligenceProcessedJobRecord>();

  return {
    async findProcessedJobByIdempotencyKey(idempotencyKey) {
      return jobs.get(idempotencyKey.trim()) ?? null;
    },

    async markJobProcessing(args) {
      const key = args.idempotency_key.trim();
      const existing = jobs.get(key);
      if (existing) {
        return { ok: true, record: existing, created: false };
      }

      const now = new Date().toISOString();
      const record: FiImageIntelligenceProcessedJobRecord = {
        id: memoryJobId(key),
        idempotency_key: key,
        case_id: args.case_id,
        upload_id: args.upload_id,
        event_name: args.event_name,
        source_system: args.source_system ?? "hairaudit",
        status: "processing",
        result: null,
        error_message: null,
        processed_at: null,
        created_at: now,
        updated_at: now,
      };
      jobs.set(key, record);
      return { ok: true, record, created: true };
    },

    async markJobCompleted(args) {
      const key = args.idempotency_key.trim();
      const existing = jobs.get(key);
      if (!existing) {
        return { ok: false, error: "job_not_found" };
      }

      const processedAt =
        args.processed_at ?? args.result.processed_at ?? new Date().toISOString();
      jobs.set(key, {
        ...existing,
        status: "completed",
        result: args.result,
        error_message: null,
        processed_at: processedAt,
        updated_at: processedAt,
      });
      return { ok: true };
    },

    async markJobFailed(args) {
      const key = args.idempotency_key.trim();
      const existing = jobs.get(key);
      if (!existing) {
        return { ok: false, error: "job_not_found" };
      }

      const processedAt = args.processed_at ?? new Date().toISOString();
      jobs.set(key, {
        ...existing,
        status: "failed",
        result: null,
        error_message: args.error_message,
        processed_at: processedAt,
        updated_at: processedAt,
      });
      return { ok: true };
    },
  };
}

/** Supabase service-role adapter for production worker persistence. */
export function createSupabaseFiImageIntelligencePersistence(
  admin: SupabaseClient
): FiImageIntelligencePersistenceAdapter {
  return {
    async findProcessedJobByIdempotencyKey(idempotencyKey) {
      const { data, error } = await admin
        .from(FI_IMAGE_INTELLIGENCE_PROCESSED_JOBS_TABLE)
        .select("*")
        .eq("idempotency_key", idempotencyKey.trim())
        .maybeSingle();

      if (error || !data || !isRecord(data)) return null;
      return parseJobRecord(data);
    },

    async markJobProcessing(args) {
      const key = args.idempotency_key.trim();
      const row = {
        idempotency_key: key,
        case_id: args.case_id,
        upload_id: args.upload_id,
        event_name: args.event_name,
        source_system: args.source_system ?? "hairaudit",
        status: "processing" as const,
      };

      const { data, error } = await admin
        .from(FI_IMAGE_INTELLIGENCE_PROCESSED_JOBS_TABLE)
        .insert(row)
        .select("*")
        .maybeSingle();

      if (!error && data && isRecord(data)) {
        return { ok: true, record: parseJobRecord(data), created: true };
      }

      if (error?.code === "23505") {
        const existing = await this.findProcessedJobByIdempotencyKey(key);
        if (existing) {
          return { ok: true, record: existing, created: false };
        }
      }

      if (error) {
        return { ok: false, error: error.message };
      }

      return { ok: false, error: "insert_failed" };
    },

    async markJobCompleted(args) {
      const processedAt =
        args.processed_at ?? args.result.processed_at ?? new Date().toISOString();
      const { error } = await admin
        .from(FI_IMAGE_INTELLIGENCE_PROCESSED_JOBS_TABLE)
        .update({
          status: "completed",
          result: args.result,
          error_message: null,
          processed_at: processedAt,
        })
        .eq("idempotency_key", args.idempotency_key.trim());

      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },

    async markJobFailed(args) {
      const processedAt = args.processed_at ?? new Date().toISOString();
      const { error } = await admin
        .from(FI_IMAGE_INTELLIGENCE_PROCESSED_JOBS_TABLE)
        .update({
          status: "failed",
          result: null,
          error_message: args.error_message,
          processed_at: processedAt,
        })
        .eq("idempotency_key", args.idempotency_key.trim());

      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  };
}

export function resolveFiImageIntelligencePersistence(
  override?: FiImageIntelligencePersistenceAdapter
): FiImageIntelligencePersistenceAdapter {
  if (override) return override;
  const admin = tryCreateSupabaseAdminClient();
  if (admin) return createSupabaseFiImageIntelligencePersistence(admin);
  return createMemoryFiImageIntelligencePersistence();
}

export async function findProcessedJobByIdempotencyKey(
  idempotencyKey: string,
  adapter?: FiImageIntelligencePersistenceAdapter
): Promise<FiImageIntelligenceProcessedJobRecord | null> {
  const persistence = resolveFiImageIntelligencePersistence(adapter);
  return persistence.findProcessedJobByIdempotencyKey(idempotencyKey);
}

export async function markJobProcessing(
  args: {
    idempotency_key: string;
    case_id: string;
    upload_id: string;
    event_name: string;
    source_system?: string;
  },
  adapter?: FiImageIntelligencePersistenceAdapter
): Promise<MarkJobProcessingResult> {
  const persistence = resolveFiImageIntelligencePersistence(adapter);
  return persistence.markJobProcessing(args);
}

export async function markJobCompleted(
  args: {
    idempotency_key: string;
    result: FiImageIntelligenceResult;
    processed_at?: string;
  },
  adapter?: FiImageIntelligencePersistenceAdapter
): Promise<PersistMutationResult> {
  const persistence = resolveFiImageIntelligencePersistence(adapter);
  return persistence.markJobCompleted(args);
}

export async function markJobFailed(
  args: {
    idempotency_key: string;
    error_message: string;
    processed_at?: string;
  },
  adapter?: FiImageIntelligencePersistenceAdapter
): Promise<PersistMutationResult> {
  const persistence = resolveFiImageIntelligencePersistence(adapter);
  return persistence.markJobFailed(args);
}
