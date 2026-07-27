/**
 * HA-PROJECTION-1D — Longitudinal observation attachment contract (future months).
 *
 * Do NOT implement month-3/6/9/12 outcome modelling here.
 * Future observation records must reference a frozen projection_id so comparisons
 * never recalculate day-0 projections from later clinical data.
 */

import type {
  LongitudinalObservationReference,
  LongitudinalObservationTimepoint,
  ProjectionSnapshot,
} from "./projectionSnapshotTypes";

export const LONGITUDINAL_OBSERVATION_TIMEPOINTS = [
  "month_3",
  "month_6",
  "month_9",
  "month_12",
] as const satisfies readonly LongitudinalObservationTimepoint[];

/**
 * Build a reference that future LongitudinalObservation rows can attach to.
 * Critical: projectionId is the historical surgery-day snapshot — never recomputed.
 */
export function attachLongitudinalObservationReference(args: {
  snapshot: ProjectionSnapshot;
  observationTimepoint: LongitudinalObservationTimepoint;
  observationDate: string;
  measurementVersion?: string | null;
}): LongitudinalObservationReference {
  return {
    projectionId: args.snapshot.id,
    procedureId: args.snapshot.procedureId,
    caseId: args.snapshot.caseId,
    observationTimepoint: args.observationTimepoint,
    observationDate: args.observationDate,
    measurementVersion: args.measurementVersion ?? null,
  };
}

/**
 * Safety assertion helper for future comparison code:
 * later outcome data must not flow backwards into the historical projection.
 */
export function assertNoRetrospectiveContamination(args: {
  historicalProjectionId: string;
  comparisonProjectionId: string;
}): { ok: true } | { ok: false; reason: string } {
  if (args.historicalProjectionId !== args.comparisonProjectionId) {
    return {
      ok: false,
      reason:
        "Projection comparison must reference the original historical projection_id — not a recalculated projection.",
    };
  }
  return { ok: true };
}
