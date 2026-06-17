/**
 * Upload storage helpers — Phase 2B / 2C / 2D
 *
 * Centralizes bucket resolution and case-scoped path validation for upload
 * write/read/delete routes, signed URL generation, background jobs, and report
 * rendering.
 *
 * Path rules delegate to `@/lib/uploads/caseFilesPath` (cases/{caseId}/… and
 * audit_photos/{caseId}/…). Legacy `{userId}/{caseId}/` paths are rejected.
 *
 * See: docs/hairaudit-v2-phase-2a-upload-architecture-map.md
 * Path alignment: docs/hairaudit-v2-phase-2d-storage-path-alignment-plan.md
 */

import {
  isWellFormedCaseId,
  parseCaseIdFromCaseFilesPath,
  storagePathBelongsToCase,
} from "@/lib/uploads/caseFilesPath";

/** Default Supabase storage bucket when `CASE_FILES_BUCKET` is unset (local/dev). */
export const DEFAULT_CASE_FILES_BUCKET = "case-files";

/** Bucket names permitted for forensic case-file uploads/deletes. */
const ALLOWED_CASE_FILES_BUCKETS = new Set<string>([DEFAULT_CASE_FILES_BUCKET]);

export type CaseFilesBucketResolveResult =
  | { ok: true; bucket: string; source: "env" | "default" }
  | { ok: false; error: string };

/**
 * Resolve the case-files bucket from environment with validation.
 * Never throws — callers map `{ ok: false }` to a safe HTTP error.
 */
export function resolveCaseFilesBucket(): CaseFilesBucketResolveResult {
  const configured = process.env.CASE_FILES_BUCKET?.trim();

  if (configured) {
    if (!ALLOWED_CASE_FILES_BUCKETS.has(configured)) {
      return { ok: false, error: "Storage is not configured correctly" };
    }
    return { ok: true, bucket: configured, source: "env" };
  }

  return { ok: true, bucket: DEFAULT_CASE_FILES_BUCKET, source: "default" };
}

/**
 * Strict resolver for callers that require an explicit env bucket (tests / ops checks).
 */
export function requireConfiguredCaseFilesBucket(): CaseFilesBucketResolveResult {
  const configured = process.env.CASE_FILES_BUCKET?.trim();
  if (!configured) {
    return { ok: false, error: "Storage bucket is not configured" };
  }
  if (!ALLOWED_CASE_FILES_BUCKETS.has(configured)) {
    return { ok: false, error: "Invalid storage bucket configuration" };
  }
  return { ok: true, bucket: configured, source: "env" };
}

export type CaseFilesBucketRouteResult =
  | { ok: true; bucket: string }
  | { ok: false; status: 503; error: string };

/** Maps bucket resolver failures to a safe HTTP response for upload routes. */
export function resolveCaseFilesBucketForRoute(): CaseFilesBucketRouteResult {
  const result = resolveCaseFilesBucket();
  if (!result.ok) {
    return { ok: false, status: 503, error: "Storage is unavailable" };
  }
  return { ok: true, bucket: result.bucket };
}

export type CaseFilesBucketServerJobResult =
  | { ok: true; bucket: string }
  | { ok: false; error: string };

/**
 * Resolve bucket for Inngest / background jobs. Non-throwing — callers should
 * fail the step when `{ ok: false }` so misconfiguration is visible in job logs.
 */
export function resolveCaseFilesBucketForServerJob(): CaseFilesBucketServerJobResult {
  return resolveCaseFilesBucket();
}

/**
 * Resolve bucket for PDF/report rendering pipelines. Same validation as
 * {@link resolveCaseFilesBucket}; callers map failures to job or HTTP errors.
 */
export function resolveCaseFilesBucketForReportRender(): CaseFilesBucketResolveResult {
  return resolveCaseFilesBucket();
}

/**
 * Bucket name for server-side read/download/sign when no HTTP status mapping is
 * needed. Throws on invalid configuration so callers fail fast in production.
 */
export function getCaseFilesBucketNameForReadOnlyUse(): string {
  const result = resolveCaseFilesBucket();
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.bucket;
}

/** Paths under `src/` that may still inline bucket env (Phase 2E / test harness). */
export const APPROVED_INLINE_BUCKET_SRC_EXCEPTIONS = [
  // Bucket passed as function argument — callers must use helpers above.
  "src/lib/evidence/prepareCaseEvidence.ts",
  "src/lib/pdf/reportBuilder.ts",
  "src/lib/pdf/elitePrintPhotoPipeline.ts",
  "src/lib/reports/surgeryUpload/buildSurgeryEvidenceReviewPdf.ts",
] as const;

export type UploadCaseStoragePathGateResult =
  | { ok: true; caseId: string; normalizedPath: string }
  | { ok: false; status: 400 | 403; error: string };

/** UUID v4-ish pattern for upload row ids passed to delete routes. */
const UPLOAD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isWellFormedUploadId(uploadId: string): boolean {
  return UPLOAD_ID_PATTERN.test((uploadId ?? "").trim());
}

/**
 * Validates that a storage path belongs to the expected case namespace and
 * rejects traversal, legacy orphan layouts, and out-of-scope prefixes.
 */
export function gateUploadCaseStoragePath(
  expectedCaseId: string,
  rawPath: string | null | undefined
): UploadCaseStoragePathGateResult {
  const caseId = (expectedCaseId ?? "").trim();
  if (!isWellFormedCaseId(caseId)) {
    return { ok: false, status: 400, error: "Invalid request" };
  }

  const path = (rawPath ?? "").trim();
  if (!path) {
    return { ok: false, status: 400, error: "Invalid storage path" };
  }

  const parsed = parseCaseIdFromCaseFilesPath(path);
  if (!parsed.ok) {
    return { ok: false, status: 403, error: "Invalid storage path" };
  }

  if (parsed.caseId !== caseId.toLowerCase()) {
    return { ok: false, status: 403, error: "Invalid storage path" };
  }

  return { ok: true, caseId: parsed.caseId, normalizedPath: parsed.normalizedPath };
}

/** Convenience wrapper used when an upload row is already loaded. */
export function storagePathMatchesUploadCase(
  uploadCaseId: string,
  storagePath: string
): boolean {
  return storagePathBelongsToCase(uploadCaseId, storagePath);
}
