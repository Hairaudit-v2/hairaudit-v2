/**
 * FI image-intelligence storage fetch — Phase 3D
 *
 * Validates case-scoped storage paths and optionally downloads image bytes
 * from Supabase when worker + fetch flags are enabled. No AI execution.
 *
 * See: docs/hairaudit-v2-phase-3d-image-fetch-classifier-adapter.md
 */

import type { SupportedImageContentType } from "./uploadContract";
import { SUPPORTED_IMAGE_CONTENT_TYPES } from "./uploadContract";
import {
  gateUploadCaseStoragePath,
  resolveCaseFilesBucketForServerJob,
} from "./uploadStorage";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  detectActualFileType,
  normalizeAcceptedMimeType,
  rejectSvgUploads,
  rejectUnknownBinary,
} from "@/lib/uploads/fileValidation";
import { MAX_IMAGE_UPLOAD_BYTES } from "@/lib/uploads/uploadLimits";

const LOG_PREFIX = "[hairaudit:fi-image-fetch]";

/** Default download timeout (milliseconds). */
export const FI_IMAGE_FETCH_DEFAULT_TIMEOUT_MS = 30_000;

export type FiImageFetchStatus = "skipped" | "ok" | "failed";

export type FiImageFetchSuccess = {
  ok: true;
  status: "ok";
  bucket: string;
  normalized_path: string;
  content_type: SupportedImageContentType;
  size_bytes: number;
  buffer: Buffer;
};

export type FiImageFetchFailure = {
  ok: false;
  status: "failed";
  reason: string;
};

export type FiImageFetchSkipped = {
  ok: false;
  status: "skipped";
  reason: string;
};

export type FiImageFetchResult = FiImageFetchSuccess | FiImageFetchFailure | FiImageFetchSkipped;

export type FiImageFetchInput = {
  case_id: string;
  storage_bucket: string;
  storage_path: string;
};

export type FiImageStorageDownloadFn = (args: {
  bucket: string;
  path: string;
}) => Promise<{ ok: true; blob: Blob } | { ok: false; error: string }>;

export type FiImageFetchOptions = {
  /** Override env flag for tests. */
  fetchEnabled?: boolean;
  /** Requires worker enabled — fetch is never attempted when false. */
  workerEnabled?: boolean;
  /** Injectable download for tests. */
  downloadFn?: FiImageStorageDownloadFn;
  maxBytes?: number;
  timeoutMs?: number;
};

export function isFiImageIntelligenceImageFetchEnabled(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env?.HAIRAUDIT_FI_IMAGE_FETCH_ENABLED === "true"
  );
}

function sanitizeFetchError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "storage download failed";
  if (/service[_-]?role|api[_-]?key|authorization|bearer\s+/i.test(trimmed)) {
    return "storage download failed";
  }
  if (trimmed.length > 200) {
    return `${trimmed.slice(0, 200)}…`;
  }
  return trimmed;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function validateBucketForFetch(requestedBucket: string): { ok: true; bucket: string } | { ok: false; reason: string } {
  const resolved = resolveCaseFilesBucketForServerJob();
  if (!resolved.ok) {
    return { ok: false, reason: "storage bucket is not configured" };
  }

  const bucket = requestedBucket.trim();
  if (!bucket) {
    return { ok: false, reason: "storage_bucket is empty" };
  }

  if (bucket !== resolved.bucket) {
    return { ok: false, reason: "storage_bucket does not match configured case-files bucket" };
  }

  return { ok: true, bucket: resolved.bucket };
}

function validateImageBytes(
  buffer: Buffer,
  maxBytes: number
): { ok: true; content_type: SupportedImageContentType; size_bytes: number } | { ok: false; reason: string } {
  if (buffer.length === 0) {
    return { ok: false, reason: "downloaded file is empty" };
  }

  if (buffer.length > maxBytes) {
    return { ok: false, reason: "image exceeds maximum allowed size" };
  }

  if (rejectSvgUploads(buffer) || rejectUnknownBinary(buffer)) {
    return { ok: false, reason: "file is not a supported image type" };
  }

  const detected = detectActualFileType(buffer);
  const normalizedMime = normalizeAcceptedMimeType(detected);
  if (!normalizedMime || !SUPPORTED_IMAGE_CONTENT_TYPES.includes(normalizedMime)) {
    return { ok: false, reason: "file is not a supported image type" };
  }

  return {
    ok: true,
    content_type: normalizedMime,
    size_bytes: buffer.length,
  };
}

async function defaultStorageDownload(args: {
  bucket: string;
  path: string;
}): Promise<{ ok: true; blob: Blob } | { ok: false; error: string }> {
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "storage client unavailable" };
  }

  const { data, error } = await admin.storage.from(args.bucket).download(args.path);
  if (error || !data) {
    return { ok: false, error: sanitizeFetchError(error?.message ?? "download failed") };
  }

  return { ok: true, blob: data };
}

/**
 * Validate storage metadata and optionally fetch image bytes from Supabase.
 * Fetch runs only when both worker and HAIRAUDIT_FI_IMAGE_FETCH_ENABLED are true.
 */
export async function fetchFiImageIntelligenceImage(
  input: FiImageFetchInput,
  options: FiImageFetchOptions = {}
): Promise<FiImageFetchResult> {
  const workerEnabled = options.workerEnabled ?? true;
  const fetchEnabled = options.fetchEnabled ?? isFiImageIntelligenceImageFetchEnabled();

  if (!workerEnabled) {
    return {
      ok: false,
      status: "skipped",
      reason: "image fetch requires worker enabled",
    };
  }

  if (!fetchEnabled) {
    return {
      ok: false,
      status: "skipped",
      reason: "HAIRAUDIT_FI_IMAGE_FETCH_ENABLED is not true",
    };
  }

  const bucketCheck = validateBucketForFetch(input.storage_bucket);
  if (!bucketCheck.ok) {
    return { ok: false, status: "failed", reason: bucketCheck.reason };
  }

  const pathGate = gateUploadCaseStoragePath(input.case_id, input.storage_path);
  if (!pathGate.ok) {
    return { ok: false, status: "failed", reason: "storage_path invalid for case" };
  }

  const downloadFn = options.downloadFn ?? defaultStorageDownload;
  const timeoutMs = options.timeoutMs ?? FI_IMAGE_FETCH_DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_IMAGE_UPLOAD_BYTES;

  let downloadResult: { ok: true; blob: Blob } | { ok: false; error: string };
  try {
    downloadResult = await withTimeout(
      downloadFn({ bucket: bucketCheck.bucket, path: pathGate.normalizedPath }),
      timeoutMs,
      "storage download timed out"
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "storage download failed";
    if (process.env?.NODE_ENV !== "production") {
      console.warn(LOG_PREFIX, "download error", { reason: sanitizeFetchError(message) });
    }
    return {
      ok: false,
      status: "failed",
      reason: sanitizeFetchError(message),
    };
  }

  if (!downloadResult.ok) {
    return {
      ok: false,
      status: "failed",
      reason: sanitizeFetchError(downloadResult.error),
    };
  }

  const buffer = await blobToBuffer(downloadResult.blob);
  const byteValidation = validateImageBytes(buffer, maxBytes);
  if (!byteValidation.ok) {
    return { ok: false, status: "failed", reason: byteValidation.reason };
  }

  return {
    ok: true,
    status: "ok",
    bucket: bucketCheck.bucket,
    normalized_path: pathGate.normalizedPath,
    content_type: byteValidation.content_type,
    size_bytes: byteValidation.size_bytes,
    buffer,
  };
}
