/**
 * HA-DONOR-HEALING-1B — client-side donor funnel emission with duplicate prevention.
 * Safe dimensions only via donorHealingAnalyticsMeta.
 */

import { trackCta } from "@/lib/analytics/trackCta";
import {
  donorHealingAnalyticsMeta,
  type DonorFunnelEvent,
} from "@/lib/patient/donorHealingEntry";

const DEDUPE_PREFIX = "hairaudit:donor_funnel:";

function dedupeStorageKey(event: DonorFunnelEvent, scopeKey: string): string {
  return `${DEDUPE_PREFIX}${event}:${scopeKey}`;
}

/**
 * Emit a donor funnel event at most once per browser session for the given scope.
 * Returns true when the event was emitted.
 */
export function trackDonorFunnelEventOnce(
  event: DonorFunnelEvent,
  scopeKey: string,
  extra?: Record<string, unknown>
): boolean {
  if (typeof window === "undefined") return false;
  const key = dedupeStorageKey(event, scopeKey);
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
  } catch {
    // If storage is unavailable, still emit once this call — callers should
    // avoid remount loops; React effects typically run once per mount.
  }
  trackCta(event, donorHealingAnalyticsMeta(extra));
  return true;
}

export function trackDonorCaseSubmittedOnce(caseId: string): boolean {
  return trackDonorFunnelEventOnce("donor_case_submitted", caseId, {
    stage_route: "submitted",
  });
}

export function trackDonorReportViewedOnce(caseId: string): boolean {
  return trackDonorFunnelEventOnce("donor_report_viewed", caseId, {
    stage_route: "report_viewed",
  });
}
