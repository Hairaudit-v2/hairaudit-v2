/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Derive bounded projection modes from approved graft plan.
 */

import type { PreSurgeryGraftPlan, PreSurgeryProjectionMode } from "../types";
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

  return {
    mode,
    patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS[mode],
    zoneGraftTargets,
    totalGrafts: zoneGraftTargets.reduce((s, z) => s + z.grafts, 0),
    densityHint:
      mode === "conservative" ? "modest" : mode === "planned" ? "planned" : "upper_range",
    scalpVisibilityHint:
      mode === "conservative"
        ? "preserve_realistic"
        : mode === "planned"
          ? "planned"
          : "reduced_but_plausible",
  };
}

export const STANDARD_PRE_SURGERY_PROJECTION_ASSUMPTIONS = [
  "Illustrative planning aid only — not a guaranteed surgical outcome.",
  "Projection is constrained to the clinician-approved graft plan and treatment zones.",
  "Facial identity, skin tone, and anatomy outside the recipient plan must be preserved.",
  "Hair calibre, curl, colour, and survival cannot be predicted from this projection.",
] as const;
