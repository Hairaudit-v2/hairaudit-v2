/**
 * HA-INTELLIGENCE-2 — env gates for advisory intelligence shadow wiring (server-only).
 */

/** Log non-PII intelligence shadow diagnostics (dev/test by default). */
export function shouldLogHairAuditIntelligenceShadow(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.HAIRAUDIT_INTELLIGENCE_SHADOW_LOGS === "true") return true;
  const n = process.env.NODE_ENV;
  return n === "development" || n === "test";
}

/**
 * Professional review panel: auditors and doctors may inspect advisory bundle metadata.
 * Non-production by default; production requires `HAIRAUDIT_INTELLIGENCE_REVIEW_PANEL=true`.
 */
export function isHairAuditIntelligenceReviewPanelEnabled(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.HAIRAUDIT_INTELLIGENCE_REVIEW_PANEL === "true") return true;
  return process.env.NODE_ENV !== "production";
}

/** Pure helper for tests — auditor and doctor roles may view advisory intelligence panel. */
export function canShowHairAuditIntelligencePanelForRole(role: string | null | undefined): boolean {
  return role === "auditor" || role === "doctor";
}

/**
 * HA-INTELLIGENCE-7 — patient "What we observed from your images" section.
 * Off by default everywhere; opt-in via `HAIRAUDIT_INTELLIGENCE_PATIENT_OBSERVATIONS=true`.
 * Kept conservative because this is the first patient-facing intelligence surface.
 */
export function isHairAuditIntelligencePatientObservationsEnabled(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.HAIRAUDIT_INTELLIGENCE_PATIENT_OBSERVATIONS === "true";
}

/**
 * HA-INTELLIGENCE-7 — persistence of intelligence snapshot history.
 * Enabled in non-production by default; production requires
 * `HAIRAUDIT_INTELLIGENCE_SNAPSHOT_PERSIST=true`.
 */
export function isHairAuditIntelligenceSnapshotPersistenceEnabled(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.HAIRAUDIT_INTELLIGENCE_SNAPSHOT_PERSIST === "true") return true;
  return process.env.NODE_ENV !== "production";
}
