"use client";

import { useEffect } from "react";
import { trackDonorReportViewedOnce } from "@/lib/analytics/donorFunnelEvents";

/**
 * HA-DONOR-HEALING-1B — emit donor_report_viewed once at the authenticated
 * patient report-view boundary (sessionStorage dedupe).
 */
export default function DonorReportViewedTracker({
  caseId,
  enabled,
}: {
  caseId: string;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled || !caseId) return;
    trackDonorReportViewedOnce(caseId);
  }, [caseId, enabled]);

  return null;
}
