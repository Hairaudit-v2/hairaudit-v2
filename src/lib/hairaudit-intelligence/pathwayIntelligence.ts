/**
 * HA-DUAL-PATHWAY-1 — pathway-aware intelligence execution.
 */

import {
  runDonorIntelligenceEngine,
  runHairLossClassificationEngine,
  runProceduralIntelligenceEngine,
  runRepairSurgeryEngine,
} from "@/lib/hairaudit-intelligence";
import { maxSeverity } from "@/lib/hairaudit-intelligence/shared";
import type {
  HairAuditIntelligenceBundle,
  IntelligenceEngineInput,
} from "@/lib/hairaudit-intelligence/types";
import { HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION } from "@/lib/hairaudit-intelligence/types";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import { getPathwayDefinition } from "@/lib/patient/patientReviewPathway";

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

function withoutEvidence(input: IntelligenceEngineInput): IntelligenceEngineInput {
  return { ...input, images: [], reportFindings: [] };
}

/**
 * Run intelligence engines scoped to the patient's review pathway.
 */
export function runPathwayHairAuditIntelligenceBundle(
  input: IntelligenceEngineInput,
  pathway: PatientReviewPathway
): HairAuditIntelligenceBundle {
  const modules = getPathwayDefinition(pathway).intelligenceModules;
  const isPreSurgery = pathway === "pre_surgery";
  const generatedAt = new Date().toISOString();

  const hairLossClassification =
    isPreSurgery && modules.includes("suitability")
      ? runHairLossClassificationEngine(input)
      : runHairLossClassificationEngine(withoutEvidence(input));

  const donorIntelligence =
    modules.some((m) =>
      ["donor_analysis", "donor_trauma_detection", "overharvesting_detection"].includes(m)
    )
      ? runDonorIntelligenceEngine(input)
      : runDonorIntelligenceEngine(withoutEvidence(input));

  const repairSurgery =
    !isPreSurgery && modules.includes("repair_intelligence")
      ? runRepairSurgeryEngine(input)
      : runRepairSurgeryEngine(withoutEvidence(input));

  const proceduralIntelligence =
    !isPreSurgery &&
    modules.some((m) => ["density_assessment", "procedural_integrity_scoring"].includes(m))
      ? runProceduralIntelligenceEngine(input)
      : runProceduralIntelligenceEngine(withoutEvidence(input));

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

export function annotateIntelligenceBundleForPathway(
  bundle: HairAuditIntelligenceBundle,
  pathway: PatientReviewPathway
): HairAuditIntelligenceBundle & { patientReviewPathway: PatientReviewPathway; activeModules: readonly string[] } {
  return {
    ...bundle,
    patientReviewPathway: pathway,
    activeModules: getPathwayDefinition(pathway).intelligenceModules,
  };
}
