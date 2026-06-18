/**
 * HA-INTELLIGENCE-6 — structured, non-PII observability for classifier metadata write-back.
 */

import type { ClassifierWriteBackField } from "./classifierMetadataWriteback.server";

export type ClassifierWritebackOutcome = "success" | "skipped" | "failed";

export type ClassifierWritebackLogPayload = {
  tag: "image-classifier-writeback";
  caseIdPresent: boolean;
  uploadIdPresent: boolean;
  outcome: ClassifierWritebackOutcome;
  fieldsAppliedCount: number;
  protectedByAuditorCorrection: boolean;
  durationMs: number;
  forceWriteback?: boolean;
};

const FORBIDDEN_LOG_PATTERNS = [
  /https?:\/\//i,
  /signed[_-]?url/i,
  /patient[_\s-]?name/i,
  /Bearer\s+/i,
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
];

export function countClassifierFieldsApplied(args: {
  existingMetadata: Record<string, unknown>;
  mergedMetadata: Record<string, unknown>;
  fields: readonly ClassifierWriteBackField[];
}): number {
  let count = 0;
  for (const field of args.fields) {
    if (args.mergedMetadata[field] !== args.existingMetadata[field]) {
      count += 1;
    }
  }
  return count;
}

export function resolveClassifierWritebackOutcome(args: {
  applied: number;
  failed: number;
}): ClassifierWritebackOutcome {
  if (args.failed > 0) return "failed";
  if (args.applied > 0) return "success";
  return "skipped";
}

export function buildClassifierWritebackLogPayload(args: {
  caseId?: string | null;
  uploadId?: string | null;
  outcome: ClassifierWritebackOutcome;
  fieldsAppliedCount: number;
  protectedByAuditorCorrection: boolean;
  durationMs: number;
  forceWriteback?: boolean;
}): ClassifierWritebackLogPayload {
  return {
    tag: "image-classifier-writeback",
    caseIdPresent: Boolean(args.caseId?.trim()),
    uploadIdPresent: Boolean(args.uploadId?.trim()),
    outcome: args.outcome,
    fieldsAppliedCount: args.fieldsAppliedCount,
    protectedByAuditorCorrection: args.protectedByAuditorCorrection,
    durationMs: args.durationMs,
    ...(args.forceWriteback ? { forceWriteback: true } : {}),
  };
}

export function logClassifierWriteback(
  logger: { info: (msg: string, meta?: Record<string, unknown>) => void },
  payload: ClassifierWritebackLogPayload
): void {
  logger.info("[image-classifier-writeback] write-back completed", payload);
}

/** Test helper — ensure write-back observability carries no PII. */
export function assertClassifierWritebackLogHasNoPii(payload: ClassifierWritebackLogPayload): void {
  const serialized = JSON.stringify(payload);
  if (serialized.includes("case-") || serialized.includes("upload-")) {
    throw new Error("Write-back log must not include case or upload identifiers");
  }
  for (const pattern of FORBIDDEN_LOG_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new Error(`Write-back log matched forbidden pattern: ${pattern}`);
    }
  }
}
