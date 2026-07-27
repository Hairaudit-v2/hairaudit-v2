/**
 * FI-OUTCOME-INTELLIGENCE-1C — Milestone target dates + capture windows.
 *
 * Product timing windows (not biological guarantees; distinct from 1E stage
 * provenance windows used for observation classification).
 *
 * Calendar-month arithmetic in UTC date-only space (YYYY-MM-DD).
 */

import { LONGITUDINAL_OUTCOME_STAGES } from "@/lib/projection/longitudinalEvidence";
import type { LongitudinalOutcomeStage } from "@/lib/projection/types";
import type { CaptureProtocolVersion } from "./longitudinalCaptureTypes";
import { CAPTURE_PROTOCOL_VERSION } from "./longitudinalCaptureTypes";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Half-window radius in days around each milestone target (inclusive bounds). */
export const CAPTURE_WINDOW_RADIUS_DAYS: Readonly<
  Record<LongitudinalOutcomeStage, number>
> = {
  month_3: 21,
  month_6: 30,
  month_9: 30,
  month_12: 45,
};

const STAGE_OFFSET_MONTHS: Readonly<Record<LongitudinalOutcomeStage, number>> = {
  month_3: 3,
  month_6: 6,
  month_9: 9,
  month_12: 12,
};

export type CaptureScheduleMilestone = {
  stage: LongitudinalOutcomeStage;
  targetDate: string;
  windowStart: string;
  windowEnd: string;
};

export type CaptureWindowRelation = "before" | "within" | "after";

/**
 * Normalize procedure date to YYYY-MM-DD.
 * Accepts date-only or ISO datetime (uses UTC calendar date).
 */
export function normalizeProcedureDate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (DATE_RE.test(s)) {
    const ts = Date.parse(`${s}T00:00:00Z`);
    if (Number.isNaN(ts)) return null;
    const roundTrip = new Date(ts).toISOString().slice(0, 10);
    return roundTrip === s ? s : null;
  }
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function utcParts(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split("-").map((x) => Number(x));
  return { y, m, d };
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

function formatUtcDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Add calendar months to a YYYY-MM-DD date (UTC).
 * Clamps day to last day of target month (e.g. Jan 31 + 1 month → Feb 28/29).
 */
export function addCalendarMonths(dateStr: string, months: number): string {
  const { y, m, d } = utcParts(dateStr);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const maxDay = daysInMonth(ny, nm);
  const nd = Math.min(d, maxDay);
  return formatUtcDate(ny, nm, nd);
}

/** Add/subtract whole days from YYYY-MM-DD (UTC). */
export function addCalendarDays(dateStr: string, days: number): string {
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  const next = new Date(ms + days * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

export function todayUtcDate(now: Date | string = new Date()): string {
  const d = typeof now === "string" ? new Date(now) : now;
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid now: ${String(now)}`);
  }
  return d.toISOString().slice(0, 10);
}

export function getWindowRadiusDays(
  stage: LongitudinalOutcomeStage,
  _protocolVersion: CaptureProtocolVersion = CAPTURE_PROTOCOL_VERSION
): number {
  void _protocolVersion;
  return CAPTURE_WINDOW_RADIUS_DAYS[stage];
}

export function buildMilestoneSchedule(args: {
  procedureDate: string;
  protocolVersion?: CaptureProtocolVersion;
}): CaptureScheduleMilestone[] {
  const procedureDate = normalizeProcedureDate(args.procedureDate);
  if (!procedureDate) {
    throw new Error("Invalid procedure date for capture schedule.");
  }
  const protocolVersion = args.protocolVersion ?? CAPTURE_PROTOCOL_VERSION;

  return LONGITUDINAL_OUTCOME_STAGES.map((stage) => {
    const targetDate = addCalendarMonths(procedureDate, STAGE_OFFSET_MONTHS[stage]);
    const radius = getWindowRadiusDays(stage, protocolVersion);
    return {
      stage,
      targetDate,
      windowStart: addCalendarDays(targetDate, -radius),
      windowEnd: addCalendarDays(targetDate, radius),
    };
  });
}

export function relateToCaptureWindow(args: {
  nowDate: string;
  windowStart: string;
  windowEnd: string;
}): CaptureWindowRelation {
  if (args.nowDate < args.windowStart) return "before";
  if (args.nowDate > args.windowEnd) return "after";
  return "within";
}

/**
 * Documented boundary semantics (inclusive):
 * - windowStart = target − radius days (inclusive)
 * - windowEnd = target + radius days (inclusive)
 * - "within" when windowStart ≤ nowDate ≤ windowEnd
 */
export function describeCaptureWindowPolicy(
  protocolVersion: CaptureProtocolVersion = CAPTURE_PROTOCOL_VERSION
): string {
  void protocolVersion;
  return [
    "Month 3: target ± 21 days (inclusive)",
    "Month 6: target ± 30 days (inclusive)",
    "Month 9: target ± 30 days (inclusive)",
    "Month 12: target ± 45 days (inclusive)",
    "Targets use calendar-month arithmetic from procedure date (UTC YYYY-MM-DD).",
  ].join("; ");
}
