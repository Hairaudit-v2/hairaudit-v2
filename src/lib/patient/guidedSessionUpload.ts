/**
 * HA-PHOTO-TIMELINE-2A Phase D — Session-period + role-step helpers for guided upload.
 * Storage categories remain derived for pathway satisfaction compatibility.
 */

import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import type {
  PhotoSessionImageRole,
  PhotoSessionMilestone,
} from "@/lib/photoSessions/types";
import { PATIENT_FACING_MILESTONE_LABELS } from "@/lib/photoSessions/types";

export type GuidedSessionPeriodOption = {
  milestone: PhotoSessionMilestone;
  /** Patient-facing plain language (never raw enum). */
  label: string;
};

export type GuidedSessionRoleStep = {
  role: PhotoSessionImageRole;
  /** Legacy storage category for the active milestone. */
  storageCategory: string;
  title: string;
  help: string;
  required: boolean;
};

/** Period choices shown before photo capture. */
export function getGuidedSessionPeriodOptions(
  pathway: PatientReviewPathway
): GuidedSessionPeriodOption[] {
  if (pathway === "pre_surgery") {
    return [
      {
        milestone: "pre_surgery",
        label: PATIENT_FACING_MILESTONE_LABELS.pre_surgery,
      },
    ];
  }
  return [
    { milestone: "pre_surgery", label: "before surgery (for comparison)" },
    { milestone: "surgery_day", label: PATIENT_FACING_MILESTONE_LABELS.surgery_day },
    { milestone: "early_recovery", label: PATIENT_FACING_MILESTONE_LABELS.early_recovery },
    { milestone: "month_3", label: PATIENT_FACING_MILESTONE_LABELS.month_3 },
    { milestone: "month_6", label: PATIENT_FACING_MILESTONE_LABELS.month_6 },
    { milestone: "month_9", label: PATIENT_FACING_MILESTONE_LABELS.month_9 },
    { milestone: "month_12", label: PATIENT_FACING_MILESTONE_LABELS.month_12 },
    { milestone: "month_18", label: PATIENT_FACING_MILESTONE_LABELS.month_18 },
    { milestone: "long_term", label: PATIENT_FACING_MILESTONE_LABELS.long_term },
  ];
}

export function storageCategoryForMilestoneRole(
  milestone: PhotoSessionMilestone,
  role: PhotoSessionImageRole
): string {
  if (milestone === "pre_surgery") {
    switch (role) {
      case "front":
        return "preop_front";
      case "left":
        return "preop_left";
      case "right":
        return "preop_right";
      case "top":
        return "preop_top";
      case "crown":
        return "preop_crown";
      case "donor_rear":
        return "preop_donor_rear";
      case "donor_closeup":
        return "preop_donor_closeup";
      case "recipient_closeup":
        return "preop_hairline_closeup";
      default:
        return "preop_front";
    }
  }

  if (milestone === "surgery_day") {
    switch (role) {
      case "donor_rear":
      case "donor_closeup":
        return "day0_donor";
      default:
        return "day0_recipient";
    }
  }

  const monthMap: Partial<Record<PhotoSessionMilestone, number>> = {
    month_1: 1,
    month_3: 3,
    month_6: 6,
    month_9: 9,
    month_12: 12,
    month_18: 18,
    early_recovery: 3,
    long_term: 12,
    unknown: 6,
  };
  const n = monthMap[milestone] ?? 6;
  switch (role) {
    case "top":
      return `postop_month${n}_top`;
    case "crown":
      return `postop_month${n}_crown`;
    case "donor_rear":
      return `postop_month${n}_donor`;
    case "donor_closeup":
      return "preop_donor_closeup";
    case "recipient_closeup":
      return "current_recipient_closeup";
    case "left":
      return "preop_left";
    case "right":
      return "preop_right";
    case "front":
    default:
      return `postop_month${n}_front`;
  }
}

function roleTitle(role: PhotoSessionImageRole): string {
  switch (role) {
    case "front":
      return "Front view";
    case "top":
      return "Top view";
    case "crown":
      return "Crown view";
    case "left":
      return "Left side";
    case "right":
      return "Right side";
    case "donor_rear":
      return "Donor area (back)";
    case "recipient_closeup":
      return "Close-up of transplanted area";
    case "donor_closeup":
      return "Close-up of donor area";
    default:
      return "Photo";
  }
}

function roleHelp(role: PhotoSessionImageRole): string {
  switch (role) {
    case "front":
      return "Face the camera with good lighting so your hairline and front coverage are clear.";
    case "top":
      return "Tilt your head forward slightly so the camera sees the top of your scalp.";
    case "crown":
      return "Show the crown (back-top) of your head clearly.";
    case "donor_rear":
      return "Show the back of your head where grafts are usually taken from.";
    case "recipient_closeup":
      return "A closer photo of the transplanted area helps review healing and growth.";
    case "donor_closeup":
      return "A closer photo of the donor area helps review extraction healing.";
    case "left":
      return "Turn so your left profile is visible.";
    case "right":
      return "Turn so your right profile is visible.";
    default:
      return "Take a clear photo in good light.";
  }
}

/**
 * Required role steps for a pathway + chosen session milestone.
 * Optional supporting role (crown) is listed but not required when donor_rear is required.
 */
export function getGuidedSessionRoleSteps(
  pathway: PatientReviewPathway,
  milestone: PhotoSessionMilestone
): GuidedSessionRoleStep[] {
  const roles: Array<{ role: PhotoSessionImageRole; required: boolean }> =
    pathway === "pre_surgery"
      ? [
          { role: "front", required: true },
          { role: "left", required: true },
          { role: "right", required: true },
          { role: "top", required: true },
          { role: "donor_rear", required: true },
        ]
      : milestone === "pre_surgery"
        ? [
            { role: "front", required: true },
            { role: "top", required: true },
            { role: "donor_rear", required: true },
            { role: "recipient_closeup", required: true },
            { role: "donor_closeup", required: true },
          ]
        : [
            { role: "front", required: true },
            { role: "top", required: true },
            { role: "donor_rear", required: true },
            { role: "recipient_closeup", required: false },
            { role: "crown", required: false },
          ];

  return roles.map(({ role, required }) => ({
    role,
    storageCategory: storageCategoryForMilestoneRole(milestone, role),
    title: roleTitle(role),
    help: roleHelp(role),
    required,
  }));
}

export type GuidedSessionWizardView =
  | { mode: "period" }
  | { mode: "step"; stepIndex: number }
  | { mode: "complete" };

export function rolesPresentFromUploads(
  photos: Array<{ type?: string | null }>,
  steps: GuidedSessionRoleStep[]
): Set<PhotoSessionImageRole> {
  const cats = new Set(
    photos
      .map((p) => {
        const t = String(p.type ?? "");
        if (!t.startsWith("patient_photo:")) return null;
        return t.slice("patient_photo:".length).toLowerCase();
      })
      .filter((x): x is string => Boolean(x))
  );
  const present = new Set<PhotoSessionImageRole>();
  for (const step of steps) {
    if (cats.has(step.storageCategory.toLowerCase())) present.add(step.role);
  }
  return present;
}

export function getGuidedSessionMaxAccessibleStepIndex(
  photos: Array<{ type?: string | null }>,
  steps: GuidedSessionRoleStep[]
): number {
  const present = rolesPresentFromUploads(photos, steps);
  const required = steps.filter((s) => s.required);
  const firstMissing = required.findIndex((s) => !present.has(s.role));
  if (firstMissing < 0) return steps.length - 1;
  // Map required-index back to full step index.
  const missingRole = required[firstMissing]!.role;
  return Math.max(
    0,
    steps.findIndex((s) => s.role === missingRole)
  );
}

export function getGuidedSessionInitialView(
  photos: Array<{ type?: string | null }>,
  steps: GuidedSessionRoleStep[],
  hasSelectedPeriod: boolean
): GuidedSessionWizardView {
  if (!hasSelectedPeriod) return { mode: "period" };
  const present = rolesPresentFromUploads(photos, steps);
  const requiredDone = steps.filter((s) => s.required).every((s) => present.has(s.role));
  if (requiredDone) return { mode: "complete" };
  return { mode: "step", stepIndex: getGuidedSessionMaxAccessibleStepIndex(photos, steps) };
}

export function isGuidedSessionStepComplete(
  photos: Array<{ type?: string | null }>,
  steps: GuidedSessionRoleStep[],
  stepIndex: number
): boolean {
  const step = steps[stepIndex];
  if (!step) return false;
  return rolesPresentFromUploads(photos, steps).has(step.role);
}

export function missingRequiredGuidedSessionRoles(
  photos: Array<{ type?: string | null }>,
  steps: GuidedSessionRoleStep[]
): PhotoSessionImageRole[] {
  const present = rolesPresentFromUploads(photos, steps);
  return steps.filter((s) => s.required && !present.has(s.role)).map((s) => s.role);
}

export function missingOptionalGuidedSessionRoles(
  photos: Array<{ type?: string | null }>,
  steps: GuidedSessionRoleStep[]
): PhotoSessionImageRole[] {
  const present = rolesPresentFromUploads(photos, steps);
  return steps.filter((s) => !s.required && !present.has(s.role)).map((s) => s.role);
}

/** Map intake months_since band → suggested period milestone. */
export function suggestedMilestoneFromMonthsSinceBand(
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
