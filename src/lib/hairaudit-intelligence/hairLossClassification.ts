/**
 * Hair Loss Classification Engine — rule-based placeholder (HA-INTELLIGENCE-1).
 */

import {
  buildStandardLimitations,
  collectCoverageEvidence,
  collectPhotoEvidence,
  confidenceFromCoverage,
  countCategory,
  CROWN_CATEGORIES,
  downgradeConfidence,
  findingsToEvidence,
  FRONT_CATEGORIES,
  hasCategory,
  hasLowQualityImages,
  matchReportFindings,
  maxSeverity,
  patientSafePrefix,
  patientSafeQualify,
  resolveExecutionMode,
  refineEngineSignalsFromClassifier,
  TEMPLE_CATEGORIES,
} from "./shared";
import type {
  CrownProgressionEstimate,
  DiffuseThinningEstimate,
  HairLossClassificationFields,
  HairLossClassificationOutput,
  IntelligenceEngineInput,
  IntelligenceSeverityBand,
  NorwoodStageEstimate,
} from "./types";
import { HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION } from "./types";

const HAIR_LOSS_PATTERNS = [
  /norwood/i,
  /hairline/i,
  /recession/i,
  /crown/i,
  /vertex/i,
  /thinning/i,
  /diffuse/i,
  /density/i,
];

function estimateNorwood(
  hasFront: boolean,
  hasTemples: boolean,
  hasCrown: boolean,
  hairlineFindings: number,
  crownFindings: number
): NorwoodStageEstimate {
  if (!hasFront && !hasTemples && !hasCrown) return "not_assessable";
  if (crownFindings >= 2 && hairlineFindings >= 1) return "IV";
  if (crownFindings >= 1 && hasCrown) return "III_vertex";
  if (hairlineFindings >= 2 || (hasTemples && hasFront)) return "III";
  if (hairlineFindings >= 1) return "II";
  if (hasFront) return "indeterminate";
  return "not_assessable";
}

function estimateCrownProgression(
  hasCrown: boolean,
  crownFindings: number
): CrownProgressionEstimate {
  if (!hasCrown) return "not_assessable";
  if (crownFindings >= 2) return "advanced";
  if (crownFindings >= 1) return "moderate";
  return "early";
}

function estimateDiffuseThinning(
  hasTopViews: boolean,
  diffuseFindings: number
): DiffuseThinningEstimate {
  if (!hasTopViews) return "not_assessable";
  if (diffuseFindings >= 2) return "likely";
  if (diffuseFindings >= 1) return "possible";
  return "none_suggested";
}

function severityFromFields(fields: HairLossClassificationFields): IntelligenceSeverityBand {
  if (fields.norwoodStage === "not_assessable") return "none";
  if (["VI", "VII"].includes(fields.norwoodStage)) return "significant";
  if (["IV", "V"].includes(fields.norwoodStage)) return "moderate";
  if (fields.crownProgression === "advanced") return "moderate";
  if (fields.diffuseThinningPattern === "likely") return "moderate";
  if (fields.norwoodStage === "III" || fields.norwoodStage === "III_vertex") return "minor";
  return "none";
}

function buildClassificationLabel(fields: HairLossClassificationFields): string {
  if (fields.norwoodStage === "not_assessable") {
    return "Pattern not assessable from available images";
  }
  const parts = [`Norwood ${fields.norwoodStage.replace("_", " ")} (estimate)`];
  if (fields.crownProgression !== "not_assessable" && fields.crownProgression !== "none_observed") {
    parts.push(`crown ${fields.crownProgression.replace("_", " ")}`);
  }
  if (fields.diffuseThinningPattern === "possible" || fields.diffuseThinningPattern === "likely") {
    parts.push("possible diffuse component");
  }
  return parts.join("; ");
}

function buildPatientSummary(fields: HairLossClassificationFields): string {
  if (fields.norwoodStage === "not_assessable") {
    return `${patientSafePrefix()}there is not enough baseline coverage to estimate a hair-loss pattern. Additional front, temple, or crown views may help a clinician review your case.`;
  }
  const stageText =
    fields.norwoodStage === "indeterminate"
      ? "a hair-loss pattern that is not fully clear from the photos alone"
      : `a pattern consistent with an early-to-moderate Norwood ${fields.norwoodStage.replace("_", " ")} estimate`;
  let summary = `${patientSafePrefix()}${patientSafeQualify(`${stageText}.`)} `;
  if (fields.crownProgression === "moderate" || fields.crownProgression === "advanced") {
    summary += "Crown views may suggest progression that should be reviewed by a qualified clinician. ";
  }
  if (fields.diffuseThinningPattern === "possible" || fields.diffuseThinningPattern === "likely") {
    summary += "Some images may suggest wider thinning rather than a single zone — this should be reviewed in person. ";
  }
  summary += "This should be reviewed by a qualified clinician and is not a diagnosis.";
  return summary.trim();
}

function buildClinicianNotes(fields: HairLossClassificationFields, evidenceCount: number): string {
  return [
    "Forensic hair-loss classification (rule-based placeholder).",
    `Norwood estimate: ${fields.norwoodStage}; crown: ${fields.crownProgression}; diffuse: ${fields.diffuseThinningPattern}.`,
    `Evidence items: ${evidenceCount}. Await ImagingOS / FI classifier for pixel-level staging.`,
  ].join(" ");
}

export function runHairLossClassificationEngine(
  input: IntelligenceEngineInput
): HairLossClassificationOutput {
  const images = input.images ?? [];
  const hasFront = hasCategory(images, FRONT_CATEGORIES);
  const hasTemples = hasCategory(images, TEMPLE_CATEGORIES);
  const hasCrown = hasCategory(images, CROWN_CATEGORIES);
  const hasTopViews = hasCrown || countCategory(images, CROWN_CATEGORIES) > 0;

  const matchedFindings = matchReportFindings(input.reportFindings, HAIR_LOSS_PATTERNS);
  const hairlineFindings = matchReportFindings(input.reportFindings, [/hairline/i, /recession/i, /temple/i]).length;
  const crownFindings = matchReportFindings(input.reportFindings, [/crown/i, /vertex/i]).length;
  const diffuseFindings = matchReportFindings(input.reportFindings, [/diffuse/i, /thinning/i]).length;

  const evidenceUsed = [
    ...collectPhotoEvidence(images, FRONT_CATEGORIES, "Front baseline"),
    ...collectPhotoEvidence(images, TEMPLE_CATEGORIES, "Temple view"),
    ...collectPhotoEvidence(images, CROWN_CATEGORIES, "Crown / top view"),
    ...findingsToEvidence(matchedFindings),
  ].filter(Boolean);

  const coverageItems = [
    collectCoverageEvidence("baseline_front", "Front baseline present", hasFront),
    collectCoverageEvidence("baseline_temples", "Temple views present", hasTemples),
    collectCoverageEvidence("baseline_crown", "Crown / top views present", hasCrown),
  ].filter((x): x is NonNullable<typeof x> => x != null);
  evidenceUsed.push(...coverageItems);

  const evidenceLimitations: string[] = [];
  if (!hasFront) evidenceLimitations.push("Front baseline not available — hairline staging limited.");
  if (!hasTemples) evidenceLimitations.push("Temple views missing — temporal recession not fully assessable.");
  if (!hasCrown) evidenceLimitations.push("Crown / top views missing — vertex progression not assessable.");

  const fields: HairLossClassificationFields = {
    norwoodStage: estimateNorwood(hasFront, hasTemples, hasCrown, hairlineFindings, crownFindings),
    crownProgression: estimateCrownProgression(hasCrown, crownFindings),
    diffuseThinningPattern: estimateDiffuseThinning(hasTopViews, diffuseFindings),
    evidenceLimitations,
  };

  let confidence = confidenceFromCoverage(evidenceUsed.length, 2, 4);
  if (hasLowQualityImages(images)) confidence = downgradeConfidence(confidence);
  if (fields.norwoodStage === "not_assessable") confidence = "very_low";

  let severity = severityFromFields(fields);
  ({ confidence, severity } = refineEngineSignalsFromClassifier({ confidence, severity, images }));
  const limitations = [
    ...buildStandardLimitations(input),
    ...evidenceLimitations,
    "Norwood staging from photos alone cannot replace in-person examination.",
  ];

  return {
    engineId: "hair_loss_classification",
    engineVersion: HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION,
    classification: buildClassificationLabel(fields),
    fields,
    severity,
    confidence,
    evidenceUsed,
    patientSafeSummary: buildPatientSummary(fields),
    clinicianNotes: buildClinicianNotes(fields, evidenceUsed.length),
    suggestedNextStep:
      fields.norwoodStage === "not_assessable"
        ? "Upload standardized pre-op front, temple, and crown views for pattern review."
        : "Clinician to correlate pattern estimate with history, trichoscopy, and design goals.",
    limitations,
    advisoryOnly: true,
    executionMode: resolveExecutionMode(input),
    generatedAt: new Date().toISOString(),
  };
}

export function hairLossSeverityForBundle(output: HairLossClassificationOutput): IntelligenceSeverityBand {
  return maxSeverity(output.severity);
}
