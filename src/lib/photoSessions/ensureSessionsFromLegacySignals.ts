/**
 * HA-PHOTO-TIMELINE-2A — Bootstrap helper when a case has no sessions yet.
 * Full additive reconcile lives in reconcileLegacyImagesIntoSessions.
 */

import {
  reconcileLegacyImagesIntoSessions,
  type ReconcileOptions,
  type ReconcileResult,
} from "@/lib/photoSessions/reconcileLegacyImagesIntoSessions";

export type EnsureSessionsOptions = ReconcileOptions;

export type EnsureSessionsResult = {
  created: boolean;
  sessionCount: number;
  imageCount: number;
  skippedReason?: "already_has_sessions" | "no_patient_photos" | "dry_run" | "nothing_to_link";
};

/**
 * If the case has no active/needs_review photo sessions, run full reconcile bootstrap.
 * When sessions already exist, delegates to additive reconcile (unlinked uploads only).
 */
export async function ensureSessionsFromLegacySignals(
  caseId: string,
  opts: EnsureSessionsOptions = {}
): Promise<EnsureSessionsResult> {
  const result = await reconcileLegacyImagesIntoSessions(caseId, opts);
  return {
    created: result.created,
    sessionCount: result.sessionCount,
    imageCount: result.imageCount,
    skippedReason:
      result.skippedReason === "nothing_to_link" && result.linkedOnly
        ? "already_has_sessions"
        : result.skippedReason,
  };
}

/** @deprecated Import from reconcileLegacyImagesIntoSessions — re-exported for callers. */
export { reconcileLegacyImagesIntoSessions } from "@/lib/photoSessions/reconcileLegacyImagesIntoSessions";
export type { ReconcileOptions, ReconcileResult };
