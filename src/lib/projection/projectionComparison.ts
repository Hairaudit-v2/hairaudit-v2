/**
 * HA-PROJECTION-1F — Canonical projected vs observed comparison engine.
 *
 * Compares frozen 1D projection payload against frozen 1E observation payload only.
 * Does not re-read raw uploads, regenerate 1A/1B, or score success/accuracy.
 */

import {
  buildComparisonSummary,
  compareProjectedDomain,
  deriveOverallComparisonStatus,
  listComparableProjectedDomains,
} from "./projectionComparisonRules";
import { assertPatientSafeComparisonText } from "./projectionComparisonSafety";
import type { ProjectionObservationSnapshot } from "./projectionObservationTypes";
import type { ProjectionSnapshot } from "./projectionSnapshotTypes";
import type { ProjectionObservedComparison } from "./types";
import { COMPARISON_SCHEMA_VERSION } from "./versions";
import { checksumCanonical } from "./canonicalChecksum";

export type BuildProjectionObservedComparisonResult =
  | { ok: true; comparison: ProjectionObservedComparison }
  | { ok: false; reason: string; code: "LINEAGE_MISMATCH" | "INVALID_COMPARISON" | "UNSAFE_COMPARISON" };

/**
 * Build a deterministic comparison from immutable snapshots.
 * Fail closed when observation is not attached to the given projection.
 */
export function buildProjectionObservedComparison(args: {
  projection: ProjectionSnapshot;
  observation: ProjectionObservationSnapshot;
  generatedAt?: string;
}): BuildProjectionObservedComparisonResult {
  const { projection, observation } = args;

  if (observation.projectionSnapshotId !== projection.id) {
    return {
      ok: false,
      code: "LINEAGE_MISMATCH",
      reason:
        "Observation projectionSnapshotId does not match the frozen projection identity.",
    };
  }

  if (observation.caseId !== projection.caseId) {
    return {
      ok: false,
      code: "LINEAGE_MISMATCH",
      reason: "Observation caseId does not match projection caseId.",
    };
  }

  if (observation.patientId !== projection.patientId) {
    return {
      ok: false,
      code: "LINEAGE_MISMATCH",
      reason: "Observation patientId does not match projection patientId.",
    };
  }

  const projectedOutcome = projection.projectionSnapshot;
  const observationPayload = observation.observationPayload;
  const characteristics = listComparableProjectedDomains(projectedOutcome);

  const domains = characteristics.map((characteristic) =>
    compareProjectedDomain({
      characteristic,
      observation: observationPayload,
      reconstruction: projection.reconstructionSnapshot,
    })
  );

  const overallStatus = deriveOverallComparisonStatus(domains);
  const summary = buildComparisonSummary({
    stage: observation.stage,
    overallStatus,
    domains,
  });

  const limitations = [
    ...new Set([
      ...projectedOutcome.limitations.slice(0, 3),
      ...observationPayload.limitations.slice(0, 3),
      ...domains.flatMap((d) => d.limitations).slice(0, 4),
    ]),
  ];

  const generatedAt = args.generatedAt ?? new Date().toISOString();

  const comparison: ProjectionObservedComparison = {
    projectionSnapshotId: projection.id,
    observationSnapshotId: observation.id,
    caseId: projection.caseId,
    patientId: projection.patientId,
    stage: observation.stage,
    comparisonVersion: COMPARISON_SCHEMA_VERSION,
    overallStatus,
    domains,
    summary,
    limitations,
    generatedAt,
  };

  const safetyTexts = [
    comparison.summary,
    ...comparison.limitations,
    ...comparison.domains.flatMap((d) => [
      d.rationale,
      d.projectedCharacteristic,
      d.observedCharacteristic,
      ...d.limitations,
    ]),
  ];
  const safety = assertPatientSafeComparisonText(safetyTexts);
  if (!safety.ok) {
    return {
      ok: false,
      code: "UNSAFE_COMPARISON",
      reason: `Comparison failed patient-safe checks (${safety.violations.length} violation(s)).`,
    };
  }

  return { ok: true, comparison };
}

/** Domain hashed for idempotency — excludes volatile generatedAt. */
export function comparisonChecksumDomain(
  comparison: ProjectionObservedComparison,
  args: {
    projectionChecksum: string;
    observationChecksum: string;
  }
): unknown {
  const rest = { ...comparison };
  delete (rest as { generatedAt?: string }).generatedAt;
  return {
    projectionSnapshotId: comparison.projectionSnapshotId,
    observationSnapshotId: comparison.observationSnapshotId,
    projectionChecksum: args.projectionChecksum,
    observationChecksum: args.observationChecksum,
    comparisonVersion: comparison.comparisonVersion,
    payload: rest,
  };
}

export function computeComparisonChecksum(
  comparison: ProjectionObservedComparison,
  args: {
    projectionChecksum: string;
    observationChecksum: string;
  }
): string {
  return checksumCanonical(comparisonChecksumDomain(comparison, args));
}

/** Prefer projection output checksum; fall back to input checksum. */
export function resolveProjectionContentChecksum(
  projection: ProjectionSnapshot
): string {
  return (
    projection.projectionOutputChecksum ||
    projection.projectionInputChecksum ||
    projection.reconstructionInputChecksum
  );
}
