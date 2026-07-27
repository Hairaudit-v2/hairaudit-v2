/**
 * FI-OUTCOME-INTELLIGENCE-1A — Metadata / evidence / confidence normalization.
 *
 * Bands only — no exact graft counts, narratives, or free-text zones.
 */

import { normalizeRecipientZone } from "@/lib/projection/surgeryDayZones";
import type {
  ComparisonConfidence,
  LongitudinalOutcomeStage,
  ObservationConfidence,
  ProjectionConfidence,
  SurgeryDayProcedureReconstruction,
  SurgeryDayReconstructionMode,
} from "@/lib/projection/types";
import type { ProjectionSnapshot } from "@/lib/projection/projectionSnapshotTypes";
import type { ProjectionObservationSnapshot } from "@/lib/projection/projectionObservationTypes";
import type {
  CohortConfidenceBand,
  EvidenceCompletenessBand,
  GraftCountBand,
  HairsPerGraftBand,
  ProcedureTypeNormalized,
  PunchSizeBand,
} from "./cohortTypes";

export const GRAFT_COUNT_BAND_BOUNDARIES = {
  under_1500: { maxExclusive: 1500 },
  "1500_2499": { minInclusive: 1500, maxExclusive: 2500 },
  "2500_3499": { minInclusive: 2500, maxExclusive: 3500 },
  "3500_4499": { minInclusive: 3500, maxExclusive: 4500 },
  "4500_plus": { minInclusive: 4500 },
} as const;

export const HAIRS_PER_GRAFT_BAND_BOUNDARIES = {
  under_1_8: { maxExclusive: 1.8 },
  "1_8_to_2_1": { minInclusive: 1.8, maxExclusive: 2.1 },
  "2_1_to_2_4": { minInclusive: 2.1, maxExclusive: 2.4 },
  over_2_4: { minInclusive: 2.4 },
} as const;

export const PUNCH_SIZE_BAND_BOUNDARIES = {
  under_0_8: { maxExclusive: 0.8 },
  "0_8_to_0_89": { minInclusive: 0.8, maxExclusive: 0.9 },
  "0_9_to_0_99": { minInclusive: 0.9, maxExclusive: 1.0 },
  "1_0_plus": { minInclusive: 1.0 },
} as const;

export function bandConfidence(
  value: ProjectionConfidence | ObservationConfidence | ComparisonConfidence | string | null | undefined
): CohortConfidenceBand {
  if (value === "low" || value === "moderate" || value === "high") return value;
  return "low";
}

export function bandGraftCount(count: number | null | undefined): GraftCountBand {
  if (count == null || !Number.isFinite(count) || count < 0) return "unknown";
  if (count < 1500) return "under_1500";
  if (count < 2500) return "1500_2499";
  if (count < 3500) return "2500_3499";
  if (count < 4500) return "3500_4499";
  return "4500_plus";
}

export function bandHairsPerGraft(
  value: number | null | undefined
): HairsPerGraftBand {
  if (value == null || !Number.isFinite(value) || value <= 0) return "unknown";
  if (value < 1.8) return "under_1_8";
  if (value < 2.1) return "1_8_to_2_1";
  if (value < 2.4) return "2_1_to_2_4";
  return "over_2_4";
}

export function bandPunchSizeMm(value: number | null | undefined): PunchSizeBand {
  if (value == null || !Number.isFinite(value) || value <= 0) return "unknown";
  if (value < 0.8) return "under_0_8";
  if (value < 0.9) return "0_8_to_0_89";
  if (value < 1.0) return "0_9_to_0_99";
  return "1_0_plus";
}

export function normalizeProcedureType(
  raw: string | null | undefined
): ProcedureTypeNormalized {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!s) return "unknown";
  if (/\bfue\b|follicular unit extraction/.test(s)) return "fue";
  if (/\bfut\b|strip|follicular unit transplant/.test(s)) return "fut";
  if (/combo|combined|fue\+fut|fut\+fue/.test(s)) return "combo";
  if (/other|unknown|n\/a|na/.test(s)) return s.includes("other") ? "other" : "unknown";
  return "other";
}

export type TreatedZoneFlags = {
  treatedHairline: boolean;
  treatedTemples: boolean;
  treatedFrontal: boolean;
  treatedForelock: boolean;
  treatedMidScalp: boolean;
  treatedCrown: boolean;
};

export function normalizeTreatedZoneFlags(
  areas: readonly string[] | null | undefined
): TreatedZoneFlags {
  const flags: TreatedZoneFlags = {
    treatedHairline: false,
    treatedTemples: false,
    treatedFrontal: false,
    treatedForelock: false,
    treatedMidScalp: false,
    treatedCrown: false,
  };
  for (const raw of areas ?? []) {
    const z = normalizeRecipientZone(raw);
    if (z === "hairline") flags.treatedHairline = true;
    else if (z === "temples") flags.treatedTemples = true;
    else if (z === "frontal") flags.treatedFrontal = true;
    else if (z === "forelock") flags.treatedForelock = true;
    else if (z === "mid_scalp") flags.treatedMidScalp = true;
    else if (z === "crown") flags.treatedCrown = true;
  }
  return flags;
}

/**
 * Evidence completeness band from frozen 1D evidence summary + 1E roles.
 * Does not expose raw upload counts.
 */
export function deriveEvidenceCompletenessBand(args: {
  projection: ProjectionSnapshot;
  observation: ProjectionObservationSnapshot;
}): EvidenceCompletenessBand {
  const presentRoles = new Set(args.projection.evidenceSummary.presentRoles ?? []);
  const followupRoles = new Set(
    args.observation.observationPayload.evidence.presentRoles ?? []
  );

  let score = 0;
  if (args.projection.evidenceSummary.baselineAvailable) score += 2;
  if (presentRoles.has("surgery_day_recipient")) score += 2;
  if (presentRoles.has("surgery_day_donor")) score += 1;
  if (presentRoles.has("surgery_day_design")) score += 1;

  if (followupRoles.has("followup_front")) score += 2;
  if (followupRoles.has("followup_top") || followupRoles.has("followup_crown"))
    score += 1;
  if (followupRoles.has("followup_recipient_closeup")) score += 1;
  if (
    followupRoles.has("followup_donor_rear") ||
    followupRoles.has("followup_donor_closeup")
  ) {
    score += 1;
  }

  // Stage provenance present on frozen observation
  if (args.observation.stage) score += 1;

  if (score >= 9) return "high";
  if (score >= 5) return "moderate";
  return "low";
}

export function resolveAssessmentMode(
  reconstruction: SurgeryDayProcedureReconstruction
): SurgeryDayReconstructionMode | "unknown" {
  // Mode is not always on reconstruction root; infer from assessmentType / baseline.
  if (reconstruction.assessmentType === "surgery_day_reconstruction_with_baseline") {
    return "baseline_plus_surgery_day";
  }
  if (reconstruction.assessmentType === "surgery_day_reconstruction") {
    return reconstruction.baseline?.available
      ? "baseline_plus_surgery_day"
      : "surgery_day_only";
  }
  if (reconstruction.baseline?.available) return "baseline_plus_surgery_day";
  return "surgery_day_only";
}

export function resolveGraftCountForBand(
  reconstruction: SurgeryDayProcedureReconstruction
): number | null {
  const ctx = reconstruction.procedureContext;
  if (ctx.actualGraftCount != null && Number.isFinite(ctx.actualGraftCount)) {
    return ctx.actualGraftCount;
  }
  if (ctx.reportedGraftCount != null && Number.isFinite(ctx.reportedGraftCount)) {
    return ctx.reportedGraftCount;
  }
  return null;
}

export function extractProcedureMetadataBands(
  reconstruction: SurgeryDayProcedureReconstruction
): {
  procedureTypeNormalized: ProcedureTypeNormalized;
  graftCountBand: GraftCountBand;
  hairsPerGraftBand: HairsPerGraftBand;
  punchSizeBand: PunchSizeBand;
  zones: TreatedZoneFlags;
  donorEvidenceAvailable: boolean;
} {
  const treated = [
    ...(reconstruction.procedureContext.treatedAreas ?? []),
    ...(reconstruction.recipient.observedTreatedAreas ?? []),
  ];
  return {
    procedureTypeNormalized: normalizeProcedureType(
      reconstruction.procedureContext.procedureType
    ),
    graftCountBand: bandGraftCount(resolveGraftCountForBand(reconstruction)),
    hairsPerGraftBand: bandHairsPerGraft(
      reconstruction.procedureContext.averageHairsPerGraft
    ),
    punchSizeBand: bandPunchSizeMm(reconstruction.procedureContext.punchSizeMm),
    zones: normalizeTreatedZoneFlags(treated),
    donorEvidenceAvailable: reconstruction.donor != null,
  };
}

export function isAllowedFollowupStage(
  stage: string
): stage is LongitudinalOutcomeStage {
  return (
    stage === "month_3" ||
    stage === "month_6" ||
    stage === "month_9" ||
    stage === "month_12"
  );
}

export type DomainComparisonFilters = {
  procedureTypeNormalized?: ProcedureTypeNormalized;
  graftCountBand?: GraftCountBand;
  evidenceCompletenessBand?: EvidenceCompletenessBand;
  treatedHairline?: boolean;
  treatedTemples?: boolean;
  treatedFrontal?: boolean;
  treatedForelock?: boolean;
  treatedMidScalp?: boolean;
  treatedCrown?: boolean;
  comparisonConfidenceBand?: CohortConfidenceBand;
};
