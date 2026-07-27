/**
 * FI-OUTCOME-INTELLIGENCE-1E — Pure wizard / resume helpers over guided DTO views.
 */

import type { LongitudinalCaptureMilestoneStatus } from "./longitudinalCaptureTypes";
import type {
  GuidedCaptureViewDto,
  GuidedCaptureWizardStep,
  GuidedLongitudinalCaptureDto,
} from "./guidedCaptureDto";

export function orderedGuidedViews(
  views: GuidedCaptureViewDto[]
): GuidedCaptureViewDto[] {
  const required = views.filter((v) => v.required);
  const recommended = views.filter((v) => !v.required);
  return [...required, ...recommended];
}

export function firstMissingRequiredView(
  views: GuidedCaptureViewDto[]
): GuidedCaptureViewDto | null {
  return orderedGuidedViews(views).find((v) => v.required && !v.complete) ?? null;
}

export function allRequiredComplete(views: GuidedCaptureViewDto[]): boolean {
  return views.filter((v) => v.required).every((v) => v.complete);
}

/**
 * Resume policy:
 * - future / ready / observed → status screen
 * - due / missed with no required complete → intro/entry
 * - evidence_incomplete (or any partial) → first missing required view
 * - all required complete → review (or complete when ready/observed)
 */
export function resolveGuidedCaptureInitialStep(
  dto: GuidedLongitudinalCaptureDto
): GuidedCaptureWizardStep {
  const status = dto.status;

  if (status === "ready_for_review" || status === "observed") {
    return { mode: "complete" };
  }

  if (status === "future" && !dto.earlyUploadNote) {
    return { mode: "status_only" };
  }

  if (allRequiredComplete(dto.views)) {
    return { mode: "review" };
  }

  const missing = firstMissingRequiredView(dto.views);
  const anyRequiredDone = dto.views.some((v) => v.required && v.complete);

  if (missing && (status === "evidence_incomplete" || anyRequiredDone)) {
    const ordered = orderedGuidedViews(dto.views);
    const index = ordered.findIndex((v) => v.key === missing.key);
    return { mode: "view", viewKey: missing.key, index: Math.max(0, index) };
  }

  return { mode: "status_only" };
}

export function nextViewStep(
  views: GuidedCaptureViewDto[],
  currentKey: string
): GuidedCaptureWizardStep {
  const ordered = orderedGuidedViews(views);
  const idx = ordered.findIndex((v) => v.key === currentKey);
  const next = ordered[idx + 1];
  if (next) {
    return { mode: "view", viewKey: next.key, index: idx + 1 };
  }
  return allRequiredComplete(views) ? { mode: "review" } : { mode: "review" };
}

export function canUploadForMilestoneStatus(
  status: LongitudinalCaptureMilestoneStatus,
  allowEarlyUpload: boolean
): boolean {
  switch (status) {
    case "due":
    case "evidence_incomplete":
    case "missed":
      return true;
    case "future":
      return allowEarlyUpload;
    case "ready_for_review":
    case "observed":
      return false;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function primaryCtaLabel(
  status: LongitudinalCaptureMilestoneStatus
): string {
  switch (status) {
    case "future":
      return "View photo guidance";
    case "due":
      return "Start photos";
    case "evidence_incomplete":
      return "Continue photos";
    case "ready_for_review":
      return "Return to HairAudit";
    case "observed":
      return "View review";
    case "missed":
      return "Add photos";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function formatTargetDateForPatient(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!m) return isoDate;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${month} ${m[1]}`;
}
