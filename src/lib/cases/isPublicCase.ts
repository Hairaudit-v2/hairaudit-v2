/**
 * Single source of truth for whether a case is visible in public-facing UI.
 * Only cases with audit_mode === 'public' should appear in clinic profiles,
 * discovery, and public APIs.
 */

export type CaseWithVisibility = {
  audit_mode?: string | null;
  visibility_scope?: string | null;
};

/**
 * Returns true if the case is explicitly public (visible in discovery, profiles, rankings).
 * Use this for filtering case lists in public-facing pages and APIs.
 */
export function isPublicCase(caseItem: CaseWithVisibility | null | undefined): boolean {
  if (!caseItem) return false;
  // TODO: audit_mode will become the single source of truth; fallback for records not yet populated
  return caseItem.audit_mode === "public" || caseItem.visibility_scope === "public";
}
