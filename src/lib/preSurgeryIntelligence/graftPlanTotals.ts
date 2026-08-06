/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Graft plan totals (browser-safe; no node:crypto).
 */

import type { GraftPlanZone, PreSurgeryGraftPlan, PreSurgeryGraftPlanZoneRow } from "./types";

export function isDeferredPriority(priority: PreSurgeryGraftPlanZoneRow["priority"]): boolean {
  return priority === "defer";
}

/** Active (non-deferred) zone rows contribute to procedure totals. */
export function activeZoneRows(zones: PreSurgeryGraftPlanZoneRow[]): PreSurgeryGraftPlanZoneRow[] {
  return zones.filter((z) => !isDeferredPriority(z.priority));
}

/** Projection generation requires an approved graft plan (browser-safe gate). */
export function canGenerateProjectionFromPlan(plan: Pick<PreSurgeryGraftPlan, "status">): boolean {
  return plan.status === "approved";
}

export function computeGraftPlanTotals(zones: PreSurgeryGraftPlanZoneRow[]): {
  totalMinimumGrafts: number;
  totalTargetGrafts: number;
  totalMaximumGrafts: number;
  deferredZones: GraftPlanZone[];
} {
  const active = activeZoneRows(zones);
  const deferredZones = zones.filter((z) => isDeferredPriority(z.priority)).map((z) => z.zone);
  return {
    totalMinimumGrafts: active.reduce((s, z) => s + z.minimumGrafts, 0),
    totalTargetGrafts: active.reduce((s, z) => s + z.targetGrafts, 0),
    totalMaximumGrafts: active.reduce((s, z) => s + z.maximumGrafts, 0),
    deferredZones,
  };
}

export function withRecalculatedTotals<T extends { zones: PreSurgeryGraftPlanZoneRow[] }>(
  plan: T
): T & {
  totalMinimumGrafts: number;
  totalTargetGrafts: number;
  totalMaximumGrafts: number;
  deferredZones: GraftPlanZone[];
} {
  const totals = computeGraftPlanTotals(plan.zones);
  return {
    ...plan,
    totalMinimumGrafts: totals.totalMinimumGrafts,
    totalTargetGrafts: totals.totalTargetGrafts,
    totalMaximumGrafts: totals.totalMaximumGrafts,
    deferredZones: totals.deferredZones,
  };
}
