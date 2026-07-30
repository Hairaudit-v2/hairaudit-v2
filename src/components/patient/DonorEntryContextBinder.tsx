"use client";

import { useEffect } from "react";
import { DONOR_HEALING_ENTRY_CONTEXT } from "@/lib/patient/donorHealingEntry";
import {
  parseEntryContextFromSearchParams,
  stashPendingEntryContext,
} from "@/lib/patient/patientEntryContext";

/**
 * HA-DONOR-HEALING-1A — bind validated donor entry query params into sessionStorage
 * so auth/claim returns do not drop context when URL query is stripped.
 */
export default function DonorEntryContextBinder({
  search,
  forceDonorHealing = false,
}: {
  search: string;
  forceDonorHealing?: boolean;
}) {
  useEffect(() => {
    const parsed = parseEntryContextFromSearchParams(search);
    if (parsed) {
      stashPendingEntryContext({
        entryContext: parsed.entryContext,
        concern: parsed.concern,
        sourceGuide: parsed.sourceGuide,
        recommendedPathway: parsed.recommendedPathway,
      });
      return;
    }
    if (forceDonorHealing) {
      stashPendingEntryContext({
        entryContext: DONOR_HEALING_ENTRY_CONTEXT,
        concern: "donor_healing",
        recommendedPathway: "post_surgery",
      });
    }
  }, [forceDonorHealing, search]);

  return null;
}
