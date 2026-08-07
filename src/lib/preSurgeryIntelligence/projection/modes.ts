/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A / PHOTOREALISTIC-OUTCOME-2A —
 * Derive bounded projection modes + stored assumptions from approved graft plan.
 */

import type {
  PreSurgeryGraftPlan,
  PreSurgeryProjectionMode,
  ProjectionModeAssumptions,
} from "../types";
import { PRE_SURGERY_PROJECTION_PATIENT_LABELS } from "../types";
import { activeZoneRows } from "../graftPlanValidate";

export type ProjectionModeAllocation = {
  mode: PreSurgeryProjectionMode;
  patientSafeLabel: string;
  zoneGraftTargets: Array<{
    zone: string;
    grafts: number;
    priority: string;
  }>;
  totalGrafts: number;
  densityHint: "modest" | "planned" | "upper_range";
  scalpVisibilityHint: "preserve_realistic" | "planned" | "reduced_but_plausible";
  assumptions: ProjectionModeAssumptions;
};

function pickGrafts(
  row: { minimumGrafts: number; targetGrafts: number; maximumGrafts: number },
  mode: PreSurgeryProjectionMode
): number {
  switch (mode) {
    case "conservative":
      return row.minimumGrafts;
    case "planned":
      return row.targetGrafts;
    case "optimistic_within_approved_range":
      return row.maximumGrafts;
  }
}

function survivalRangeForMode(mode: PreSurgeryProjectionMode): { min: number; max: number } {
  switch (mode) {
    case "conservative":
      return { min: 70, max: 85 };
    case "planned":
      return { min: 80, max: 92 };
    case "optimistic_within_approved_range":
      return { min: 88, max: 95 };
  }
}

function densityRangeForMode(
  mode: PreSurgeryProjectionMode,
  totalGrafts: number,
  activeZoneCount: number
): { minPerCm2: number; maxPerCm2: number } {
  // Bounded illustrative density framing from graft totals — not a pixel measurement.
  const areaFactor = Math.max(1, activeZoneCount) * 12;
  const base = totalGrafts / areaFactor;
  switch (mode) {
    case "conservative":
      return {
        minPerCm2: Math.max(8, Math.round(base * 0.55)),
        maxPerCm2: Math.max(12, Math.round(base * 0.75)),
      };
    case "planned":
      return {
        minPerCm2: Math.max(12, Math.round(base * 0.75)),
        maxPerCm2: Math.max(18, Math.round(base * 0.95)),
      };
    case "optimistic_within_approved_range":
      return {
        minPerCm2: Math.max(16, Math.round(base * 0.9)),
        maxPerCm2: Math.max(24, Math.round(base * 1.1)),
      };
  }
}

/**
 * Modes are derived only from the approved graft range — never arbitrary aesthetics.
 */
export function deriveProjectionModeAllocation(
  plan: PreSurgeryGraftPlan,
  mode: PreSurgeryProjectionMode
): ProjectionModeAllocation {
  const active = activeZoneRows(plan.zones);
  const zoneGraftTargets = active.map((z) => ({
    zone: z.zone,
    grafts: pickGrafts(z, mode),
    priority: z.priority,
  }));
  const deferred = plan.zones.filter((z) => z.priority === "defer");
  for (const z of deferred) {
    zoneGraftTargets.push({ zone: z.zone, grafts: 0, priority: "defer" });
  }

  const totalGrafts = zoneGraftTargets.reduce((s, z) => s + z.grafts, 0);
  const densityHint =
    mode === "conservative" ? "modest" : mode === "planned" ? "planned" : "upper_range";
  const scalpVisibilityHint =
    mode === "conservative"
      ? "preserve_realistic"
      : mode === "planned"
        ? "planned"
        : "reduced_but_plausible";

  const recipientZones = zoneGraftTargets
    .filter((z) => z.grafts > 0)
    .map((z) => z.zone.replaceAll("_", " "))
    .join(", ");

  const assumptions: ProjectionModeAssumptions = {
    graftCount: totalGrafts,
    recipientAreaDescription: recipientZones || "approved recipient zones only",
    assumedGraftSurvivalRangePct: survivalRangeForMode(mode),
    hairsPerGraftAssumption: mode === "conservative" ? 2.0 : mode === "planned" ? 2.2 : 2.4,
    calibre: "patient-matched / not independently measured from photograph",
    colourToScalpContrast: "matched to source photograph contrast; not invented",
    curlTexture: "matched to visible native hair texture where present",
    nativeHairContribution:
      "existing native hair outside and within transition zones is preserved and contributes to visible density",
    projectedDensityRange: densityRangeForMode(mode, totalGrafts, active.length),
    densityHint,
    scalpVisibilityHint,
  };

  return {
    mode,
    patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS[mode],
    zoneGraftTargets,
    totalGrafts,
    densityHint,
    scalpVisibilityHint,
    assumptions,
  };
}

export const STANDARD_PRE_SURGERY_PROJECTION_ASSUMPTIONS = [
  "Illustrative planning aid only — not a guaranteed surgical outcome.",
  "Constrained to the clinician-approved graft plan and treatment zones.",
  "Facial identity, skin tone, and anatomy outside the recipient plan must be preserved.",
  "Hair calibre, curl, colour, and survival cannot be predicted as a guarantee from this image.",
] as const;
