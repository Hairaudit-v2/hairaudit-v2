/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Seed an AI / rules-based starting graft plan.
 * Uses the same Norwood+crown heuristic as HA-REPORT-4A (not hard-coded universal limits).
 */

import type { CrownProgressionEstimate, NorwoodStageEstimate } from "@/lib/hairaudit-intelligence/types";
import { PRE_SURGERY_GRAFT_PLAN_VERSION } from "./versions";
import { checksumGraftPlanPayload, withRecalculatedTotals } from "./graftPlanValidate";
import type {
  DonorAvailabilityBand,
  GraftPlanZone,
  PreSurgeryGraftPlan,
  PreSurgeryGraftPlanZoneRow,
} from "./types";

function norwoodBaseRange(norwood: NorwoodStageEstimate): { min: number; max: number } | null {
  const base: Record<NorwoodStageEstimate, { min: number; max: number } | null> = {
    I: { min: 0, max: 800 },
    II: { min: 800, max: 1500 },
    III: { min: 1500, max: 2200 },
    III_vertex: { min: 1800, max: 2800 },
    IV: { min: 2200, max: 3500 },
    V: { min: 3000, max: 4500 },
    VI: { min: 4000, max: 5500 },
    VII: { min: 5000, max: 6500 },
    indeterminate: null,
    not_assessable: null,
  };
  return base[norwood];
}

function allocate(
  zone: GraftPlanZone,
  share: number,
  totalMin: number,
  totalMax: number,
  priority: PreSurgeryGraftPlanZoneRow["priority"],
  evidenceImageIds: string[]
): PreSurgeryGraftPlanZoneRow {
  if (priority === "defer") {
    return {
      zone,
      priority,
      minimumGrafts: 0,
      targetGrafts: 0,
      maximumGrafts: 0,
      evidenceImageIds,
      rationale: "Deferred pending staged planning",
    };
  }
  const minimumGrafts = Math.round(totalMin * share);
  const maximumGrafts = Math.round(totalMax * share);
  const targetGrafts = Math.round((minimumGrafts + maximumGrafts) / 2);
  return {
    zone,
    priority,
    minimumGrafts,
    targetGrafts,
    maximumGrafts,
    evidenceImageIds,
  };
}

export type SeedGraftPlanInput = {
  caseId: string;
  createdBy: string;
  norwood?: NorwoodStageEstimate | null;
  crown?: CrownProgressionEstimate | null;
  donorBand?: DonorAvailabilityBand | null;
  evidenceImageIds?: string[];
  sourceAssessmentId?: string | null;
  now?: string;
  id?: string;
};

/**
 * Build version-1 draft plan from pathway intelligence heuristics.
 * Clinician must review and approve before projection generation.
 */
export function seedAiGraftPlan(input: SeedGraftPlanInput): PreSurgeryGraftPlan {
  const now = input.now ?? new Date().toISOString();
  const evidence = input.evidenceImageIds ?? [];
  const norwood = input.norwood ?? "indeterminate";
  const crown = input.crown ?? "not_assessable";
  let range = norwoodBaseRange(norwood);
  if (range && (crown === "moderate" || crown === "advanced")) {
    range = { min: range.min + 200, max: range.max + 400 };
  }

  const totalMin = range?.min ?? 0;
  const totalMax = range?.max ?? 0;
  const deferCrown = crown === "advanced" || norwood === "VI" || norwood === "VII";

  const zones: PreSurgeryGraftPlanZoneRow[] = [
    allocate("hairline", 0.28, totalMin, totalMax, "essential", evidence),
    allocate("left_temple", 0.08, totalMin, totalMax, "recommended", evidence),
    allocate("right_temple", 0.08, totalMin, totalMax, "recommended", evidence),
    allocate("frontal_third", 0.32, totalMin, totalMax, "essential", evidence),
    allocate("mid_scalp", 0.14, totalMin, totalMax, deferCrown ? "optional" : "recommended", evidence),
    allocate(
      "crown",
      deferCrown ? 0 : 0.1,
      totalMin,
      totalMax,
      deferCrown ? "defer" : "optional",
      evidence
    ),
  ];

  const donorAvailabilityBand: DonorAvailabilityBand = input.donorBand ?? "not_assessable";
  const deferredZones = zones.filter((z) => z.priority === "defer").map((z) => z.zone);
  const stageOneZones = zones
    .filter((z) => z.priority === "essential" || z.priority === "recommended")
    .map((z) => z.zone);

  const draft = withRecalculatedTotals({
    id: input.id ?? crypto.randomUUID(),
    caseId: input.caseId,
    version: 1,
    schemaVersion: PRE_SURGERY_GRAFT_PLAN_VERSION,
    sourceAssessmentId: input.sourceAssessmentId ?? null,
    aiSeedPlanId: null,
    previousPlanId: null,
    zones,
    proposedSessionCount: deferCrown ? (2 as const) : (1 as const),
    stageOneZones,
    deferredZones,
    donorAvailabilityBand,
    planningAssumptions: [
      "Starting allocation derived from pattern-stage heuristics; clinician review required.",
      "Totals recalculate from zone rows; deferred zones do not contribute to procedure totals.",
      "Illustrative planning aid only — not a guaranteed surgical outcome.",
    ],
    status: "draft" as const,
    approvedBy: null,
    approvedAt: null,
    createdBy: input.createdBy,
    createdAt: now,
    checksum: "",
  });

  return {
    ...draft,
    checksum: checksumGraftPlanPayload(draft),
  };
}

export function createClinicianPlanRevision(
  previous: PreSurgeryGraftPlan,
  patch: Partial<
    Pick<
      PreSurgeryGraftPlan,
      | "zones"
      | "proposedSessionCount"
      | "stageOneZones"
      | "donorAvailabilityBand"
      | "donorConstraintNote"
      | "graftReserve"
      | "planningAssumptions"
      | "clinicianNote"
      | "status"
      | "approvedBy"
      | "approvedAt"
    >
  >,
  createdBy: string,
  opts?: { now?: string; id?: string }
): PreSurgeryGraftPlan {
  const now = opts?.now ?? new Date().toISOString();
  const zones = patch.zones ?? previous.zones;
  const draft = withRecalculatedTotals({
    id: opts?.id ?? crypto.randomUUID(),
    caseId: previous.caseId,
    version: previous.version + 1,
    schemaVersion: PRE_SURGERY_GRAFT_PLAN_VERSION,
    sourceAssessmentId: previous.sourceAssessmentId,
    aiSeedPlanId: previous.aiSeedPlanId ?? (previous.version === 1 ? previous.id : previous.aiSeedPlanId),
    previousPlanId: previous.id,
    zones,
    proposedSessionCount: patch.proposedSessionCount ?? previous.proposedSessionCount,
    stageOneZones: patch.stageOneZones ?? previous.stageOneZones,
    deferredZones: [] as GraftPlanZone[],
    donorAvailabilityBand: patch.donorAvailabilityBand ?? previous.donorAvailabilityBand,
    donorConstraintNote: patch.donorConstraintNote ?? previous.donorConstraintNote,
    graftReserve: patch.graftReserve ?? previous.graftReserve,
    planningAssumptions: patch.planningAssumptions ?? previous.planningAssumptions,
    clinicianNote: patch.clinicianNote ?? previous.clinicianNote,
    status: patch.status ?? "draft",
    approvedBy: patch.approvedBy ?? null,
    approvedAt: patch.approvedAt ?? null,
    createdBy,
    createdAt: now,
    checksum: "",
  });
  return {
    ...draft,
    checksum: checksumGraftPlanPayload(draft),
  };
}
