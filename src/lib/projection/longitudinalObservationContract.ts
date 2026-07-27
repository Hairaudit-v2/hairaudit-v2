/**
 * HA-PROJECTION-1D/1E — Longitudinal observation attachment contract.
 *
 * 1E implements observed outcome capture attached to frozen projection_id.
 * Projected-vs-observed comparison remains deferred to HA-PROJECTION-1F.
 */

import { LONGITUDINAL_OUTCOME_STAGES } from "./longitudinalEvidence";
import type {
  LongitudinalObservationReference,
  LongitudinalObservationTimepoint,
  ProjectionSnapshot,
} from "./projectionSnapshotTypes";
import type { LongitudinalOutcomeStage } from "./types";

/** @deprecated Prefer LONGITUDINAL_OUTCOME_STAGES — same values. */
export const LONGITUDINAL_OBSERVATION_TIMEPOINTS = LONGITUDINAL_OUTCOME_STAGES;

export type { LongitudinalOutcomeStage };

/**
 * Build a reference that LongitudinalObservation rows attach to.
 * Critical: projectionId is the historical surgery-day snapshot — never recomputed.
 */
export function attachLongitudinalObservationReference(args: {
  snapshot: ProjectionSnapshot;
  observationTimepoint: LongitudinalObservationTimepoint | LongitudinalOutcomeStage;
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
