/**
 * FI-OUTCOME-INTELLIGENCE-1E — Categories allowed after case submit for follow-up.
 *
 * Month-banded postop_* keys are follow-up-only by design.
 * Non-banded roles used by 1C (left/right/close-ups) require capture_workflow metadata.
 */

import type { LongitudinalEvidenceRole, LongitudinalOutcomeStage } from "@/lib/projection/types";
import { roleToPostopCategoryHint } from "./longitudinalCapturePolicy";

const MONTH_BANDED =
  /^postop_month(3|6|9|12)_(front|top|crown|donor)$/;

/** Always allowed on submitted cases (follow-up taxonomy). */
export function isMonthBandedFollowupCategory(category: string): boolean {
  return MONTH_BANDED.test(String(category ?? "").trim());
}

/**
 * Categories that 1C may request which are shared with pre/post-surgery wizards.
 * Only unlock on submitted cases when workflow declares longitudinal_followup.
 */
export function isSharedLongitudinalRoleCategory(category: string): boolean {
  const c = String(category ?? "").trim();
  return (
    c === "patient_current_left" ||
    c === "patient_current_right" ||
    c === "current_recipient_closeup" ||
    c === "preop_donor_closeup"
  );
}

export function isLongitudinalFollowupUploadAllowed(args: {
  category: string;
  captureWorkflow?: string | null;
}): boolean {
  if (isMonthBandedFollowupCategory(args.category)) return true;
  if (
    isSharedLongitudinalRoleCategory(args.category) &&
    String(args.captureWorkflow ?? "").trim() === "longitudinal_followup"
  ) {
    return true;
  }
  return false;
}

export function uploadCategoryForGuidedRole(
  stage: LongitudinalOutcomeStage,
  role: LongitudinalEvidenceRole
): string {
  const hint = roleToPostopCategoryHint(stage, role);
  if (!hint) {
    throw new Error(`No upload category for role ${role} at ${stage}`);
  }
  return hint;
}

export const LONGITUDINAL_CAPTURE_WORKFLOW = "longitudinal_followup" as const;
