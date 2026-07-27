/**
 * FI-OUTCOME-INTELLIGENCE-1F — Procedure date helpers for deterministic milestone status.
 */

import { addCalendarMonths } from "@/lib/outcomeIntelligence/longitudinalCaptureSchedule";
import type { LongitudinalOutcomeStage } from "@/lib/projection/types";

const STAGE_MONTHS: Readonly<Record<LongitudinalOutcomeStage, number>> = {
  month_3: 3,
  month_6: 6,
  month_9: 9,
  month_12: 12,
};

function toDateOnly(isoOrDate: string | Date): string {
  if (isoOrDate instanceof Date) {
    return isoOrDate.toISOString().slice(0, 10);
  }
  const s = String(isoOrDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date(s).toISOString().slice(0, 10);
}

/**
 * Procedure date such that `stage` target ≈ `now` (within capture window).
 * Used so live app Date.now() resolves the focus stage as due.
 */
export function procedureDateForDueStage(args: {
  stage: LongitudinalOutcomeStage;
  now?: string | Date;
}): string {
  const nowDate = toDateOnly(args.now ?? new Date());
  const months = STAGE_MONTHS[args.stage];
  return addCalendarMonths(nowDate, -months);
}

/**
 * Capture timestamp (ISO) that falls inside the stage timing window for evidence provenance.
 */
export function captureTimestampForStage(args: {
  procedureDate: string;
  stage: LongitudinalOutcomeStage;
}): string {
  const months = STAGE_MONTHS[args.stage];
  const mid = addCalendarMonths(args.procedureDate, months);
  return `${mid}T12:00:00.000Z`;
}
