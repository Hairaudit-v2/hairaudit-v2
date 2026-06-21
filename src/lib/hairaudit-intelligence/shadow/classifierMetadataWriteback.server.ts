/**
 * HA-INTELLIGENCE-4/5 — safe FI classifier result write-back to uploads.metadata.
 * Fail-safe: malformed rows skipped; write failures never block intelligence attach or worker completion.
 */

import type { LegacyUploadForIntelligence } from "@/lib/hairaudit-intelligence/types";
import type { FiImageIntelligenceProcessedJobRecord } from "@/lib/hairaudit/fiImageIntelligencePersistence";
import type { FiImageIntelligenceResult } from "@/lib/hairaudit/fiImageIntelligenceResult";
import { isAuditorClassifierProtected } from "@/lib/auditor/auditorClassifierCorrection.server";
import { normalizeCategory } from "@/lib/hairaudit-intelligence/shared";
import { mapFiJobToClassifierRef } from "./classifierEnrichment.server";
import { normalizeFiClassifierStatuses } from "./classifierStatusNormalization.server";
import {
  countClassifierFieldsApplied,
} from "./classifierWritebackObservability.server";

export type ClassifierMetadataWriteBackAdapter = {
  updateUploadMetadata: (
    uploadId: string,
    metadata: Record<string, unknown>
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Optional read for merge protection during worker-time write-back. */
  getUploadMetadata?: (uploadId: string) => Promise<Record<string, unknown> | null>;
};

export type ClassifierWriteBackField =
  | "ai_detected_category"
  | "ai_classification_confidence"
  | "photo_quality_status"
  | "photo_protocol_status"
  | "protocol_deviation_notes"
  | "quality_checks"
  | "classifier_source"
  | "classifier_synced_at"
  | "fi_quality_status_raw"
  | "fi_protocol_status_raw";

export type ClassifierWriteBackResult = {
  applied: number;
  skipped: number;
  failed: number;
  fieldsAppliedCount?: number;
  protectedByAuditorCorrection?: boolean;
};

export type ClassifierWriteBackJobResult = ClassifierWriteBackResult & {
  outcome: "success" | "skipped" | "failed";
};

const WRITE_BACK_FIELDS: ClassifierWriteBackField[] = [
  "ai_detected_category",
  "ai_classification_confidence",
  "photo_quality_status",
  "photo_protocol_status",
  "protocol_deviation_notes",
  "quality_checks",
  "classifier_source",
  "classifier_synced_at",
  "fi_quality_status_raw",
  "fi_protocol_status_raw",
];

const MANUAL_CLASSIFIER_SOURCES = new Set([
  "manual",
  "manual_stub",
  "auditor",
  "clinic_manual",
  "auditor_correction",
]);

const PROTOCOL_DEVIATION_STATUSES = new Set([
  "minor_deviation",
  "major_deviation",
  "non_compliant",
  "serious_deviation",
  "angle_deviation",
]);

const CONFIDENCE_WIN_MARGIN = 0.05;

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

function isFieldEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (isRecord(value) && Object.keys(value).length === 0) return true;
  return false;
}

function isManualClassifierSource(source: unknown): boolean {
  const normalized = String(source ?? "")
    .trim()
    .toLowerCase();
  return MANUAL_CLASSIFIER_SOURCES.has(normalized);
}

function parseFiResult(raw: unknown): FiImageIntelligenceResult | null {
  if (!isRecord(raw)) return null;
  const category = readString(raw.canonical_photo_category);
  const status = readString(raw.classification_status);
  if (!category || !status) return null;
  return raw as unknown as FiImageIntelligenceResult;
}

function buildQualityChecksFromFi(result: FiImageIntelligenceResult): Record<string, string> | undefined {
  const normalized = normalizeFiClassifierStatuses({
    qualityStatus: result.quality_status,
    protocolStatus: result.protocol_status,
  });
  if (!normalized.qualityStatus || normalized.qualityStatus === "unknown") return undefined;
  return { overall: normalized.qualityStatus };
}

function buildProtocolDeviationNotes(result: FiImageIntelligenceResult): string | undefined {
  const protocol = String(result.protocol_status ?? "").toLowerCase();
  if (!PROTOCOL_DEVIATION_STATUSES.has(protocol)) return undefined;
  const notes = readString(result.classification_notes);
  if (notes) return notes.slice(0, 500);
  return `Protocol status: ${result.protocol_status}.`;
}

/** Map a completed FI job into upload metadata classifier fields (no merge). */
export function buildClassifierMetadataPatchFromFiJob(
  job: FiImageIntelligenceProcessedJobRecord
): { uploadId: string; patch: Partial<Record<ClassifierWriteBackField, unknown>>; confidence: number | null } | null {
  if (job.status !== "completed") return null;
  const result = parseFiResult(job.result);
  if (!result) return null;
  if (result.classification_status === "pending" || result.classification_status === "dry_run") {
    return null;
  }

  const ref = mapFiJobToClassifierRef(job);
  if (!ref?.uploadId) return null;

  const confidence = readConfidence(result.confidence);
  const syncedAt = new Date().toISOString();
  const normalizedStatuses = normalizeFiClassifierStatuses({
    qualityStatus: result.quality_status,
    protocolStatus: result.protocol_status,
  });
  const patch: Partial<Record<ClassifierWriteBackField, unknown>> = {
    classifier_source: readString(result.classification_source) ?? "fi_persisted_jobs",
    classifier_synced_at: syncedAt,
  };

  if (ref.canonicalPhotoCategory) {
    patch.ai_detected_category = ref.canonicalPhotoCategory;
  }
  if (confidence != null) {
    patch.ai_classification_confidence = confidence;
  }
  if (normalizedStatuses.qualityStatus) {
    patch.photo_quality_status = normalizedStatuses.qualityStatus;
  }
  if (normalizedStatuses.protocolStatus) {
    patch.photo_protocol_status = normalizedStatuses.protocolStatus;
  }
  if (normalizedStatuses.qualityStatusRaw) {
    patch.fi_quality_status_raw = normalizedStatuses.qualityStatusRaw;
  }
  if (normalizedStatuses.protocolStatusRaw) {
    patch.fi_protocol_status_raw = normalizedStatuses.protocolStatusRaw;
  }

  const qualityChecks = buildQualityChecksFromFi(result);
  if (qualityChecks) {
    patch.quality_checks = qualityChecks;
  }

  const deviationNotes = buildProtocolDeviationNotes(result);
  if (deviationNotes) {
    patch.protocol_deviation_notes = deviationNotes;
  }

  const hasClassifierPayload =
    patch.ai_detected_category != null ||
    patch.ai_classification_confidence != null ||
    patch.photo_quality_status != null ||
    patch.photo_protocol_status != null ||
    patch.protocol_deviation_notes != null ||
    patch.quality_checks != null;

  if (!hasClassifierPayload) return null;

  return { uploadId: ref.uploadId, patch, confidence };
}

export function shouldOverwriteClassifierField(args: {
  field: ClassifierWriteBackField;
  existingMetadata: Record<string, unknown>;
  incomingValue: unknown;
  incomingConfidence: number | null;
  forceClassifierWriteback?: boolean;
}): boolean {
  if (args.forceClassifierWriteback) {
    return true;
  }

  const auditorProtected = isAuditorClassifierProtected(args.existingMetadata);

  if (auditorProtected) {
    if (args.field === "classifier_source") return false;
    const existing = args.existingMetadata[args.field];
    if (!isFieldEmpty(existing)) return false;
  }

  const existing = args.existingMetadata[args.field];
  if (isFieldEmpty(existing)) return true;

  const existingSource = args.existingMetadata.classifier_source;
  const existingConf = readConfidence(args.existingMetadata.ai_classification_confidence);
  const incomingConf = args.incomingConfidence;

  if (isManualClassifierSource(existingSource)) {
    if (args.field === "classifier_source") return false;
    if (incomingConf == null) return false;
    if (existingConf != null && incomingConf <= existingConf + CONFIDENCE_WIN_MARGIN) return false;
  }

  if (args.field === "ai_classification_confidence") {
    const nextConf = readConfidence(args.incomingValue);
    if (existingConf != null && nextConf != null && nextConf <= existingConf) return false;
  }

  if (args.field === "ai_detected_category") {
    if (existingConf != null && incomingConf != null && incomingConf <= existingConf) return false;
  }

  if (args.field === "photo_quality_status" || args.field === "photo_protocol_status") {
    if (isManualClassifierSource(existingSource)) {
      if (existingConf != null && incomingConf != null && incomingConf <= existingConf + CONFIDENCE_WIN_MARGIN) {
        return false;
      }
    }
  }

  if (args.field === "quality_checks" && isRecord(existing) && isRecord(args.incomingValue)) {
    return Object.keys(args.incomingValue).some((key) => isFieldEmpty(existing[key]));
  }

  if (args.field === "protocol_deviation_notes" && isManualClassifierSource(existingSource)) {
    if (existingConf != null && incomingConf != null && incomingConf <= existingConf + CONFIDENCE_WIN_MARGIN) {
      return false;
    }
  }

  if (args.field === "classifier_synced_at") {
    return !isManualClassifierSource(existingSource);
  }

  if (args.field === "fi_quality_status_raw" || args.field === "fi_protocol_status_raw") {
    return isFieldEmpty(existing);
  }

  return true;
}

/** Merge classifier patch into existing upload metadata without dropping unrelated keys. */
export function mergeClassifierMetadataWriteback(args: {
  existingMetadata: Record<string, unknown>;
  patch: Partial<Record<ClassifierWriteBackField, unknown>>;
  incomingConfidence: number | null;
  forceClassifierWriteback?: boolean;
}): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...args.existingMetadata };

  for (const field of WRITE_BACK_FIELDS) {
    const incomingValue = args.patch[field];
    if (incomingValue === undefined) continue;
    if (
      !shouldOverwriteClassifierField({
        field,
        existingMetadata: args.existingMetadata,
        incomingValue,
        incomingConfidence: args.incomingConfidence,
        forceClassifierWriteback: args.forceClassifierWriteback,
      })
    ) {
      continue;
    }

    if (field === "quality_checks" && isRecord(incomingValue)) {
      const existingChecks = isRecord(merged.quality_checks) ? merged.quality_checks : {};
      merged.quality_checks = { ...existingChecks, ...incomingValue };
      continue;
    }

    merged[field] = incomingValue;
  }

  if (args.patch.ai_detected_category && typeof merged.ai_detected_category === "string") {
    merged.ai_detected_category = normalizeCategory(merged.ai_detected_category);
  }

  return merged;
}

/**
 * Write safe FI classifier fields back to upload metadata.
 * Never throws — failures are counted and ignored by callers.
 */
export async function writeBackClassifierResultsToUploadMetadata(args: {
  uploads?: LegacyUploadForIntelligence[];
  fiCompletedJobs?: FiImageIntelligenceProcessedJobRecord[];
  adapter?: ClassifierMetadataWriteBackAdapter;
  /** Admin/service-only — bypasses auditor correction protection when true. */
  forceClassifierWriteback?: boolean;
}): Promise<ClassifierWriteBackResult> {
  const result: ClassifierWriteBackResult = { applied: 0, skipped: 0, failed: 0, fieldsAppliedCount: 0 };
  if (!args.adapter || !(args.fiCompletedJobs?.length)) return result;

  const uploadsById = new Map<string, LegacyUploadForIntelligence>();
  for (const upload of args.uploads ?? []) {
    if (upload.id) uploadsById.set(upload.id, upload);
  }

  for (const job of args.fiCompletedJobs) {
    try {
      const built = buildClassifierMetadataPatchFromFiJob(job);
      if (!built) {
        result.skipped += 1;
        continue;
      }

      const upload = uploadsById.get(built.uploadId);
      const existingMetadata = isRecord(upload?.metadata) ? upload!.metadata! : {};
      const protectedByAuditor = isAuditorClassifierProtected(existingMetadata);
      const merged = mergeClassifierMetadataWriteback({
        existingMetadata,
        patch: built.patch,
        incomingConfidence: built.confidence,
        forceClassifierWriteback: args.forceClassifierWriteback,
      });

      const fieldsAppliedCount = countClassifierFieldsApplied({
        existingMetadata,
        mergedMetadata: merged,
        fields: WRITE_BACK_FIELDS,
      });
      result.fieldsAppliedCount = (result.fieldsAppliedCount ?? 0) + fieldsAppliedCount;
      if (protectedByAuditor) result.protectedByAuditorCorrection = true;

      const changed = fieldsAppliedCount > 0;
      if (!changed) {
        result.skipped += 1;
        continue;
      }

      const write = await args.adapter.updateUploadMetadata(built.uploadId, merged);
      if (write.ok) {
        result.applied += 1;
        if (upload) upload.metadata = merged;
      } else {
        result.failed += 1;
      }
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

/**
 * Worker-time write-back for a single completed FI job.
 * Never throws — failures are counted and ignored by callers.
 */
export async function writeBackClassifierMetadataForCompletedJob(args: {
  job: FiImageIntelligenceProcessedJobRecord;
  adapter?: ClassifierMetadataWriteBackAdapter;
  existingMetadata?: Record<string, unknown>;
  /** Admin/service-only — bypasses auditor correction protection when true. */
  forceClassifierWriteback?: boolean;
}): Promise<ClassifierWriteBackJobResult> {
  const result: ClassifierWriteBackJobResult = {
    applied: 0,
    skipped: 0,
    failed: 0,
    fieldsAppliedCount: 0,
    outcome: "skipped",
  };
  if (!args.adapter) return result;

  try {
    const built = buildClassifierMetadataPatchFromFiJob(args.job);
    if (!built) {
      result.skipped += 1;
      result.outcome = "skipped";
      return result;
    }

    let existingMetadata = args.existingMetadata;
    if (!existingMetadata && args.adapter.getUploadMetadata) {
      existingMetadata = (await args.adapter.getUploadMetadata(built.uploadId)) ?? {};
    }
    const safeExisting = isRecord(existingMetadata) ? existingMetadata : {};
    const protectedByAuditor = isAuditorClassifierProtected(safeExisting);

    const merged = mergeClassifierMetadataWriteback({
      existingMetadata: safeExisting,
      patch: built.patch,
      incomingConfidence: built.confidence,
      forceClassifierWriteback: args.forceClassifierWriteback,
    });

    const fieldsAppliedCount = countClassifierFieldsApplied({
      existingMetadata: safeExisting,
      mergedMetadata: merged,
      fields: WRITE_BACK_FIELDS,
    });
    result.fieldsAppliedCount = fieldsAppliedCount;
    result.protectedByAuditorCorrection = protectedByAuditor;

    if (fieldsAppliedCount === 0) {
      result.skipped += 1;
      result.outcome = "skipped";
      return result;
    }

    const write = await args.adapter.updateUploadMetadata(built.uploadId, merged);
    if (write.ok) {
      result.applied += 1;
      result.outcome = "success";
    } else {
      result.failed += 1;
      result.outcome = "failed";
    }
  } catch {
    result.failed += 1;
    result.outcome = "failed";
  }

  return result;
}
