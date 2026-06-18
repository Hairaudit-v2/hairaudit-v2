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
