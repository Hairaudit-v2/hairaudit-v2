/**
 * Repair Surgery Intelligence Engine — rule-based placeholder (HA-INTELLIGENCE-1).
 */

import {
  buildStandardLimitations,
  collectCoverageEvidence,
  collectPhotoEvidence,
  confidenceFromCoverage,
  DONOR_CATEGORIES,
  downgradeConfidence,
  findingsToEvidence,
  FOLLOWUP_CATEGORIES,
  FRONT_CATEGORIES,
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
  DonorDepletionEstimate,
  IntelligenceEngineInput,
  IntelligenceSeverityBand,
  OverharvestingIndicator,
  PoorDensityDistributionEstimate,
  PriorTransplantEvidence,
  RepairComplexityBand,
  RepairSurgeryFields,
  RepairSurgeryOutput,
  UnnaturalAngulationEstimate,
} from "./types";
import { HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION } from "./types";

const REPAIR_PATTERNS = [
  /repair/i,
  /revision/i,
  /prior transplant/i,
  /previous transplant/i,
  /overharvest/i,
  /depletion/i,
  /pluggy/i,
  /unnatural/i,
  /angulation/i,
  /density distribution/i,
  /correction/i,
];

function triStateFromFindings(
  hasEvidence: boolean,
  count: number
): "none_suggested" | "possible" | "likely" | "not_assessable" {
  if (!hasEvidence) return "not_assessable";
  if (count >= 2) return "likely";
  if (count >= 1) return "possible";
  return "none_suggested";
}

function estimateRepairComplexity(fields: RepairSurgeryFields): RepairComplexityBand {
  const concernCount = [
    fields.overharvestingIndicators,
    fields.priorTransplantEvidence,
    fields.donorDepletion,
    fields.unnaturalAngulation,
    fields.poorDensityDistribution,
  ].filter((v) => v === "likely" || v === "possible").length;

  if (concernCount >= 3) return "high";
  if (concernCount >= 1) return "moderate";
  if (
    fields.overharvestingIndicators === "not_assessable" &&
    fields.priorTransplantEvidence === "not_assessable"
  ) {
    return "indeterminate";
  }
  return "low";
}

function severityFromFields(fields: RepairSurgeryFields): IntelligenceSeverityBand {
  if (fields.repairComplexityBand === "high") return "significant";
  if (fields.repairComplexityBand === "moderate") return "moderate";
  if (fields.overharvestingIndicators === "likely" || fields.donorDepletion === "likely") {
    return "significant";
  }
  return "none";
}

function buildClassificationLabel(fields: RepairSurgeryFields): string {
  if (fields.repairComplexityBand === "indeterminate") {
    return "Repair context not assessable from available images";
  }
  return `Repair complexity ${fields.repairComplexityBand}; prior work ${fields.priorTransplantEvidence.replace(/_/g, " ")}`;
}

function buildPatientSummary(fields: RepairSurgeryFields): string {
  if (fields.repairComplexityBand === "indeterminate") {
    return `${patientSafePrefix()}there is not enough follow-up or donor coverage to comment on prior surgery or repair needs. Additional healed result and donor views may help.`;
  }
  let summary = `${patientSafePrefix()}`;
  if (fields.priorTransplantEvidence === "possible" || fields.priorTransplantEvidence === "likely") {
    summary += patientSafeQualify("signs consistent with prior transplant work may be present. ");
  }
  if (fields.overharvestingIndicators === "possible" || fields.overharvestingIndicators === "likely") {
    summary += "Donor views may suggest prior heavy extraction — this should be reviewed by a qualified clinician. ";
  }
  if (fields.unnaturalAngulation === "possible" || fields.unnaturalAngulation === "likely") {
    summary += "Hair direction in some views may appear uneven — an in-person review is recommended. ";
  }
  if (fields.repairComplexityBand === "high") {
    summary += "Overall, a repair discussion with an experienced clinician may be worthwhile. ";
  } else if (fields.repairComplexityBand === "low") {
    summary += "No major repair concerns are suggested from the available images alone. ";
  }
  summary += "This should be reviewed by a qualified clinician and is not a diagnosis.";
  return summary.trim();
}

function buildClinicianNotes(fields: RepairSurgeryFields): string {
  return [
    "Repair Surgery Intelligence (rule-based placeholder).",
    `Overharvesting: ${fields.overharvestingIndicators}; prior transplant: ${fields.priorTransplantEvidence}; donor depletion: ${fields.donorDepletion}.`,
    `Angulation: ${fields.unnaturalAngulation}; density distribution: ${fields.poorDensityDistribution}; complexity: ${fields.repairComplexityBand}.`,
  ].join(" ");
}

export function runRepairSurgeryEngine(input: IntelligenceEngineInput): RepairSurgeryOutput {
  const images = input.images ?? [];
  const hasDonorFollowup = hasCategory(images, DONOR_CATEGORIES);
  const hasResultViews = hasCategory(images, FOLLOWUP_CATEGORIES) || hasCategory(images, FRONT_CATEGORIES);
  const hasSurgical = hasCategory(images, SURGICAL_CATEGORIES);
  const hasRepairEvidence = hasDonorFollowup || hasResultViews || hasSurgical;

  const matchedFindings = matchReportFindings(input.reportFindings, REPAIR_PATTERNS);
  const overharvestFindings = matchReportFindings(input.reportFindings, [/overharvest/i, /depletion/i]).length;
  const priorTxFindings = matchReportFindings(input.reportFindings, [/prior transplant/i, /previous transplant/i, /repair/i, /revision/i]).length;
  const angulationFindings = matchReportFindings(input.reportFindings, [/angulation/i, /unnatural/i, /pluggy/i]).length;
  const densityFindings = matchReportFindings(input.reportFindings, [/density distribution/i, /patchy/i, /uneven/i]).length;

  const evidenceUsed = [
    ...collectPhotoEvidence(images, DONOR_CATEGORIES, "Donor follow-up"),
    ...collectPhotoEvidence(images, FOLLOWUP_CATEGORIES, "Outcome view"),
    ...collectPhotoEvidence(images, SURGICAL_CATEGORIES, "Surgical context"),
    ...findingsToEvidence(matchedFindings),
    collectCoverageEvidence("repair_donor", "Donor follow-up present", hasDonorFollowup),
    collectCoverageEvidence("repair_outcome", "Outcome views present", hasResultViews),
  ].filter((x): x is NonNullable<typeof x> => x != null);

  const fields: RepairSurgeryFields = {
    overharvestingIndicators: triStateFromFindings(hasDonorFollowup, overharvestFindings) as OverharvestingIndicator,
    priorTransplantEvidence: triStateFromFindings(hasResultViews || hasSurgical, priorTxFindings) as PriorTransplantEvidence,
    donorDepletion: triStateFromFindings(hasDonorFollowup, overharvestFindings) as DonorDepletionEstimate,
    unnaturalAngulation: triStateFromFindings(hasResultViews, angulationFindings) as UnnaturalAngulationEstimate,
    poorDensityDistribution: triStateFromFindings(hasResultViews, densityFindings) as PoorDensityDistributionEstimate,
    repairComplexityBand: "indeterminate",
  };
  fields.repairComplexityBand = estimateRepairComplexity(fields);

  let confidence = confidenceFromCoverage(evidenceUsed.length, 2, 4);
  if (hasLowQualityImages(images)) confidence = downgradeConfidence(confidence);
  if (!hasRepairEvidence) confidence = "very_low";

  let severity = severityFromFields(fields);
  ({ confidence, severity } = refineEngineSignalsFromClassifier({ confidence, severity, images }));

  const limitations = [
    ...buildStandardLimitations(input),
    ...(hasDonorFollowup ? [] : ["Healed donor follow-up not available — overharvesting assessment limited."]),
    ...(hasResultViews ? [] : ["Long-term result views missing — prior work and angulation assessment limited."]),
    "Repair planning requires clinical examination and full surgical history.",
  ];

  return {
    engineId: "repair_surgery",
    engineVersion: HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION,
    classification: buildClassificationLabel(fields),
    fields,
    severity,
    confidence,
    evidenceUsed,
    patientSafeSummary: buildPatientSummary(fields),
    clinicianNotes: buildClinicianNotes(fields),
    suggestedNextStep:
      fields.repairComplexityBand === "high" || fields.repairComplexityBand === "moderate"
        ? "Refer to clinician experienced in repair / revision cases for structured plan."
        : "Collect healed donor and 6–12 month result views if repair context is suspected.",
    limitations,
    advisoryOnly: true,
    executionMode: resolveExecutionMode(input),
    generatedAt: new Date().toISOString(),
  };
}
