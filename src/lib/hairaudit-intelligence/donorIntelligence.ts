/**
 * Donor Intelligence Engine — rule-based placeholder (HA-INTELLIGENCE-1).
 */

import {
  buildStandardLimitations,
  collectCoverageEvidence,
  collectPhotoEvidence,
  confidenceFromCoverage,
  DONOR_CATEGORIES,
  downgradeConfidence,
  findingsToEvidence,
  hasCategory,
  hasLowQualityImages,
  matchReportFindings,
  patientSafePrefix,
  patientSafeQualify,
  resolveExecutionMode,
  refineEngineSignalsFromClassifier,
} from "./shared";
import type {
  DonorDensityBand,
  DonorIntelligenceFields,
  DonorIntelligenceOutput,
  DonorReserveRisk,
  ExtractionSafetyConcern,
  IntelligenceEngineInput,
  IntelligenceSeverityBand,
  MiniaturisationSuspicion,
  RetrogradeAlopeciaPattern,
} from "./types";
import { HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION } from "./types";

const DONOR_PATTERNS = [
  /donor/i,
  /density/i,
  /miniatur/i,
  /retrograde/i,
  /safe zone/i,
  /extraction/i,
  /depletion/i,
  /reserve/i,
];

function estimateDonorDensity(hasDonor: boolean, densityFindings: number): DonorDensityBand {
  if (!hasDonor) return "not_assessable";
  if (densityFindings >= 2) return "appears_limited";
  if (densityFindings >= 1) return "moderate";
  return "appears_adequate";
}

function estimateMiniaturisation(hasDonor: boolean, miniFindings: number): MiniaturisationSuspicion {
  if (!hasDonor) return "not_assessable";
  if (miniFindings >= 2) return "elevated_suspicion";
  if (miniFindings >= 1) return "possible";
  return "none_suggested";
}

function estimateRetrograde(hasDonor: boolean, retroFindings: number): RetrogradeAlopeciaPattern {
  if (!hasDonor) return "not_assessable";
  if (retroFindings >= 1) return "pattern_suggested";
  return "none_suggested";
}

function estimateExtractionSafety(
  hasDonor: boolean,
  safetyFindings: number
): ExtractionSafetyConcern {
  if (!hasDonor) return "not_assessable";
  if (safetyFindings >= 2) return "elevated";
  if (safetyFindings >= 1) return "borderline";
  return "none_noted";
}

function estimateDonorReserve(
  density: DonorDensityBand,
  mini: MiniaturisationSuspicion,
  safety: ExtractionSafetyConcern
): DonorReserveRisk {
  if (density === "not_assessable") return "not_assessable";
  if (density === "appears_limited" || mini === "elevated_suspicion" || safety === "elevated") {
    return "elevated";
  }
  if (density === "moderate" || mini === "possible" || safety === "borderline") {
    return "moderate";
  }
  return "low";
}

function severityFromFields(fields: DonorIntelligenceFields): IntelligenceSeverityBand {
  if (fields.donorReserveRisk === "elevated") return "significant";
  if (fields.donorReserveRisk === "moderate") return "moderate";
  if (fields.extractionSafetyZoneConcerns === "elevated") return "significant";
  if (fields.miniaturisationSuspicion === "elevated_suspicion") return "moderate";
  return "none";
}

function buildClassificationLabel(fields: DonorIntelligenceFields): string {
  if (fields.donorDensityBand === "not_assessable") {
    return "Donor zone not assessable from available images";
  }
  return `Donor ${fields.donorDensityBand.replace(/_/g, " ")}; reserve risk ${fields.donorReserveRisk.replace(/_/g, " ")}`;
}

function buildPatientSummary(fields: DonorIntelligenceFields): string {
  if (fields.donorDensityBand === "not_assessable") {
    return `${patientSafePrefix()}donor-area coverage is insufficient to comment on density or reserve. Rear and side donor photos may help a clinician review your case.`;
  }
  let summary = `${patientSafePrefix()}`;
  if (fields.donorDensityBand === "appears_limited") {
    summary += patientSafeQualify("donor coverage may appear limited in the available views. ");
  } else if (fields.donorDensityBand === "moderate") {
    summary += patientSafeQualify("donor coverage appears moderate in the available views. ");
  } else {
    summary += patientSafeQualify("donor coverage appears generally adequate in the available views. ");
  }
  if (fields.miniaturisationSuspicion === "possible" || fields.miniaturisationSuspicion === "elevated_suspicion") {
    summary += "Some images may suggest finer or miniaturised hairs — this should be reviewed by a qualified clinician. ";
  }
  if (fields.donorReserveRisk === "elevated" || fields.donorReserveRisk === "moderate") {
    summary += "Planning any future procedure should include a careful discussion of donor reserve. ";
  }
  summary += "This should be reviewed by a qualified clinician and is not a diagnosis.";
  return summary.trim();
}

function buildClinicianNotes(fields: DonorIntelligenceFields): string {
  return [
    "Donor Intelligence (rule-based placeholder).",
    `Density band: ${fields.donorDensityBand}; miniaturisation: ${fields.miniaturisationSuspicion}; retrograde: ${fields.retrogradeAlopeciaPattern}.`,
    `Extraction safety: ${fields.extractionSafetyZoneConcerns}; reserve risk: ${fields.donorReserveRisk}.`,
    "Await Graft Integrity / donor density analytics from ImagingOS.",
  ].join(" ");
}

export function runDonorIntelligenceEngine(input: IntelligenceEngineInput): DonorIntelligenceOutput {
  const images = input.images ?? [];
  const hasDonor = hasCategory(images, DONOR_CATEGORIES);

  const matchedFindings = matchReportFindings(input.reportFindings, DONOR_PATTERNS);
  const densityFindings = matchReportFindings(input.reportFindings, [/density/i, /sparse/i, /depleted/i]).length;
  const miniFindings = matchReportFindings(input.reportFindings, [/miniatur/i]).length;
  const retroFindings = matchReportFindings(input.reportFindings, [/retrograde/i]).length;
  const safetyFindings = matchReportFindings(input.reportFindings, [/safe zone/i, /overharvest/i, /extraction/i]).length;

  const evidenceUsed = [
    ...collectPhotoEvidence(images, DONOR_CATEGORIES, "Donor view"),
    ...findingsToEvidence(matchedFindings),
    collectCoverageEvidence("donor_baseline", "Donor baseline present", hasDonor),
  ].filter((x): x is NonNullable<typeof x> => x != null);

  const fields: DonorIntelligenceFields = {
    donorDensityBand: estimateDonorDensity(hasDonor, densityFindings),
    miniaturisationSuspicion: estimateMiniaturisation(hasDonor, miniFindings),
    retrogradeAlopeciaPattern: estimateRetrograde(hasDonor, retroFindings),
    extractionSafetyZoneConcerns: estimateExtractionSafety(hasDonor, safetyFindings),
    donorReserveRisk: "not_assessable",
  };
  fields.donorReserveRisk = estimateDonorReserve(
    fields.donorDensityBand,
    fields.miniaturisationSuspicion,
    fields.extractionSafetyZoneConcerns
  );

  let confidence = confidenceFromCoverage(evidenceUsed.length, 2, 3);
  if (hasLowQualityImages(images)) confidence = downgradeConfidence(confidence);
  if (!hasDonor) confidence = "very_low";

  let severity = severityFromFields(fields);
  ({ confidence, severity } = refineEngineSignalsFromClassifier({ confidence, severity, images }));

  const limitations = [
    ...buildStandardLimitations(input),
    ...(hasDonor ? [] : ["Donor rear / side baseline not available."]),
    "Donor density from photos cannot replace trichoscopy or calibrated measurement.",
  ];

  return {
    engineId: "donor_intelligence",
    engineVersion: HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION,
    classification: buildClassificationLabel(fields),
    fields,
    severity,
    confidence,
    evidenceUsed,
    patientSafeSummary: buildPatientSummary(fields),
    clinicianNotes: buildClinicianNotes(fields),
    suggestedNextStep: hasDonor
      ? "Clinician to map safe extraction zone and correlate with planned graft count."
      : "Upload pre-op donor rear and lateral donor views for reserve assessment.",
    limitations,
    advisoryOnly: true,
    executionMode: resolveExecutionMode(input),
    generatedAt: new Date().toISOString(),
  };
}
