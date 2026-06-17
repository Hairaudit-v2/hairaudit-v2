/**
 * FI image-intelligence result contract — Phase 3B scaffold
 *
 * Shape persisted by the worker in Phase 3C+. Phase 3B returns dry-run placeholders only.
 *
 * See: docs/hairaudit-v2-phase-3b-fi-image-intelligence-worker-scaffold.md
 */

export type FiImageIntelligenceClassificationStatus =
  | "pending"
  | "skipped"
  | "dry_run"
  | "classified"
  | "failed";

/** Worker output contract — no AI execution in Phase 3B. */
export interface FiImageIntelligenceResult {
  classification_status: FiImageIntelligenceClassificationStatus;
  canonical_photo_category: string;
  confidence: number | null;
  quality_status: string;
  protocol_status: string;
  model_provider: string | null;
  model_version: string | null;
  processed_at: string;
  dry_run: boolean;
  idempotency_key: string;
  source_case_id: string;
  source_upload_id: string;
}

export type BuildDryRunFiImageIntelligenceResultInput = {
  idempotency_key: string;
  source_case_id: string;
  source_upload_id: string;
  canonical_photo_category: string;
  processed_at?: string;
};

/** Placeholder result when worker is enabled but AI execution is deferred (Phase 3B). */
export function buildDryRunFiImageIntelligenceResult(
  input: BuildDryRunFiImageIntelligenceResultInput
): FiImageIntelligenceResult {
  return {
    classification_status: "dry_run",
    canonical_photo_category: input.canonical_photo_category,
    confidence: null,
    quality_status: "not_evaluated",
    protocol_status: "not_evaluated",
    model_provider: null,
    model_version: null,
    processed_at: input.processed_at ?? new Date().toISOString(),
    dry_run: true,
    idempotency_key: input.idempotency_key,
    source_case_id: input.source_case_id,
    source_upload_id: input.source_upload_id,
  };
}
