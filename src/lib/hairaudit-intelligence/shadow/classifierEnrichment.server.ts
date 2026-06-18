/**
 * HA-INTELLIGENCE-3 — build classifierByUploadId from FI persisted jobs and upload metadata.
 * Fail-safe: missing or malformed classifier rows are skipped; report generation is never blocked.
 */

import type { LegacyUploadForIntelligence } from "@/lib/hairaudit-intelligence/types";
import type {
  ClassifierEnrichmentSource,
  IntelligenceImageRef,
} from "@/lib/hairaudit-intelligence/types";
import { normalizeCategory } from "@/lib/hairaudit-intelligence/shared";
import {
  buildFiImageIntelligenceIdempotencyKey,
} from "@/lib/hairaudit/fiImageIntelligenceQueue";
import type { FiImageIntelligenceProcessedJobRecord } from "@/lib/hairaudit/fiImageIntelligencePersistence";
import {
  findProcessedJobByIdempotencyKey,
  findProcessedJobsByIdempotencyKeys,
  type FiImageIntelligencePersistenceAdapter,
} from "@/lib/hairaudit/fiImageIntelligencePersistence";
import type { FiImageIntelligenceResult } from "@/lib/hairaudit/fiImageIntelligenceResult";
import { normalizeFiClassifierStatuses } from "./classifierStatusNormalization.server";

export type ClassifierByUploadIdMap = Record<string, Partial<IntelligenceImageRef>>;

const NEUTRAL_QUALITY = new Set(["", "not_evaluated", "unknown"]);
const NEUTRAL_PROTOCOL = new Set(["", "not_evaluated", "compliant", "unknown"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readConfidence(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < 0 || v > 1) return null;
  return v;
}

function mergeImageRef(
  existing: Partial<IntelligenceImageRef> | undefined,
  incoming: Partial<IntelligenceImageRef>
): Partial<IntelligenceImageRef> {
  const mergedLimitations = [
    ...(existing?.imageLimitations ?? []),
    ...(incoming.imageLimitations ?? []),
  ];
  const uniqueLimits = [...new Set(mergedLimitations.map((s) => s.trim()).filter(Boolean))];

  return {
    uploadId: incoming.uploadId ?? existing?.uploadId,
    canonicalPhotoCategory:
      existing?.canonicalPhotoCategory ?? incoming.canonicalPhotoCategory,
    qualityStatus:
      existing?.qualityStatus != null && existing.qualityStatus !== ""
        ? existing.qualityStatus
        : incoming.qualityStatus ?? null,
    protocolStatus:
      existing?.protocolStatus != null && existing.protocolStatus !== ""
        ? existing.protocolStatus
        : incoming.protocolStatus ?? null,
    classifierConfidence:
      existing?.classifierConfidence != null
        ? existing.classifierConfidence
        : incoming.classifierConfidence ?? null,
    imageLimitations: uniqueLimits.length > 0 ? uniqueLimits : undefined,
  };
}

function isMeaningfulClassifierRef(ref: Partial<IntelligenceImageRef> | undefined): boolean {
  if (!ref) return false;
  if (ref.classifierConfidence != null && ref.classifierConfidence > 0) return true;
  const quality = String(ref.qualityStatus ?? "").toLowerCase();
  if (quality && !NEUTRAL_QUALITY.has(quality)) return true;
  const protocol = String(ref.protocolStatus ?? "").toLowerCase();
  if (protocol && !NEUTRAL_PROTOCOL.has(protocol)) return true;
  if ((ref.imageLimitations?.length ?? 0) > 0) return true;
  if (ref.canonicalPhotoCategory) return true;
  return false;
}

export function classifierEnrichmentUploadCount(
  classifierByUploadId?: ClassifierByUploadIdMap
): number {
  if (!classifierByUploadId) return 0;
  return Object.values(classifierByUploadId).filter((ref) => isMeaningfulClassifierRef(ref)).length;
}

export function resolveClassifierEnrichmentSource(args: {
  usedFiJobs: boolean;
  usedUploadMetadata: boolean;
}): ClassifierEnrichmentSource {
  if (args.usedFiJobs && args.usedUploadMetadata) return "fi_and_upload_metadata";
  if (args.usedFiJobs) return "fi_persisted_jobs";
  if (args.usedUploadMetadata) return "upload_metadata";
  return "none";
}

function buildImageLimitationsFromFiResult(result: FiImageIntelligenceResult): string[] {
  const limits: string[] = [];
  const fetchStatus = String(result.image_fetch_status ?? "").toLowerCase();
  if (fetchStatus && fetchStatus !== "ok" && fetchStatus !== "skipped") {
    limits.push(`Image fetch status: ${result.image_fetch_status}.`);
  }
  const quality = String(result.quality_status ?? "").toLowerCase();
  if (quality && !NEUTRAL_QUALITY.has(quality)) {
    limits.push(`Classifier quality status: ${result.quality_status}.`);
  }
  const protocol = String(result.protocol_status ?? "").toLowerCase();
  if (protocol && !NEUTRAL_PROTOCOL.has(protocol)) {
    limits.push(`Classifier protocol status: ${result.protocol_status}.`);
  }
  const notes = readString(result.classification_notes);
  if (notes) limits.push(notes);
  if (result.classification_status === "failed") {
    limits.push("Classifier run failed for this image.");
  }
  return limits;
}

function parseFiImageIntelligenceResult(raw: unknown): FiImageIntelligenceResult | null {
  if (!isRecord(raw)) return null;
  const category = readString(raw.canonical_photo_category);
  if (!category) return null;
  const status = readString(raw.classification_status);
  if (!status) return null;
  return raw as unknown as FiImageIntelligenceResult;
}

/** Map one completed FI image-intelligence job into a partial IntelligenceImageRef. */
export function mapFiJobToClassifierRef(
  job: FiImageIntelligenceProcessedJobRecord
): Partial<IntelligenceImageRef> | null {
  if (job.status !== "completed") return null;
  const result = parseFiImageIntelligenceResult(job.result);
  if (!result) return null;
  if (result.classification_status === "skipped" || result.classification_status === "failed") {
    return {
      uploadId: job.upload_id,
      canonicalPhotoCategory: normalizeCategory(result.canonical_photo_category),
      imageLimitations: buildImageLimitationsFromFiResult(result),
    };
  }

  const normalizedStatuses = normalizeFiClassifierStatuses({
    qualityStatus: result.quality_status,
    protocolStatus: result.protocol_status,
  });

  return {
    uploadId: job.upload_id,
    canonicalPhotoCategory: normalizeCategory(result.canonical_photo_category),
    qualityStatus: normalizedStatuses.qualityStatus,
    protocolStatus: normalizedStatuses.protocolStatus,
    classifierConfidence: readConfidence(result.confidence),
    imageLimitations: buildImageLimitationsFromFiResult(result),
  };
}

function buildImageLimitationsFromUploadMetadata(metadata: Record<string, unknown>): string[] {
  const limits: string[] = [];
  const protocolNotes = readString(metadata.protocol_deviation_notes);
  if (protocolNotes) limits.push(protocolNotes);

  const qualityChecks = metadata.quality_checks;
  if (isRecord(qualityChecks)) {
    for (const [check, status] of Object.entries(qualityChecks)) {
      const normalized = String(status ?? "").toLowerCase();
      if (normalized === "poor" || normalized === "unacceptable" || normalized === "low") {
        limits.push(`Quality check ${check}: ${status}.`);
      }
    }
  }

  const aiStatus = readString(metadata.ai_classification_status);
  if (aiStatus === "failed") {
    limits.push("Upload metadata indicates AI classification failed.");
  }

  return limits;
}

/** Map upload metadata contract fields into a partial IntelligenceImageRef. */
export function mapUploadMetadataToClassifierRef(
  upload: LegacyUploadForIntelligence
): Partial<IntelligenceImageRef> | null {
  const uploadId = upload.id;
  if (!uploadId) return null;
  const metadata = upload.metadata;
  if (!isRecord(metadata)) return null;

  const category =
    readString(metadata.ai_detected_category) ??
    readString(metadata.canonical_photo_category);
  const quality = readString(metadata.photo_quality_status);
  const protocol = readString(metadata.photo_protocol_status);
  const confidence = readConfidence(metadata.ai_classification_confidence);
  const limitations = buildImageLimitationsFromUploadMetadata(metadata);

  if (!category && !quality && !protocol && confidence == null && limitations.length === 0) {
    return null;
  }

  return {
    uploadId,
    canonicalPhotoCategory: category ? normalizeCategory(category) : undefined,
    qualityStatus: quality,
    protocolStatus: protocol,
    classifierConfidence: confidence,
    imageLimitations: limitations.length > 0 ? limitations : undefined,
  };
}

/** Merge FI job refs (priority) with upload metadata refs for one case. */
export function buildClassifierByUploadId(args: {
  uploads?: LegacyUploadForIntelligence[];
  fiCompletedJobs?: FiImageIntelligenceProcessedJobRecord[];
}): {
  classifierByUploadId: ClassifierByUploadIdMap;
  classifierSource: ClassifierEnrichmentSource;
} {
  const map: ClassifierByUploadIdMap = {};
  let usedFiJobs = false;
  let usedUploadMetadata = false;

  for (const job of args.fiCompletedJobs ?? []) {
    try {
      const ref = mapFiJobToClassifierRef(job);
      if (!ref?.uploadId) continue;
      map[ref.uploadId] = mergeImageRef(map[ref.uploadId], ref);
      usedFiJobs = true;
    } catch {
      // fail-safe: skip malformed job
    }
  }

  for (const upload of args.uploads ?? []) {
    try {
      const uploadId = upload.id;
      if (!uploadId) continue;
      const ref = mapUploadMetadataToClassifierRef(upload);
      if (!ref) continue;
      map[uploadId] = mergeImageRef(map[uploadId], ref);
      usedUploadMetadata = true;
    } catch {
      // fail-safe: skip malformed upload metadata
    }
  }

  return {
    classifierByUploadId: map,
    classifierSource: resolveClassifierEnrichmentSource({ usedFiJobs, usedUploadMetadata }),
  };
}

/** Load completed FI jobs for uploads via batched idempotency key lookup (no migration). */
export async function loadCompletedFiJobsForUploads(args: {
  caseId: string;
  uploadIds: string[];
  persistence?: FiImageIntelligencePersistenceAdapter;
}): Promise<FiImageIntelligenceProcessedJobRecord[]> {
  const keys = args.uploadIds
    .filter((uploadId) => Boolean(uploadId?.trim()))
    .map((uploadId) => buildFiImageIntelligenceIdempotencyKey(args.caseId, uploadId));

  if (keys.length === 0) return [];

  try {
    const jobs = await findProcessedJobsByIdempotencyKeys(keys, args.persistence);
    return jobs.filter((job) => job.status === "completed");
  } catch {
    // fail-safe: fall back to sequential lookup when batch adapter is unavailable
    const jobs: FiImageIntelligenceProcessedJobRecord[] = [];
    for (const key of keys) {
      try {
        const job = await findProcessedJobByIdempotencyKey(key, args.persistence);
        if (job?.status === "completed") jobs.push(job);
      } catch {
        // continue without this upload's FI row
      }
    }
    return jobs;
  }
}

/** Resolve classifier map from FI persisted rows and upload metadata. Never throws. */
export async function resolveClassifierByUploadIdForIntelligence(args: {
  caseId?: string;
  uploads?: LegacyUploadForIntelligence[];
  persistence?: FiImageIntelligencePersistenceAdapter;
}): Promise<{
  classifierByUploadId: ClassifierByUploadIdMap;
  classifierSource: ClassifierEnrichmentSource;
  fiCompletedJobs: FiImageIntelligenceProcessedJobRecord[];
}> {
  try {
    const uploadIds = (args.uploads ?? [])
      .map((u) => u.id)
      .filter((id): id is string => Boolean(id?.trim()));

    const fiCompletedJobs =
      args.caseId && uploadIds.length > 0
        ? await loadCompletedFiJobsForUploads({
            caseId: args.caseId,
            uploadIds,
            persistence: args.persistence,
          })
        : [];

    const { classifierByUploadId, classifierSource } = buildClassifierByUploadId({
      uploads: args.uploads,
      fiCompletedJobs,
    });

    return { classifierByUploadId, classifierSource, fiCompletedJobs };
  } catch {
    return { classifierByUploadId: {}, classifierSource: "none", fiCompletedJobs: [] };
  }
}
