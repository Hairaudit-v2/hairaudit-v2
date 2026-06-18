/**
 * HA-INTELLIGENCE-2/4 — fail-safe Inngest wiring for advisory intelligence shadow attachment.
 */

import type { LegacyUploadForIntelligence } from "@/lib/hairaudit-intelligence";
import type { HairAuditIntelligenceBundle } from "@/lib/hairaudit-intelligence/types";
import type { FiImageIntelligencePersistenceAdapter } from "@/lib/hairaudit/fiImageIntelligencePersistence";
import { shouldLogHairAuditIntelligenceShadow } from "./hairAuditIntelligenceEnv.server";
import {
  buildHairAuditIntelligenceBundleFromLegacySummary,
  mergeHairAuditIntelligenceIntoSummaryMetadata,
} from "./mergeHairAuditIntelligenceIntoSummary.server";
import { resolveClassifierByUploadIdForIntelligence } from "./classifierEnrichment.server";
import {
  type ClassifierMetadataWriteBackAdapter,
  writeBackClassifierResultsToUploadMetadata,
} from "./classifierMetadataWriteback.server";
import {
  buildIntelligenceEnrichmentLogPayload,
  logIntelligenceEnrichment,
  resolveIntelligenceEnrichmentOutcome,
} from "./intelligenceEnrichmentObservability.server";

type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
};

export type HairAuditIntelligenceAttachResult = {
  summary: Record<string, unknown>;
  attached: boolean;
  bundle?: HairAuditIntelligenceBundle;
};

export type { ClassifierMetadataWriteBackAdapter } from "./classifierMetadataWriteback.server";

/**
 * Generate advisory intelligence and merge into `summary.metadata.hairAuditIntelligence`.
 * Never throws — report pipeline must continue when generation fails.
 */
export function attachHairAuditIntelligenceToReportSummarySafe(args: {
  summary: Record<string, unknown>;
  caseId: string;
  uploads?: LegacyUploadForIntelligence[];
  logger?: Logger;
  generateBundle?: typeof buildHairAuditIntelligenceBundleFromLegacySummary;
}): HairAuditIntelligenceAttachResult {
  const generate = args.generateBundle ?? buildHairAuditIntelligenceBundleFromLegacySummary;
  const startedAt = Date.now();
  try {
    const bundle = generate({
      caseId: args.caseId,
      summary: args.summary,
      uploads: args.uploads,
      metadata: { shadowMode: true, advisoryOnly: true },
    });
    const summary = mergeHairAuditIntelligenceIntoSummaryMetadata(args.summary, bundle);

    if (shouldLogHairAuditIntelligenceShadow() && args.logger) {
      args.logger.info("HairAudit intelligence shadow attached", {
        caseId: args.caseId,
        engineVersion: bundle.engineVersion,
        overallSeverity: bundle.overallSeverity,
        overallConfidence: bundle.overallConfidence,
        executionMode: bundle.hairLossClassification.executionMode,
        classifierSource: bundle.classifierSource ?? "none",
      });
    }

    if (args.logger) {
      logIntelligenceEnrichment(
        args.logger,
        buildIntelligenceEnrichmentLogPayload({
          caseId: args.caseId,
          uploadCount: args.uploads?.length ?? 0,
          classifierSource: bundle.classifierSource ?? "none",
          engineVersion: bundle.engineVersion,
          overallSeverity: bundle.overallSeverity,
          overallConfidence: bundle.overallConfidence,
          durationMs: Date.now() - startedAt,
          outcome: resolveIntelligenceEnrichmentOutcome({
            attached: true,
            enrichedImageCount: 0,
          }),
        })
      );
    }

    return { summary, attached: true, bundle };
  } catch (e) {
    if (args.logger) {
      args.logger.warn("HairAudit intelligence shadow failed (ignored)", {
        caseId: args.caseId,
        message: String((e as Error)?.message ?? e),
      });
      logIntelligenceEnrichment(
        args.logger,
        buildIntelligenceEnrichmentLogPayload({
          caseId: args.caseId,
          uploadCount: args.uploads?.length ?? 0,
          classifierSource: "none",
          durationMs: Date.now() - startedAt,
          outcome: "error",
        })
      );
    }
    return { summary: args.summary, attached: false };
  }
}

/**
 * HA-INTELLIGENCE-3/4 — resolve FI/upload classifier metadata, optional metadata write-back, then attach.
 * Never throws.
 */
export async function attachHairAuditIntelligenceToReportSummarySafeWithClassifier(args: {
  summary: Record<string, unknown>;
  caseId: string;
  uploads?: LegacyUploadForIntelligence[];
  logger?: Logger;
  uploadMetadataWriter?: ClassifierMetadataWriteBackAdapter;
  fiPersistence?: FiImageIntelligencePersistenceAdapter;
  /** Admin/service-only — bypasses auditor correction protection when true. */
  forceClassifierWriteback?: boolean;
}): Promise<HairAuditIntelligenceAttachResult> {
  const startedAt = Date.now();
  try {
    const resolved = await resolveClassifierByUploadIdForIntelligence({
      caseId: args.caseId,
      uploads: args.uploads,
      persistence: args.fiPersistence,
    });

    const writeBack = await writeBackClassifierResultsToUploadMetadata({
      uploads: args.uploads,
      fiCompletedJobs: resolved.fiCompletedJobs,
      adapter: args.uploadMetadataWriter,
      forceClassifierWriteback: args.forceClassifierWriteback,
    });

    const bundle = buildHairAuditIntelligenceBundleFromLegacySummary({
      caseId: args.caseId,
      summary: args.summary,
      uploads: args.uploads,
      metadata: { shadowMode: true, advisoryOnly: true },
      classifierByUploadId: resolved.classifierByUploadId,
      classifierSource: resolved.classifierSource,
    });
    const summary = mergeHairAuditIntelligenceIntoSummaryMetadata(args.summary, bundle);

    const enrichedImageCount =
      Object.values(resolved.classifierByUploadId).filter(Boolean).length;
    const outcome = resolveIntelligenceEnrichmentOutcome({
      attached: true,
      enrichedImageCount,
      writeBack,
    });

    if (shouldLogHairAuditIntelligenceShadow() && args.logger) {
      args.logger.info("HairAudit intelligence shadow attached", {
        caseId: args.caseId,
        engineVersion: bundle.engineVersion,
        overallSeverity: bundle.overallSeverity,
        overallConfidence: bundle.overallConfidence,
        executionMode: bundle.hairLossClassification.executionMode,
        classifierSource: bundle.classifierSource ?? "none",
      });
    }

    if (args.logger) {
      logIntelligenceEnrichment(
        args.logger,
        buildIntelligenceEnrichmentLogPayload({
          caseId: args.caseId,
          uploadCount: args.uploads?.length ?? 0,
          classifierByUploadId: resolved.classifierByUploadId,
          classifierSource: resolved.classifierSource,
          engineVersion: bundle.engineVersion,
          overallSeverity: bundle.overallSeverity,
          overallConfidence: bundle.overallConfidence,
          durationMs: Date.now() - startedAt,
          outcome,
          writeBack,
        })
      );
    }

    return { summary, attached: true, bundle };
  } catch (e) {
    if (args.logger) {
      args.logger.warn("HairAudit intelligence shadow failed (ignored)", {
        caseId: args.caseId,
        message: String((e as Error)?.message ?? e),
      });
      logIntelligenceEnrichment(
        args.logger,
        buildIntelligenceEnrichmentLogPayload({
          caseId: args.caseId,
          uploadCount: args.uploads?.length ?? 0,
          classifierSource: "none",
          durationMs: Date.now() - startedAt,
          outcome: "error",
        })
      );
    }
    return { summary: args.summary, attached: false };
  }
}
