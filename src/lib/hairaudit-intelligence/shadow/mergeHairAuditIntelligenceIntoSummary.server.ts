/**
 * HA-INTELLIGENCE-2 — merge advisory intelligence bundle into report summary metadata.
 * Non-authoritative shadow attachment; does not mutate patient-facing summary fields.
 */

import {
  runHairAuditIntelligenceFromLegacyArtifacts,
  type LegacyUploadForIntelligence,
  type ReportSummaryForIntelligence,
} from "@/lib/hairaudit-intelligence";
import {
  annotateIntelligenceBundleForPathway,
  runPathwayHairAuditIntelligenceBundle,
} from "@/lib/hairaudit-intelligence/pathwayIntelligence";
import type { ClassifierEnrichmentSource, HairAuditIntelligenceBundle } from "@/lib/hairaudit-intelligence/types";
import type { ClassifierByUploadIdMap } from "./classifierEnrichment.server";
import { resolveClassifierByUploadIdForIntelligence } from "./classifierEnrichment.server";
import { mapUploadsToIntelligenceImages, mapReportSummaryToFindings } from "@/lib/hairaudit-intelligence";
import { hasClassifierEnrichment } from "@/lib/hairaudit-intelligence/shared";
import { normalizePatientReviewPathway, type PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Map legacy `reports.summary` shapes into intelligence engine finding inputs.
 * Pulls from `forensic_audit` when top-level keys are absent.
 */
export function legacySummaryToIntelligenceReportSummary(
  summary: Record<string, unknown> | null | undefined
): ReportSummaryForIntelligence {
  if (!summary) return {};
  const forensic = isRecord(summary.forensic_audit) ? summary.forensic_audit : null;
  return {
    key_findings: (Array.isArray(forensic?.key_findings)
      ? forensic.key_findings
      : summary.key_findings) as ReportSummaryForIntelligence["key_findings"],
    red_flags: (Array.isArray(forensic?.red_flags) ? forensic.red_flags : summary.red_flags) as ReportSummaryForIntelligence["red_flags"],
    domains: (isRecord(forensic?.domain_scores_v1)
      ? (forensic.domain_scores_v1 as ReportSummaryForIntelligence["domains"])
      : (summary.domains as ReportSummaryForIntelligence["domains"])) as ReportSummaryForIntelligence["domains"],
  };
}

export function mergeHairAuditIntelligenceIntoSummaryMetadata(
  summary: Record<string, unknown>,
  bundle: HairAuditIntelligenceBundle
): Record<string, unknown> {
  const existingMeta = isRecord(summary.metadata) ? { ...summary.metadata } : {};
  return {
    ...summary,
    metadata: {
      ...existingMeta,
      hairAuditIntelligence: bundle,
    },
  };
}

export function buildHairAuditIntelligenceBundleFromLegacySummary(args: {
  caseId?: string;
  summary: Record<string, unknown>;
  uploads?: LegacyUploadForIntelligence[];
  metadata?: Record<string, unknown>;
  classifierByUploadId?: ClassifierByUploadIdMap;
  classifierSource?: ClassifierEnrichmentSource;
  patientReviewPathway?: PatientReviewPathway | unknown;
}): HairAuditIntelligenceBundle {
  const pathway = normalizePatientReviewPathway(args.patientReviewPathway ?? args.metadata?.patientReviewPathway);
  const images = mapUploadsToIntelligenceImages(args.uploads ?? [], args.classifierByUploadId);
  const classifierEnriched = hasClassifierEnrichment(args.classifierByUploadId);
  const input = {
    caseId: args.caseId,
    images,
    reportFindings: mapReportSummaryToFindings(legacySummaryToIntelligenceReportSummary(args.summary)),
    metadata: {
      ...args.metadata,
      classifierEnriched,
      classifierSource: args.classifierSource ?? "none",
      patientReviewPathway: pathway,
    },
  };
  const bundle = runPathwayHairAuditIntelligenceBundle(input, pathway);
  return annotateIntelligenceBundleForPathway(bundle, pathway);
}

/** Async resolver: FI persisted jobs + upload metadata → classifier map. Fail-safe. */
export async function buildHairAuditIntelligenceBundleFromLegacySummaryWithClassifier(args: {
  caseId?: string;
  summary: Record<string, unknown>;
  uploads?: LegacyUploadForIntelligence[];
  metadata?: Record<string, unknown>;
  fiPersistence?: import("@/lib/hairaudit/fiImageIntelligencePersistence").FiImageIntelligencePersistenceAdapter;
}): Promise<HairAuditIntelligenceBundle> {
  const { classifierByUploadId, classifierSource } = await resolveClassifierByUploadIdForIntelligence({
    caseId: args.caseId,
    uploads: args.uploads,
    persistence: args.fiPersistence,
  });
  return buildHairAuditIntelligenceBundleFromLegacySummary({
    ...args,
    classifierByUploadId,
    classifierSource,
  });
}

export function attachHairAuditIntelligenceToSummary(
  summary: Record<string, unknown>,
  args: {
    caseId?: string;
    uploads?: LegacyUploadForIntelligence[];
    metadata?: Record<string, unknown>;
    classifierByUploadId?: ClassifierByUploadIdMap;
    classifierSource?: ClassifierEnrichmentSource;
  }
): Record<string, unknown> {
  const bundle = buildHairAuditIntelligenceBundleFromLegacySummary({
    caseId: args.caseId,
    summary,
    uploads: args.uploads,
    metadata: args.metadata,
    classifierByUploadId: args.classifierByUploadId,
    classifierSource: args.classifierSource,
  });
  return mergeHairAuditIntelligenceIntoSummaryMetadata(summary, bundle);
}
