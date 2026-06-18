/**
 * HairAudit Clinical Intelligence — orchestrator & public API (HA-INTELLIGENCE-1).
 *
 * Future phases:
 * - ImagingOS pixel signals feed engine inputs via FI image-intelligence worker
 * - `classifyClinicalHairImageFromModelUrl` enriches `IntelligenceImageRef`
 * - AuditOS shadow snapshots may persist bundle outputs for auditor review
 */

import { inferCanonicalPhotoCategory } from "@/lib/photos/classification";
import { isClinicalHairImageClassifierAvailable } from "@/lib/hairaudit/classifyClinicalHairImageFromModelUrl";
import { hasClassifierEnrichment } from "./shared";
import { runDonorIntelligenceEngine } from "./donorIntelligence";
import { runHairLossClassificationEngine } from "./hairLossClassification";
import { runProceduralIntelligenceEngine } from "./proceduralIntelligence";
import { runRepairSurgeryEngine } from "./repairSurgeryIntelligence";
import { maxSeverity, normalizeCategory } from "./shared";
import type {
  ClassifierEnrichmentSource,
  HairAuditIntelligenceBundle,
  IntelligenceEngineInput,
  IntelligenceImageRef,
  IntelligenceReportFindingRef,
  LegacyUploadForIntelligence,
  ReportSummaryForIntelligence,
} from "./types";
import { HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION } from "./types";

export type { HairAuditIntelligenceBundle, IntelligenceEngineInput } from "./types";
export type { LegacyUploadForIntelligence, ReportSummaryForIntelligence } from "./types";
export { HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION } from "./types";

export { runHairLossClassificationEngine } from "./hairLossClassification";
export { runDonorIntelligenceEngine } from "./donorIntelligence";
export { runRepairSurgeryEngine } from "./repairSurgeryIntelligence";
export { runProceduralIntelligenceEngine } from "./proceduralIntelligence";

/**
 * Whether live AI classification may augment intelligence inputs.
 * HA-INTELLIGENCE-1: false — rule-based placeholder only.
 */
export function isHairAuditIntelligenceLiveAiEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return isClinicalHairImageClassifierAvailable(env);
}

/**
 * Map legacy upload rows + optional classifier metadata into intelligence image refs.
 */
export function mapUploadsToIntelligenceImages(
  uploads: LegacyUploadForIntelligence[],
  classifierByUploadId?: Record<string, Partial<IntelligenceImageRef>>
): IntelligenceImageRef[] {
  return uploads.map((upload) => {
    const uploadId = upload.id;
    const fromClassifier = uploadId ? classifierByUploadId?.[uploadId] : undefined;
    const canonical =
      fromClassifier?.canonicalPhotoCategory ??
      normalizeCategory(inferCanonicalPhotoCategory(upload));
    return {
      uploadId,
      canonicalPhotoCategory: canonical,
      qualityStatus: fromClassifier?.qualityStatus ?? null,
      protocolStatus: fromClassifier?.protocolStatus ?? null,
      classifierConfidence: fromClassifier?.classifierConfidence ?? null,
      imageLimitations: fromClassifier?.imageLimitations,
    };
  });
}

/**
 * Extract advisory findings from legacy report summary shapes.
 */
export function mapReportSummaryToFindings(
  summary: ReportSummaryForIntelligence | null | undefined
): IntelligenceReportFindingRef[] {
  if (!summary) return [];
  const out: IntelligenceReportFindingRef[] = [];

  const push = (entry: unknown, source: string) => {
    if (typeof entry === "string" && entry.trim()) {
      out.push({ title: entry.trim(), source });
      return;
    }
    if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      const title = String(o.title ?? "").trim();
      if (!title) return;
      const sev = String(o.severity ?? "").toLowerCase();
      const severity =
        sev === "low" || sev === "medium" || sev === "high" || sev === "critical" ? sev : null;
      out.push({
        title,
        severity,
        domain: typeof o.domain === "string" ? o.domain : undefined,
        source,
      });
    }
  };

  for (const f of summary.key_findings ?? []) push(f, "key_findings");
  for (const f of summary.red_flags ?? []) push(f, "red_flags");

  if (summary.domains) {
    for (const [domain, block] of Object.entries(summary.domains)) {
      for (const f of block?.findings ?? []) {
        if (f && typeof f === "object") {
          push({ ...f, domain }, `domains.${domain}`);
        }
      }
    }
  }

  return out;
}

function pickLowestConfidence(
  ...bands: Array<HairAuditIntelligenceBundle["overallConfidence"]>
): HairAuditIntelligenceBundle["overallConfidence"] {
  const order = ["very_low", "low", "moderate", "high"] as const;
  let minIdx = order.length - 1;
  for (const band of bands) {
    const idx = order.indexOf(band);
    if (idx >= 0 && idx < minIdx) minIdx = idx;
  }
  return order[minIdx] ?? "very_low";
}

/**
 * Run all four clinical intelligence engines and return a versioned bundle.
 */
export function runHairAuditIntelligenceBundle(
  input: IntelligenceEngineInput
): HairAuditIntelligenceBundle {
  const hairLossClassification = runHairLossClassificationEngine(input);
  const donorIntelligence = runDonorIntelligenceEngine(input);
  const repairSurgery = runRepairSurgeryEngine(input);
  const proceduralIntelligence = runProceduralIntelligenceEngine(input);

  const generatedAt = new Date().toISOString();

  return {
    engineVersion: HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION,
    caseId: input.caseId,
    hairLossClassification,
    donorIntelligence,
    repairSurgery,
    proceduralIntelligence,
    overallSeverity: maxSeverity(
      hairLossClassification.severity,
      donorIntelligence.severity,
      repairSurgery.severity,
      proceduralIntelligence.severity
    ),
    overallConfidence: pickLowestConfidence(
      hairLossClassification.confidence,
      donorIntelligence.confidence,
      repairSurgery.confidence,
      proceduralIntelligence.confidence
    ),
    generatedAt,
  };
}

/**
 * Convenience: build input from legacy case artifacts and run bundle.
 */
export function runHairAuditIntelligenceFromLegacyArtifacts(args: {
  caseId?: string;
  uploads?: LegacyUploadForIntelligence[];
  reportSummary?: ReportSummaryForIntelligence | null;
  classifierByUploadId?: Record<string, Partial<IntelligenceImageRef>>;
  metadata?: Record<string, unknown>;
  classifierSource?: ClassifierEnrichmentSource;
}): HairAuditIntelligenceBundle {
  const images = mapUploadsToIntelligenceImages(args.uploads ?? [], args.classifierByUploadId);
  const classifierEnriched = hasClassifierEnrichment(args.classifierByUploadId);
  const input: IntelligenceEngineInput = {
    caseId: args.caseId,
    images,
    reportFindings: mapReportSummaryToFindings(args.reportSummary),
    metadata: {
      ...args.metadata,
      classifierEnriched,
      classifierSource: args.classifierSource ?? "none",
    },
  };
  const bundle = runHairAuditIntelligenceBundle(input);
  return {
    ...bundle,
    imageEvidence: images,
    classifierSource: args.classifierSource ?? "none",
  };
}
