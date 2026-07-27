/**
 * HA-PROJECTION-1F — Comparison confidence (distinct from 1A / 1B / 1E confidence).
 *
 * Factors: stage maturity, projection/observation confidence, evidence completeness,
 * domain mapping directness, limitations/conflicts.
 * Never expressed as a percentage.
 */

import type {
  ComparisonConfidence,
  LongitudinalOutcomeStage,
  ObservationConfidence,
  ProjectionComparisonStatus,
  ProjectionConfidence,
} from "./types";

/** Mirrors stage assessability labels from projectionComparisonRules (no import cycle). */
export type ComparisonDomainAssessability =
  | "not_yet_assessable"
  | "limited"
  | "partial"
  | "assessable";

export type ComparisonConfidenceFactors = {
  stage: LongitudinalOutcomeStage;
  domainAssessability: ComparisonDomainAssessability;
  projectionConfidence: ProjectionConfidence | null;
  observationConfidence: ObservationConfidence | null;
  evidenceComplete: boolean;
  directDomainMatch: boolean;
  limitationCount: number;
  status: ProjectionComparisonStatus;
};

function rank(c: ComparisonConfidence): number {
  return c === "high" ? 3 : c === "moderate" ? 2 : 1;
}

function minConfidence(a: ComparisonConfidence, b: ComparisonConfidence): ComparisonConfidence {
  return rank(a) <= rank(b) ? a : b;
}

function fromProjectionOrObservation(
  c: ProjectionConfidence | ObservationConfidence | null
): ComparisonConfidence {
  if (c === "high" || c === "moderate" || c === "low") return c;
  return "low";
}

/**
 * Derive comparison confidence independently of 1A/1B/1E labels.
 */
export function deriveComparisonConfidence(
  factors: ComparisonConfidenceFactors
): ComparisonConfidence {
  // Early / not-yet stages never reach high comparison confidence
  if (
    factors.status === "not_yet_assessable" ||
    factors.domainAssessability === "not_yet_assessable"
  ) {
    return "low";
  }

  if (factors.status === "insufficient_evidence" || !factors.evidenceComplete) {
    return "low";
  }

  let level: ComparisonConfidence = "moderate";

  if (factors.domainAssessability === "limited") {
    level = "low";
  } else if (factors.domainAssessability === "partial") {
    level = "moderate";
  } else if (factors.domainAssessability === "assessable") {
    level = "moderate";
  }

  const proj = fromProjectionOrObservation(factors.projectionConfidence);
  const obs = fromProjectionOrObservation(factors.observationConfidence);
  level = minConfidence(level, proj);
  level = minConfidence(level, obs);

  const matureStage =
    factors.stage === "month_9" || factors.stage === "month_12";
  const strongInputs = proj !== "low" && obs !== "low";

  if (
    matureStage &&
    factors.domainAssessability === "assessable" &&
    strongInputs &&
    factors.evidenceComplete &&
    factors.directDomainMatch &&
    factors.limitationCount <= 2 &&
    (factors.status === "consistent" ||
      factors.status === "divergent" ||
      factors.status === "partially_consistent")
  ) {
    level = "high";
  }

  // Early stage hard cap
  if (factors.stage === "month_3") {
    level = minConfidence(level, "low");
  } else if (factors.stage === "month_6" && level === "high") {
    level = "moderate";
  }

  // Weak observation evidence reduces confidence
  if (obs === "low") {
    level = minConfidence(level, "low");
  }

  return level;
}

export function extractComparisonConfidenceFactors(
  partial: Omit<ComparisonConfidenceFactors, never>
): ComparisonConfidenceFactors {
  return { ...partial };
}
