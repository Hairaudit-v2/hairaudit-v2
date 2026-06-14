/**
 * Stage 4B/4C — env gates for shadow logging, persistence, and auditor debug UI (server-only).
 */

export function shouldLogAuditOsShadow(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.HAIRAUDIT_AUDITOS_SHADOW_LOGS === "true") return true;
  const n = process.env.NODE_ENV;
  return n === "development" || n === "test";
}

/** Persist shadow rows to Supabase (service role). Off by default; never implied in production. */
export function isAuditOsShadowPersistEnabled(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.HAIRAUDIT_AUDITOS_SHADOW_PERSIST_ENABLED === "true";
}

/** Auditor-only debug panel: non-production by default, or explicit prod flag. */
export function isAuditOsDebugPanelEnabled(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.HAIRAUDIT_AUDITOS_DEBUG_PANEL === "true") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * AuditOS review panel (Stage 4D): non-production shows for auditors by default; production requires
 * `HAIRAUDIT_AUDITOS_REVIEW_PANEL=true`.
 */
export function isAuditOsReviewPanelEnabled(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.HAIRAUDIT_AUDITOS_REVIEW_PANEL === "true") return true;
  return process.env.NODE_ENV !== "production";
}
