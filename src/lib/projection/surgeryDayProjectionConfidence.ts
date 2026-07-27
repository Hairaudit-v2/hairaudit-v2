/**
 * HA-PROJECTION-1B — Projection confidence (independent from reconstruction confidence).
 *
 * High reconstruction confidence does not automatically imply high projection confidence.
 * Projection confidence is not a probability of clinical success.
 */

import type {
  ProjectionConfidence,
  ReconstructionConfidence,
  SurgeryDayProcedureReconstruction,
} from "./types";

export type ProjectionConfidenceFactors = {
  reconstructionConfidence: ReconstructionConfidence;
  baselineAvailable: boolean;
  baselineProvenanceStrong: boolean;
  hasRecipient: boolean;
  hasDonor: boolean;
  hasDesign: boolean;
  hasMultipleSurgeryDayViews: boolean;
  procedureMetadataComplete: boolean;
  graftCountProvenanceReliable: boolean;
  supportedDomainCount: number;
  hasConflictingMetadata: boolean;
  usedWeakRecipientEvidence: boolean;
  imageLimitationsPresent: boolean;
};

function hasConflictingGraftMetadata(r: SurgeryDayProcedureReconstruction): boolean {
  const sources = new Set(r.graftEvidence.provenance.map((p) => p.source));
  if (sources.has("clinic_reported") && sources.has("patient_reported")) {
    const clinic = r.graftEvidence.provenance.find((p) => p.source === "clinic_reported");
    const patient = r.graftEvidence.provenance.find((p) => p.source === "patient_reported");
    if (clinic && patient && clinic.value !== patient.value) return true;
  }
  return r.evidence.limitations.some((l) => /reports?\s+\d/i.test(l) && /reports?/i.test(l));
}

function procedureMetadataComplete(r: SurgeryDayProcedureReconstruction): boolean {
  const ctx = r.procedureContext;
  return Boolean(
    (ctx.actualGraftCount != null || ctx.reportedGraftCount != null) &&
      ctx.treatedAreas.length > 0 &&
      (ctx.procedureType || ctx.extractionMethod || ctx.implantationMethod)
  );
}

function graftCountProvenanceReliable(r: SurgeryDayProcedureReconstruction): boolean {
  return (
    r.graftEvidence.source === "clinic_reported" ||
    r.graftEvidence.source === "mixed" ||
    r.graftEvidence.clinicReportedCount != null
  );
}

/**
 * Derive factor snapshot from a canonical 1A reconstruction.
 * Does not re-read uploads or forensic payloads.
 */
export function extractProjectionConfidenceFactors(
  reconstruction: SurgeryDayProcedureReconstruction,
  supportedDomainCount: number
): ProjectionConfidenceFactors {
  const roles = reconstruction.evidence.presentRoles;
  const surgeryDayRoles = roles.filter((r) => r.startsWith("surgery_day_"));
  const baselineRoles = roles.filter((r) => r.startsWith("preop_"));
  const usedWeakRecipient = reconstruction.evidence.limitations.some((l) =>
    /any_day0/i.test(l)
  );

  return {
    reconstructionConfidence: reconstruction.evidence.confidence,
    baselineAvailable: reconstruction.baseline.available,
    baselineProvenanceStrong:
      reconstruction.baseline.available && baselineRoles.length >= 2,
    hasRecipient: roles.includes("surgery_day_recipient"),
    hasDonor: roles.includes("surgery_day_donor"),
    hasDesign: roles.includes("surgery_day_design"),
    hasMultipleSurgeryDayViews: surgeryDayRoles.length >= 2,
    procedureMetadataComplete: procedureMetadataComplete(reconstruction),
    graftCountProvenanceReliable: graftCountProvenanceReliable(reconstruction),
    supportedDomainCount,
    hasConflictingMetadata: hasConflictingGraftMetadata(reconstruction),
    usedWeakRecipientEvidence: usedWeakRecipient,
    imageLimitationsPresent: reconstruction.evidence.limitations.length >= 3,
  };
}

/**
 * Score projection confidence from evidence factors.
 *
 * HIGH — strong reconstruction + valid baseline + multiple surgery-day views +
 *         reliable procedure context + few material conflicts + several domains
 * MODERATE — good surgery-day evidence with incomplete baseline/support
 * LOW — recipient-only, uncertain provenance, conflicts, or weak evidence
 */
export function deriveProjectionConfidence(
  factors: ProjectionConfidenceFactors
): ProjectionConfidence {
  if (
    factors.usedWeakRecipientEvidence ||
    !factors.hasRecipient ||
    factors.supportedDomainCount === 0
  ) {
    return "low";
  }

  // Conflicting metadata and recipient-only evidence cap at moderate/low
  if (factors.hasConflictingMetadata && !factors.baselineAvailable) {
    return "low";
  }

  const strongSignals = [
    factors.reconstructionConfidence === "high" || factors.reconstructionConfidence === "moderate",
    factors.baselineAvailable,
    factors.baselineProvenanceStrong,
    factors.hasMultipleSurgeryDayViews,
    factors.hasDonor,
    factors.hasDesign,
    factors.procedureMetadataComplete,
    factors.graftCountProvenanceReliable,
    factors.supportedDomainCount >= 3,
    !factors.hasConflictingMetadata,
  ].filter(Boolean).length;

  if (
    factors.reconstructionConfidence === "high" &&
    factors.baselineAvailable &&
    factors.hasMultipleSurgeryDayViews &&
    factors.procedureMetadataComplete &&
    !factors.hasConflictingMetadata &&
    factors.supportedDomainCount >= 3 &&
    strongSignals >= 7
  ) {
    return "high";
  }

  // Recipient-only (no donor, no design, no baseline) stays low/moderate
  if (!factors.hasDonor && !factors.hasDesign && !factors.baselineAvailable) {
    return factors.supportedDomainCount >= 2 && factors.reconstructionConfidence !== "low"
      ? "moderate"
      : "low";
  }

  if (factors.hasConflictingMetadata) {
    return "moderate";
  }

  if (
    factors.hasRecipient &&
    (factors.hasDonor || factors.hasDesign || factors.baselineAvailable) &&
    factors.supportedDomainCount >= 2
  ) {
    return "moderate";
  }

  return "low";
}

/**
 * Per-characteristic confidence — never exceeds overall projection confidence band
 * by inventing certainty from a single observation alone.
 */
export function characteristicConfidence(
  observationConfidence: ReconstructionConfidence | undefined,
  overall: ProjectionConfidence,
  opts?: { requiresBaseline?: boolean; baselineAvailable?: boolean }
): ProjectionConfidence {
  if (opts?.requiresBaseline && !opts.baselineAvailable) return "low";

  const fromObs: ProjectionConfidence =
    observationConfidence === "high"
      ? "moderate"
      : observationConfidence === "moderate"
        ? "moderate"
        : "low";

  const rank = { low: 0, moderate: 1, high: 2 } as const;
  return rank[fromObs] <= rank[overall] ? fromObs : overall;
}
