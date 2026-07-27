/**
 * HA-PROJECTION-1E — Observation confidence (separate from 1B projection confidence).
 */

import type {
  LongitudinalEvidenceRole,
  ObservationConfidence,
} from "./types";
import type { LongitudinalEvidenceAssessment } from "./longitudinalEvidence";

export type LongitudinalObservationConfidenceFactors = {
  imageQuality: ObservationConfidence;
  stageProvenance: ObservationConfidence;
  viewCompleteness: ObservationConfidence;
  treatedAreaCoverage: ObservationConfidence;
  baselineAvailability: ObservationConfidence;
  comparableAngle: ObservationConfidence;
  donorEvidence: ObservationConfidence;
  captureProtocol: ObservationConfidence;
};

const RANK: Record<ObservationConfidence, number> = {
  low: 0,
  moderate: 1,
  high: 2,
};

function minConfidence(...values: ObservationConfidence[]): ObservationConfidence {
  let min = RANK.high;
  for (const v of values) {
    min = Math.min(min, RANK[v]);
  }
  if (min <= 0) return "low";
  if (min === 1) return "moderate";
  return "high";
}

function viewCompletenessFromRoles(
  present: LongitudinalEvidenceRole[],
  assessment: LongitudinalEvidenceAssessment
): ObservationConfidence {
  if (assessment.missingMinimumRoles.length) return "low";
  if (present.length >= 4 && assessment.missingRecommendedRoles.length === 0) return "high";
  if (present.length >= 2) return "moderate";
  return "low";
}

function donorEvidenceConfidence(present: LongitudinalEvidenceRole[]): ObservationConfidence {
  if (present.includes("followup_donor_rear") && present.includes("followup_donor_closeup")) {
    return "high";
  }
  if (present.includes("followup_donor_rear")) return "moderate";
  return "low";
}

function captureProtocolConfidence(
  present: LongitudinalEvidenceRole[],
  crownRelevant: boolean
): ObservationConfidence {
  const core: LongitudinalEvidenceRole[] = [
    "followup_front",
    "followup_top",
    "followup_left",
    "followup_right",
    "followup_recipient_closeup",
    "followup_donor_rear",
  ];
  const needed = crownRelevant ? [...core, "followup_crown" as const] : core;
  const hit = needed.filter((r) => present.includes(r)).length;
  if (hit >= needed.length - 1) return "high";
  if (hit >= 3) return "moderate";
  return "low";
}

/**
 * Derive observation confidence factors from evidence assessment + optional signals.
 * Does not reuse 1B projection confidence.
 */
export function extractLongitudinalObservationConfidenceFactors(args: {
  assessment: LongitudinalEvidenceAssessment;
  stageProvenance: ObservationConfidence;
  imageQuality?: ObservationConfidence;
  baselineAvailable?: boolean;
  comparableAngle?: ObservationConfidence;
}): LongitudinalObservationConfidenceFactors {
  const present = args.assessment.presentRoles;
  return {
    imageQuality: args.imageQuality ?? "moderate",
    stageProvenance: args.stageProvenance,
    viewCompleteness: viewCompletenessFromRoles(present, args.assessment),
    treatedAreaCoverage:
      args.assessment.missingMinimumRoles.length === 0 ? "moderate" : "low",
    baselineAvailability: args.baselineAvailable ? "moderate" : "low",
    comparableAngle: args.comparableAngle ?? "moderate",
    donorEvidence: donorEvidenceConfidence(present),
    captureProtocol: captureProtocolConfidence(present, args.assessment.crownRelevant),
  };
}

/**
 * Aggregate observation confidence from factors.
 * Uncertain timing or poor quality always caps at low/moderate.
 */
export function deriveObservationConfidence(
  factors: LongitudinalObservationConfidenceFactors
): ObservationConfidence {
  // Hard caps
  if (factors.stageProvenance === "low" || factors.imageQuality === "low") {
    return "low";
  }

  // Single front image: never high
  if (factors.viewCompleteness === "low") {
    return factors.stageProvenance === "high" ? "moderate" : "low";
  }

  // Full standardized views can reach high
  if (factors.viewCompleteness === "high" && factors.captureProtocol === "high") {
    return "high";
  }

  return minConfidence(
    factors.stageProvenance,
    factors.imageQuality,
    factors.viewCompleteness,
    factors.treatedAreaCoverage,
    factors.captureProtocol
  );
}
