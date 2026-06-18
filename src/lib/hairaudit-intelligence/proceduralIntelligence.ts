/**
 * Procedural Intelligence Engine — rule-based placeholder (HA-INTELLIGENCE-1).
 */

import {
  buildStandardLimitations,
  collectCoverageEvidence,
  collectPhotoEvidence,
  confidenceFromCoverage,
  downgradeConfidence,
  findingsToEvidence,
  GRAFT_HANDLING_CATEGORIES,
  hasCategory,
  hasLowQualityImages,
  matchReportFindings,
  patientSafePrefix,
  patientSafeQualify,
  resolveExecutionMode,
  refineEngineSignalsFromClassifier,
  SURGICAL_CATEGORIES,
} from "./shared";
import type {
  AsymmetryEstimate,
  GraftSpacingAnomaly,
  ImplantationIrregularity,
  IntelligenceEngineInput,
  IntelligenceSeverityBand,
  ProceduralConcernSeverity,
  ProceduralIntelligenceFields,
  ProceduralIntelligenceOutput,
  SurvivalProbabilityBand,
} from "./types";
import { HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION } from "./types";

const PROCEDURAL_PATTERNS = [
  /implantation/i,
  /placement/i,
  /spacing/i,
  /density/i,
  /asymmetr/i,
  /survival/i,
  /transection/i,
  /graft handling/i,
  /recipient/i,
  /site creation/i,
];

function estimateImplantationIrregularity(
  hasSurgical: boolean,
  hasGraft: boolean,
  irregularFindings: number
): ImplantationIrregularity {
  if (!hasSurgical && !hasGraft) return "not_assessable";
  if (irregularFindings >= 3) return "significant";
  if (irregularFindings >= 2) return "moderate";
  if (irregularFindings >= 1) return "minor";
  return "none_suggested";
}

function estimateGraftSpacing(hasSurgical: boolean, spacingFindings: number): GraftSpacingAnomaly {
  if (!hasSurgical) return "not_assessable";
  if (spacingFindings >= 2) return "likely";
  if (spacingFindings >= 1) return "possible";
  return "none_suggested";
}

function estimateAsymmetry(hasSurgical: boolean, asymFindings: number): AsymmetryEstimate {
  if (!hasSurgical) return "not_assessable";
  if (asymFindings >= 3) return "significant";
  if (asymFindings >= 2) return "moderate";
  if (asymFindings >= 1) return "minor";
  return "none_suggested";
}

function estimateSurvivalBand(
  hasGraft: boolean,
  hasSurgical: boolean,
  negativeFindings: number,
  positiveFindings: number
): SurvivalProbabilityBand {
  if (!hasGraft && !hasSurgical) return "not_assessable";
  if (negativeFindings >= 2) return "concerning";
  if (negativeFindings >= 1) return "uncertain";
  if (positiveFindings >= 1 && negativeFindings === 0) return "favourable";
  return "moderate";
}

function estimateProceduralSeverity(
  implantation: ImplantationIrregularity,
  spacing: GraftSpacingAnomaly,
  asymmetry: AsymmetryEstimate,
  survival: SurvivalProbabilityBand
): ProceduralConcernSeverity {
  if (survival === "concerning" || implantation === "significant" || asymmetry === "significant") {
    return "critical";
  }
  if (implantation === "moderate" || asymmetry === "moderate" || spacing === "likely") {
    return "significant";
  }
  if (implantation === "minor" || asymmetry === "minor" || spacing === "possible") {
    return "moderate";
  }
  if (survival === "uncertain") return "moderate";
  return "none";
}

function proceduralSeverityToIntelligence(severity: ProceduralConcernSeverity): IntelligenceSeverityBand {
  switch (severity) {
    case "critical":
      return "critical";
    case "significant":
      return "significant";
    case "moderate":
      return "moderate";
    case "minor":
      return "minor";
    default:
      return "none";
  }
}

function buildClassificationLabel(fields: ProceduralIntelligenceFields): string {
  if (fields.implantationPatternIrregularities === "not_assessable") {
    return "Procedural pattern not assessable from available images";
  }
  return `Procedural concern ${fields.proceduralConcernSeverity}; survival band ${fields.survivalProbabilityEstimateBand.replace(/_/g, " ")}`;
}

function buildPatientSummary(fields: ProceduralIntelligenceFields): string {
  if (fields.implantationPatternIrregularities === "not_assessable") {
    return `${patientSafePrefix()}day-of-surgery or graft-handling photos were not available to comment on placement patterns. Your clinic may be able to provide additional views for review.`;
  }
  let summary = `${patientSafePrefix()}`;
  if (fields.proceduralConcernSeverity === "none" || fields.proceduralConcernSeverity === "minor") {
    summary += patientSafeQualify("placement patterns appear generally orderly in the available surgical views. ");
  } else {
    summary += patientSafeQualify("some irregularities in placement or spacing may be worth discussing with your clinic. ");
  }
  if (fields.asymmetry === "moderate" || fields.asymmetry === "significant") {
    summary += "Left–right balance in the available views may appear uneven — an in-person review is recommended. ";
  }
  if (fields.survivalProbabilityEstimateBand === "concerning" || fields.survivalProbabilityEstimateBand === "uncertain") {
    summary += "Long-term growth expectations should be reviewed with your treating team. ";
  }
  summary += "This should be reviewed by a qualified clinician and is not a diagnosis.";
  return summary.trim();
}

function buildClinicianNotes(fields: ProceduralIntelligenceFields): string {
  return [
    "Procedural Intelligence (rule-based placeholder).",
    `Implantation: ${fields.implantationPatternIrregularities}; spacing: ${fields.graftSpacingAnomalies}; asymmetry: ${fields.asymmetry}.`,
    `Survival band: ${fields.survivalProbabilityEstimateBand}; procedural severity: ${fields.proceduralConcernSeverity}.`,
    "Await extraction pattern review and graft integrity signals from ImagingOS.",
  ].join(" ");
}

export function runProceduralIntelligenceEngine(
  input: IntelligenceEngineInput
): ProceduralIntelligenceOutput {
  const images = input.images ?? [];
  const hasSurgical = hasCategory(images, SURGICAL_CATEGORIES);
  const hasGraft = hasCategory(images, GRAFT_HANDLING_CATEGORIES);

  const matchedFindings = matchReportFindings(input.reportFindings, PROCEDURAL_PATTERNS);
  const irregularFindings = matchReportFindings(input.reportFindings, [/irregular/i, /uneven/i, /placement/i]).length;
  const spacingFindings = matchReportFindings(input.reportFindings, [/spacing/i, /gap/i, /crowding/i]).length;
  const asymFindings = matchReportFindings(input.reportFindings, [/asymmetr/i]).length;
  const negativeFindings = matchReportFindings(input.reportFindings, [/transection/i, /dehydration/i, /poor handling/i, /crush/i]).length;
  const positiveFindings = matchReportFindings(input.reportFindings, [/acceptable/i, /within expected/i, /good handling/i]).length;

  const evidenceUsed = [
    ...collectPhotoEvidence(images, SURGICAL_CATEGORIES, "Surgical view"),
    ...collectPhotoEvidence(images, GRAFT_HANDLING_CATEGORIES, "Graft handling"),
    ...findingsToEvidence(matchedFindings),
    collectCoverageEvidence("surgical_day0", "Day-of / recipient views present", hasSurgical),
    collectCoverageEvidence("graft_handling", "Graft handling views present", hasGraft),
  ].filter((x): x is NonNullable<typeof x> => x != null);

  const fields: ProceduralIntelligenceFields = {
    implantationPatternIrregularities: estimateImplantationIrregularity(
      hasSurgical,
      hasGraft,
      irregularFindings
    ),
    graftSpacingAnomalies: estimateGraftSpacing(hasSurgical, spacingFindings),
    asymmetry: estimateAsymmetry(hasSurgical, asymFindings),
    survivalProbabilityEstimateBand: estimateSurvivalBand(
      hasGraft,
      hasSurgical,
      negativeFindings,
      positiveFindings
    ),
    proceduralConcernSeverity: "none",
  };
  fields.proceduralConcernSeverity = estimateProceduralSeverity(
    fields.implantationPatternIrregularities,
    fields.graftSpacingAnomalies,
    fields.asymmetry,
    fields.survivalProbabilityEstimateBand
  );

  let confidence = confidenceFromCoverage(evidenceUsed.length, 2, 4);
  if (hasLowQualityImages(images)) confidence = downgradeConfidence(confidence);
  if (!hasSurgical && !hasGraft) confidence = "very_low";

  let severity = proceduralSeverityToIntelligence(fields.proceduralConcernSeverity);
  ({ confidence, severity } = refineEngineSignalsFromClassifier({ confidence, severity, images }));

  const limitations = [
    ...buildStandardLimitations(input),
    ...(hasSurgical ? [] : ["Day-of recipient / implantation views not available."]),
    ...(hasGraft ? [] : ["Graft handling tray views not available — survival estimate limited."]),
    "Survival estimates from photos cannot predict individual graft uptake.",
  ];

  return {
    engineId: "procedural_intelligence",
    engineVersion: HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION,
    classification: buildClassificationLabel(fields),
    fields,
    severity,
    confidence,
    evidenceUsed,
    patientSafeSummary: buildPatientSummary(fields),
    clinicianNotes: buildClinicianNotes(fields),
    suggestedNextStep:
      hasSurgical || hasGraft
        ? "Clinician to review placement density map and correlate with operative notes."
        : "Upload day-of recipient and graft tray views for procedural review.",
    limitations,
    advisoryOnly: true,
    executionMode: resolveExecutionMode(input),
    generatedAt: new Date().toISOString(),
  };
}
