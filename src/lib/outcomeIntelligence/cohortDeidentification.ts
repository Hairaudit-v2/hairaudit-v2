/**
 * FI-OUTCOME-INTELLIGENCE-1A — De-identification validation + row checksum.
 *
 * Checksums cover de-identified normalized payload only — never PHI.
 */

import { checksumCanonical } from "@/lib/projection/canonicalChecksum";
import {
  COHORT_ALLOWLISTED_KEYS,
  COHORT_PROHIBITED_KEYS,
  type CohortRowChecksumPayload,
  type OutcomeLongitudinalCohortRow,
} from "./cohortTypes";

export type DeidentificationScanResult =
  | { ok: true }
  | { ok: false; prohibitedKeys: string[]; reason: string };

function collectKeys(value: unknown, into: Set<string>): void {
  if (value == null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into);
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    into.add(k);
    collectKeys(v, into);
  }
}

/**
 * Scan a serialized object for prohibited PHI / identity keys (incl. camelCase).
 */
export function scanForProhibitedCohortKeys(
  value: unknown
): DeidentificationScanResult {
  const keys = new Set<string>();
  collectKeys(value, keys);
  const prohibitedKeys = COHORT_PROHIBITED_KEYS.filter((k) => keys.has(k));
  if (prohibitedKeys.length) {
    return {
      ok: false,
      prohibitedKeys: [...prohibitedKeys],
      reason: `Prohibited cohort keys present: ${prohibitedKeys.join(", ")}`,
    };
  }
  return { ok: true };
}

/**
 * Ensure only allowlisted top-level keys on a cohort row / payload.
 */
export function assertAllowlistedCohortKeys(
  row: Record<string, unknown>
): DeidentificationScanResult {
  const unknown = Object.keys(row).filter((k) => !COHORT_ALLOWLISTED_KEYS.has(k));
  if (unknown.length) {
    return {
      ok: false,
      prohibitedKeys: unknown,
      reason: `Non-allowlisted cohort keys: ${unknown.join(", ")}`,
    };
  }
  return scanForProhibitedCohortKeys(row);
}

/** Build the checksum domain from a de-identified payload (no HMAC identity keys). */
export function buildCohortChecksumPayload(
  row: CohortRowChecksumPayload
): CohortRowChecksumPayload {
  return {
    cohortSchemaVersion: row.cohortSchemaVersion,
    projectionSnapshotChecksum: row.projectionSnapshotChecksum,
    observationSnapshotChecksum: row.observationSnapshotChecksum,
    comparisonSnapshotChecksum: row.comparisonSnapshotChecksum,
    projectionSchemaVersion: row.projectionSchemaVersion,
    observationSchemaVersion: row.observationSchemaVersion,
    comparisonSchemaVersion: row.comparisonSchemaVersion,
    followupStage: row.followupStage,
    comparisonStatus: row.comparisonStatus,
    projectionDomain: row.projectionDomain,
    projectionConfidenceBand: row.projectionConfidenceBand,
    observationConfidenceBand: row.observationConfidenceBand,
    comparisonConfidenceBand: row.comparisonConfidenceBand,
    assessmentMode: row.assessmentMode,
    baselineAvailable: row.baselineAvailable,
    procedureTypeNormalized: row.procedureTypeNormalized,
    graftCountBand: row.graftCountBand,
    hairsPerGraftBand: row.hairsPerGraftBand,
    punchSizeBand: row.punchSizeBand,
    treatedHairline: row.treatedHairline,
    treatedTemples: row.treatedTemples,
    treatedFrontal: row.treatedFrontal,
    treatedForelock: row.treatedForelock,
    treatedMidScalp: row.treatedMidScalp,
    treatedCrown: row.treatedCrown,
    donorEvidenceAvailable: row.donorEvidenceAvailable,
    evidenceCompletenessBand: row.evidenceCompletenessBand,
    isCurrentSourceLineage: row.isCurrentSourceLineage,
  };
}

export function computeCohortRowChecksum(
  payload: CohortRowChecksumPayload
): string {
  return checksumCanonical(buildCohortChecksumPayload(payload));
}

/**
 * Validate a fully built cohort row for analytics safety.
 */
export function validateCohortRowDeidentified(
  row: OutcomeLongitudinalCohortRow
): DeidentificationScanResult {
  const asRecord = { ...row } as unknown as Record<string, unknown>;
  const allow = assertAllowlistedCohortKeys(asRecord);
  if (!allow.ok) return allow;

  // Identity keys must not equal raw UUID-looking source material (heuristic).
  const rawIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    rawIdPattern.test(row.cohortSubjectKey) ||
    rawIdPattern.test(row.cohortProcedureKey)
  ) {
    return {
      ok: false,
      prohibitedKeys: ["cohortSubjectKey", "cohortProcedureKey"],
      reason: "Cohort identity keys must not be raw UUIDs.",
    };
  }

  return { ok: true };
}
