/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Graft plan comparison (AI seed vs versions).
 */

import type { GraftPlanZone, PreSurgeryGraftPlan, PreSurgeryGraftPlanZoneRow } from "./types";

export type GraftPlanZoneDiff = {
  zone: GraftPlanZone;
  change: "added" | "removed" | "unchanged" | "grafts_increased" | "grafts_decreased" | "priority_changed";
  before?: PreSurgeryGraftPlanZoneRow;
  after?: PreSurgeryGraftPlanZoneRow;
  targetDelta?: number;
};

export type GraftPlanComparison = {
  zonesAdded: GraftPlanZone[];
  zonesRemoved: GraftPlanZone[];
  graftIncreases: GraftPlanZoneDiff[];
  graftDecreases: GraftPlanZoneDiff[];
  sessionCountChanged: boolean;
  donorCautionChanged: boolean;
  proposedHairlineChanged: boolean;
  deferredTreatmentChanged: boolean;
  zoneDiffs: GraftPlanZoneDiff[];
  totalTargetDelta: number;
};

function zoneMap(zones: PreSurgeryGraftPlanZoneRow[]): Map<GraftPlanZone, PreSurgeryGraftPlanZoneRow> {
  return new Map(zones.map((z) => [z.zone, z]));
}

function hairlineSignature(zones: PreSurgeryGraftPlanZoneRow[]): string {
  const h = zones.find((z) => z.zone === "hairline");
  if (!h) return "absent";
  return `${h.priority}:${h.minimumGrafts}:${h.targetGrafts}:${h.maximumGrafts}`;
}

export function compareGraftPlans(
  before: Pick<
    PreSurgeryGraftPlan,
    "zones" | "totalTargetGrafts" | "proposedSessionCount" | "donorAvailabilityBand" | "deferredZones"
  >,
  after: Pick<
    PreSurgeryGraftPlan,
    "zones" | "totalTargetGrafts" | "proposedSessionCount" | "donorAvailabilityBand" | "deferredZones"
  >
): GraftPlanComparison {
  const a = zoneMap(before.zones);
  const b = zoneMap(after.zones);
  const allZones = new Set<GraftPlanZone>([...a.keys(), ...b.keys()]);
  const zoneDiffs: GraftPlanZoneDiff[] = [];
  const zonesAdded: GraftPlanZone[] = [];
  const zonesRemoved: GraftPlanZone[] = [];
  const graftIncreases: GraftPlanZoneDiff[] = [];
  const graftDecreases: GraftPlanZoneDiff[] = [];

  for (const zone of allZones) {
    const prev = a.get(zone);
    const next = b.get(zone);
    if (!prev && next) {
      const diff: GraftPlanZoneDiff = { zone, change: "added", after: next };
      zoneDiffs.push(diff);
      zonesAdded.push(zone);
      continue;
    }
    if (prev && !next) {
      const diff: GraftPlanZoneDiff = { zone, change: "removed", before: prev };
      zoneDiffs.push(diff);
      zonesRemoved.push(zone);
      continue;
    }
    if (prev && next) {
      const targetDelta = next.targetGrafts - prev.targetGrafts;
      let change: GraftPlanZoneDiff["change"] = "unchanged";
      if (targetDelta > 0) change = "grafts_increased";
      else if (targetDelta < 0) change = "grafts_decreased";
      else if (prev.priority !== next.priority) change = "priority_changed";
      const diff: GraftPlanZoneDiff = { zone, change, before: prev, after: next, targetDelta };
      zoneDiffs.push(diff);
      if (change === "grafts_increased") graftIncreases.push(diff);
      if (change === "grafts_decreased") graftDecreases.push(diff);
    }
  }

  const deferredBefore = new Set(before.deferredZones);
  const deferredAfter = new Set(after.deferredZones);
  const deferredTreatmentChanged =
    deferredBefore.size !== deferredAfter.size ||
    [...deferredBefore].some((z) => !deferredAfter.has(z));

  return {
    zonesAdded,
    zonesRemoved,
    graftIncreases,
    graftDecreases,
    sessionCountChanged: before.proposedSessionCount !== after.proposedSessionCount,
    donorCautionChanged: before.donorAvailabilityBand !== after.donorAvailabilityBand,
    proposedHairlineChanged: hairlineSignature(before.zones) !== hairlineSignature(after.zones),
    deferredTreatmentChanged,
    zoneDiffs,
    totalTargetDelta: after.totalTargetGrafts - before.totalTargetGrafts,
  };
}

export type PlanComparisonView = {
  aiStartingPlan: PreSurgeryGraftPlan | null;
  previousClinicianVersion: PreSurgeryGraftPlan | null;
  currentClinicianVersion: PreSurgeryGraftPlan | null;
  finalApprovedPlan: PreSurgeryGraftPlan | null;
  vsAi: GraftPlanComparison | null;
  vsPrevious: GraftPlanComparison | null;
};

export function buildPlanComparisonView(plans: PreSurgeryGraftPlan[]): PlanComparisonView {
  const sorted = [...plans].sort((a, b) => a.version - b.version);
  const aiStartingPlan = sorted.find((p) => p.aiSeedPlanId == null && p.version === 1) ?? sorted[0] ?? null;
  const approved = [...sorted].reverse().find((p) => p.status === "approved") ?? null;
  const current =
    [...sorted].reverse().find((p) => p.status === "draft" || p.status === "clinician_reviewed") ??
    approved ??
    sorted[sorted.length - 1] ??
    null;
  const previous =
    current != null
      ? sorted.filter((p) => p.version < current.version).sort((a, b) => b.version - a.version)[0] ?? null
      : null;

  return {
    aiStartingPlan,
    previousClinicianVersion: previous,
    currentClinicianVersion: current,
    finalApprovedPlan: approved,
    vsAi:
      aiStartingPlan && current && aiStartingPlan.id !== current.id
        ? compareGraftPlans(aiStartingPlan, current)
        : null,
    vsPrevious: previous && current ? compareGraftPlans(previous, current) : null,
  };
}
