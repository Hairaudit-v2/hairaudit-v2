/**
 * Milestone / procedure-relative timing helpers for HA-PHOTO-TIMELINE-2A.
 */

import type { PhotoSessionMilestone } from "@/lib/photoSessions/types";
import { FOLLOW_UP_MILESTONES } from "@/lib/photoSessions/types";

const MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;

/** Approximate calendar-month bands from relative day. */
export function milestoneFromRelativeDay(relativeDay: number | null | undefined): PhotoSessionMilestone {
  if (relativeDay == null || !Number.isFinite(relativeDay)) return "unknown";
  if (relativeDay < 0) return "pre_surgery";
  if (relativeDay <= 1) return "surgery_day";
  if (relativeDay < 21) return "early_recovery";
  if (relativeDay < 45) return "month_1";
  if (relativeDay < 120) return "month_3";
  if (relativeDay < 210) return "month_6";
  if (relativeDay < 300) return "month_9";
  if (relativeDay < 450) return "month_12";
  if (relativeDay < 600) return "month_18";
  return "long_term";
}

export function relativeDayFromDates(
  capturedAt: Date | string | null | undefined,
  procedureDate: Date | string | null | undefined
): number | null {
  if (!capturedAt || !procedureDate) return null;
  const capture = typeof capturedAt === "string" ? new Date(capturedAt) : capturedAt;
  const procedure = typeof procedureDate === "string" ? new Date(procedureDate) : procedureDate;
  if (Number.isNaN(capture.getTime()) || Number.isNaN(procedure.getTime())) return null;
  const diffMs = capture.getTime() - procedure.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

export function milestoneFromMonthsSinceBand(
  band: string | null | undefined
): PhotoSessionMilestone | null {
  switch (band) {
    case "under_3":
      return "early_recovery";
    case "3_6":
      return "month_3";
    case "6_9":
      return "month_6";
    case "9_12":
      return "month_9";
    case "12_plus":
      return "month_12";
    default:
      return null;
  }
}

/** Ordinal for comparing clinical “lateness” of follow-up milestones. */
export function followUpMilestoneOrdinal(milestone: PhotoSessionMilestone): number {
  const idx = (FOLLOW_UP_MILESTONES as readonly string[]).indexOf(milestone);
  return idx >= 0 ? idx : -1;
}

export function isFollowUpMilestone(milestone: PhotoSessionMilestone): boolean {
  return followUpMilestoneOrdinal(milestone) >= 0;
}

/** True when follow-up is mature enough for full readiness (≈ month_6+). */
export function isMatureFollowUpMilestone(milestone: PhotoSessionMilestone): boolean {
  return followUpMilestoneOrdinal(milestone) >= followUpMilestoneOrdinal("month_6");
}

export function monthsApproximateFromRelativeDay(relativeDay: number | null): number | null {
  if (relativeDay == null || !Number.isFinite(relativeDay) || relativeDay < 0) return null;
  return relativeDay / 30.4375;
}

export function compareClinicalRecency(
  a: {
    capturedAt: string | null;
    relativeDay: number | null;
    milestone: PhotoSessionMilestone;
    uploadedAt: string;
  },
  b: {
    capturedAt: string | null;
    relativeDay: number | null;
    milestone: PhotoSessionMilestone;
    uploadedAt: string;
  }
): number {
  // Prefer later clinical capture date.
  const aCap = a.capturedAt ? Date.parse(a.capturedAt) : NaN;
  const bCap = b.capturedAt ? Date.parse(b.capturedAt) : NaN;
  if (!Number.isNaN(aCap) && !Number.isNaN(bCap) && aCap !== bCap) {
    return aCap - bCap;
  }
  if (!Number.isNaN(aCap) && Number.isNaN(bCap)) return 1;
  if (Number.isNaN(aCap) && !Number.isNaN(bCap)) return -1;

  // Then procedure-relative day.
  if (a.relativeDay != null && b.relativeDay != null && a.relativeDay !== b.relativeDay) {
    return a.relativeDay - b.relativeDay;
  }
  if (a.relativeDay != null && b.relativeDay == null) return 1;
  if (a.relativeDay == null && b.relativeDay != null) return -1;

  // Then milestone ordinal.
  const ord = followUpMilestoneOrdinal(a.milestone) - followUpMilestoneOrdinal(b.milestone);
  if (ord !== 0) return ord;

  // Never prefer upload date for clinical lateness when capture differs;
  // only as final deterministic tie-break.
  return Date.parse(a.uploadedAt) - Date.parse(b.uploadedAt);
}

export function parseIsoDateOnly(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Approximate captured_at from procedure date + relative day (for derived sessions). */
export function capturedAtFromProcedureAndRelativeDay(
  procedureDateIso: string | null,
  relativeDay: number | null
): string | null {
  if (!procedureDateIso || relativeDay == null) return null;
  const base = new Date(procedureDateIso);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + relativeDay);
  return base.toISOString();
}

export function relativeDayFromMilestone(milestone: PhotoSessionMilestone): number | null {
  switch (milestone) {
    case "pre_surgery":
      return -30;
    case "surgery_day":
      return 0;
    case "early_recovery":
      return 14;
    case "month_1":
      return 30;
    case "month_3":
      return 90;
    case "month_6":
      return 180;
    case "month_9":
      return 270;
    case "month_12":
      return 365;
    case "month_18":
      return 540;
    case "long_term":
      return 730;
    default:
      return null;
  }
}

export function monthsMs(): number {
  return MONTH_MS;
}
