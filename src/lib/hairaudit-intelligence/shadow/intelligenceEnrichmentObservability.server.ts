/**
 * HA-INTELLIGENCE-4 — structured, non-PII observability for intelligence enrichment.
 */

import type { ClassifierEnrichmentSource } from "@/lib/hairaudit-intelligence/types";
import type { ClassifierWriteBackResult } from "./classifierMetadataWriteback.server";
import { classifierEnrichmentUploadCount } from "./classifierEnrichment.server";
import type { ClassifierByUploadIdMap } from "./classifierEnrichment.server";

export type IntelligenceEnrichmentOutcome = "success" | "partial" | "skipped" | "error";

export type IntelligenceEnrichmentLogPayload = {
  tag: "intelligence-enrichment";
  caseIdPresent: boolean;
  uploadCount: number;
  enrichedImageCount: number;
  classifierSource: ClassifierEnrichmentSource;
  engineVersion?: string;
  overallSeverity?: string;
  overallConfidence?: string;
  durationMs: number;
  outcome: IntelligenceEnrichmentOutcome;
  writeBackApplied?: number;
  writeBackSkipped?: number;
  writeBackFailed?: number;
};

const FORBIDDEN_LOG_PATTERNS = [
  /https?:\/\//i,
  /signed[_-]?url/i,
  /patient[_\s-]?name/i,
  /clinicianNotes/i,
  /key_findings/i,
  /red_flags/i,
  /Bearer\s+/i,
];

export function resolveIntelligenceEnrichmentOutcome(args: {
  attached: boolean;
  enrichedImageCount: number;
  writeBack?: ClassifierWriteBackResult;
  hadError?: boolean;
}): IntelligenceEnrichmentOutcome {
  if (args.hadError) return "error";
  if (!args.attached && args.enrichedImageCount === 0) return "skipped";
  if (args.writeBack && args.writeBack.failed > 0 && args.writeBack.applied === 0 && !args.attached) {
    return "error";
  }
  if (
    args.writeBack &&
    (args.writeBack.failed > 0 || (args.writeBack.skipped > 0 && args.writeBack.applied > 0))
  ) {
    return "partial";
  }
  if (args.attached) return "success";
  return "partial";
}

export function buildIntelligenceEnrichmentLogPayload(args: {
  caseId?: string;
  uploadCount: number;
  classifierByUploadId?: ClassifierByUploadIdMap;
  classifierSource: ClassifierEnrichmentSource;
  engineVersion?: string;
  overallSeverity?: string;
  overallConfidence?: string;
  durationMs: number;
  outcome: IntelligenceEnrichmentOutcome;
  writeBack?: ClassifierWriteBackResult;
}): IntelligenceEnrichmentLogPayload {
  return {
    tag: "intelligence-enrichment",
    caseIdPresent: Boolean(args.caseId?.trim()),
    uploadCount: args.uploadCount,
    enrichedImageCount: classifierEnrichmentUploadCount(args.classifierByUploadId),
    classifierSource: args.classifierSource,
    engineVersion: args.engineVersion,
    overallSeverity: args.overallSeverity,
    overallConfidence: args.overallConfidence,
    durationMs: args.durationMs,
    outcome: args.outcome,
    writeBackApplied: args.writeBack?.applied,
    writeBackSkipped: args.writeBack?.skipped,
    writeBackFailed: args.writeBack?.failed,
  };
}

export function logIntelligenceEnrichment(
  logger: { info: (msg: string, meta?: Record<string, unknown>) => void },
  payload: IntelligenceEnrichmentLogPayload
): void {
  logger.info("[intelligence-enrichment] enrichment completed", payload);
}

/** Test helper — ensure observability payload carries no PII or report text. */
export function assertIntelligenceEnrichmentLogHasNoPii(payload: IntelligenceEnrichmentLogPayload): void {
  const serialized = JSON.stringify(payload);
  if (serialized.includes("case-") || serialized.includes("upload-")) {
    throw new Error("Observability log must not include case or upload identifiers");
  }
  for (const pattern of FORBIDDEN_LOG_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new Error(`Observability log matched forbidden pattern: ${pattern}`);
    }
  }
}
