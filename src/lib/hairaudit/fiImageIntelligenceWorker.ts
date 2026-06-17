/**
 * FI image-intelligence worker lifecycle — Phase 3B scaffold, Phase 3C persistence
 *
 * Validates queued jobs, persists idempotency/results, returns dry-run placeholders.
 * No AI execution.
 *
 * See: docs/hairaudit-v2-phase-3b-fi-image-intelligence-worker-scaffold.md
 *      docs/hairaudit-v2-phase-3c-image-intelligence-persistence.md
 */

import {
  decideFiImageIntelligenceProcessedKey,
  markFiImageIntelligenceKeyProcessed,
} from "./fiImageIntelligenceIdempotency";
import {
  FI_IMAGE_INTELLIGENCE_SOURCE_SYSTEM,
  type FiImageIntelligenceInput,
} from "./fiImageIntelligenceBridge";
import {
  buildFiImageIntelligenceIdempotencyKey,
  type FiImageIntelligenceJobPayload,
} from "./fiImageIntelligenceQueue";
import { buildDryRunFiImageIntelligenceResult, type FiImageIntelligenceResult } from "./fiImageIntelligenceResult";
import {
  type FiImageIntelligencePersistenceAdapter,
  resolveFiImageIntelligencePersistence,
} from "./fiImageIntelligencePersistence";
import { canCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { gateUploadCaseStoragePath } from "./uploadStorage";
import { uploadEventPayloadIsSafe } from "./uploadEvents";

const LOG_PREFIX = "[hairaudit:fi-image-intelligence-worker]";

export type FiImageIntelligenceWorkerStatus = "skipped" | "dry_run" | "failed";

export type FiImageIntelligenceWorkerOutcome = {
  status: FiImageIntelligenceWorkerStatus;
  reason: string;
  idempotency_key?: string;
  result?: FiImageIntelligenceResult;
  storage_metadata_validated?: boolean;
  persistence_fallback?: boolean;
};

export type FiImageIntelligenceWorkerOptions = {
  /** Override env flag for tests. */
  workerEnabled?: boolean;
  /** Injectable persistence adapter; defaults to Supabase or in-memory fallback. */
  persistence?: FiImageIntelligencePersistenceAdapter;
  /** @deprecated Use `persistence` — retained for Phase 3B in-memory idempotency parity. */
  processedKeys?: Set<string>;
};

export function isFiImageIntelligenceWorkerEnabled(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env?.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED === "true"
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiImageIntelligenceInput(value: unknown): value is FiImageIntelligenceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return (
    input.source_system === FI_IMAGE_INTELLIGENCE_SOURCE_SYSTEM &&
    isNonEmptyString(input.source_event_name) &&
    isNonEmptyString(input.source_case_id) &&
    isNonEmptyString(input.source_upload_id) &&
    isNonEmptyString(input.storage_bucket) &&
    isNonEmptyString(input.storage_path) &&
    isNonEmptyString(input.canonical_photo_category) &&
    isNonEmptyString(input.metadata_version) &&
    isNonEmptyString(input.occurred_at)
  );
}

export type FiImageIntelligenceJobPayloadValidation =
  | { valid: true; payload: FiImageIntelligenceJobPayload }
  | { valid: false; reason: string };

/** Validate Inngest event data matches the Phase 3A job payload contract. */
export function validateFiImageIntelligenceJobPayload(
  data: unknown
): FiImageIntelligenceJobPayloadValidation {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, reason: "job payload must be an object" };
  }

  const record = data as Record<string, unknown>;
  if (!isNonEmptyString(record.idempotency_key)) {
    return { valid: false, reason: "missing or empty idempotency_key" };
  }
  if (!isNonEmptyString(record.enqueued_at)) {
    return { valid: false, reason: "missing or empty enqueued_at" };
  }
  if (!isFiImageIntelligenceInput(record.input)) {
    return { valid: false, reason: "invalid or incomplete input" };
  }

  const expectedKey = buildFiImageIntelligenceIdempotencyKey(
    record.input.source_case_id,
    record.input.source_upload_id
  );
  if (record.idempotency_key.trim() !== expectedKey) {
    return {
      valid: false,
      reason: "idempotency_key does not match case_id and upload_id",
    };
  }

  return {
    valid: true,
    payload: {
      idempotency_key: record.idempotency_key.trim(),
      input: record.input,
      enqueued_at: record.enqueued_at.trim(),
    },
  };
}

export type FiImageIntelligenceStorageMetadataValidation =
  | { valid: true; normalized_path: string }
  | { valid: false; reason: string };

/**
 * Validate storage metadata from the job payload only — no Supabase fetch.
 * Ensures bucket/path are present and path belongs to the source case.
 */
export function validateFiImageIntelligenceStorageMetadata(
  input: FiImageIntelligenceInput
): FiImageIntelligenceStorageMetadataValidation {
  const bucket = input.storage_bucket.trim();
  if (!bucket) {
    return { valid: false, reason: "storage_bucket is empty" };
  }

  const pathGate = gateUploadCaseStoragePath(input.source_case_id, input.storage_path);
  if (!pathGate.ok) {
    return { valid: false, reason: `storage_path invalid for case: ${pathGate.error}` };
  }

  return { valid: true, normalized_path: pathGate.normalizedPath };
}

async function shouldSkipDuplicateJob(
  idempotencyKey: string,
  persistence: FiImageIntelligencePersistenceAdapter,
  processedKeys?: Set<string>
): Promise<{ skip: true; reason: string } | { skip: false }> {
  const existing = await persistence.findProcessedJobByIdempotencyKey(idempotencyKey);
  if (existing) {
    return {
      skip: true,
      reason: `idempotency_key already processed: ${idempotencyKey}`,
    };
  }

  if (processedKeys) {
    const decision = decideFiImageIntelligenceProcessedKey(idempotencyKey, processedKeys);
    if (decision.action === "skip") {
      return { skip: true, reason: decision.reason };
    }
  }

  return { skip: false };
}

/**
 * Process one FI image-intelligence job. Persists idempotency and dry-run results.
 * Never calls AI providers; never throws upload-blocking errors.
 */
export async function processFiImageIntelligenceJob(
  data: unknown,
  options: FiImageIntelligenceWorkerOptions = {}
): Promise<FiImageIntelligenceWorkerOutcome> {
  const workerEnabled = options.workerEnabled ?? isFiImageIntelligenceWorkerEnabled();

  if (!workerEnabled) {
    return {
      status: "skipped",
      reason: "HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED is not true — worker scaffold only",
    };
  }

  const validation = validateFiImageIntelligenceJobPayload(data);
  if (!validation.valid) {
    if (process.env?.NODE_ENV !== "production") {
      console.warn(LOG_PREFIX, "invalid job payload", { reason: validation.reason });
    }
    return { status: "failed", reason: validation.reason };
  }

  const { payload } = validation;
  const persistence = resolveFiImageIntelligencePersistence(options.persistence);
  const usingMemoryFallback = !options.persistence && !canCreateSupabaseAdminClient();

  const duplicateCheck = await shouldSkipDuplicateJob(
    payload.idempotency_key,
    persistence,
    options.processedKeys
  );
  if (duplicateCheck.skip) {
    return {
      status: "skipped",
      reason: duplicateCheck.reason,
      idempotency_key: payload.idempotency_key,
    };
  }

  const processingResult = await persistence.markJobProcessing({
    idempotency_key: payload.idempotency_key,
    case_id: payload.input.source_case_id,
    upload_id: payload.input.source_upload_id,
    event_name: payload.input.source_event_name,
    source_system: payload.input.source_system,
  });

  if (!processingResult.ok) {
    if (process.env?.NODE_ENV !== "production") {
      console.warn(LOG_PREFIX, "markJobProcessing failed", {
        idempotency_key: payload.idempotency_key,
        error: processingResult.error,
      });
    }
    return {
      status: "failed",
      reason: "FI worker could not persist processing state",
      idempotency_key: payload.idempotency_key,
      persistence_fallback: usingMemoryFallback,
    };
  }

  if (!processingResult.created) {
    return {
      status: "skipped",
      reason: `idempotency_key already processed: ${payload.idempotency_key}`,
      idempotency_key: payload.idempotency_key,
    };
  }

  const failJob = async (reason: string): Promise<FiImageIntelligenceWorkerOutcome> => {
    const failedPersist = await persistence.markJobFailed({
      idempotency_key: payload.idempotency_key,
      error_message: reason,
    });
    if (!failedPersist.ok && process.env?.NODE_ENV !== "production") {
      console.warn(LOG_PREFIX, "markJobFailed failed", {
        idempotency_key: payload.idempotency_key,
        error: failedPersist.error,
      });
    }
    return {
      status: "failed",
      reason,
      idempotency_key: payload.idempotency_key,
      persistence_fallback: usingMemoryFallback,
    };
  };

  const safety = uploadEventPayloadIsSafe(payload.input as unknown as Record<string, unknown>);
  if (!safety.safe) {
    return failJob("FI worker input failed payload safety check");
  }

  const storageValidation = validateFiImageIntelligenceStorageMetadata(payload.input);
  if (!storageValidation.valid) {
    return failJob(storageValidation.reason);
  }

  const result = buildDryRunFiImageIntelligenceResult({
    idempotency_key: payload.idempotency_key,
    source_case_id: payload.input.source_case_id,
    source_upload_id: payload.input.source_upload_id,
    canonical_photo_category: payload.input.canonical_photo_category,
  });

  const completedPersist = await persistence.markJobCompleted({
    idempotency_key: payload.idempotency_key,
    result,
    processed_at: result.processed_at,
  });

  if (!completedPersist.ok && process.env?.NODE_ENV !== "production") {
    console.warn(LOG_PREFIX, "markJobCompleted failed", {
      idempotency_key: payload.idempotency_key,
      error: completedPersist.error,
    });
  }

  if (options.processedKeys) {
    markFiImageIntelligenceKeyProcessed(options.processedKeys, payload.idempotency_key);
  }

  return {
    status: "dry_run",
    reason: "worker enabled — dry-run placeholder (AI execution deferred to Phase 3D)",
    idempotency_key: payload.idempotency_key,
    result,
    storage_metadata_validated: true,
    persistence_fallback: usingMemoryFallback,
  };
}
