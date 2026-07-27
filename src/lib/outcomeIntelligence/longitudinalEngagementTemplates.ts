/**
 * FI-OUTCOME-INTELLIGENCE-1D — Patient-safe deterministic message templates.
 *
 * No LLM generation. No prediction / success / guilt language.
 */

import type { LongitudinalOutcomeStage } from "@/lib/projection/types";
import { patientMilestoneLabel } from "./longitudinalCapturePolicy";
import type { LongitudinalReminderMessageKey } from "./longitudinalEngagementTypes";

export type ReminderTemplateVariables = {
  stageLabel: string;
  missingRequiredCount?: number;
  missingRequiredLabels?: readonly string[];
};

const TEMPLATES: Readonly<
  Record<LongitudinalReminderMessageKey, (v: ReminderTemplateVariables) => string>
> = {
  LONGITUDINAL_UPCOMING_WINDOW: (v) =>
    `Your ${v.stageLabel} review is coming up soon. We’ll ask you to capture a consistent set of follow-up photos so your progress can be documented over time.`,
  LONGITUDINAL_CAPTURE_DUE: (v) =>
    `Your ${v.stageLabel} is ready. Upload your follow-up photos when convenient.`,
  LONGITUDINAL_EVIDENCE_INCOMPLETE: (v) => {
    const n = v.missingRequiredCount ?? 0;
    if (n > 0) {
      return `You’re nearly there. ${n} additional view${n === 1 ? "" : "s"} ${n === 1 ? "is" : "are"} still needed to complete your ${v.stageLabel}.`;
    }
    return `You’re nearly there. A few additional views are still needed to complete your ${v.stageLabel}.`;
  },
  LONGITUDINAL_READY_FOR_REVIEW: () =>
    `Your follow-up photos are complete and ready for HairAudit review.`,
  LONGITUDINAL_LATE_CAPTURE_RECOVERY: (v) =>
    `Your ${v.stageLabel} follow-up is still available. You can upload your photos whenever you’re ready.`,
  LONGITUDINAL_REVIEW_AVAILABLE: (v) =>
    `Your ${v.stageLabel} review is ready to view.`,
};

export function stageLabelForEngagement(stage: LongitudinalOutcomeStage): string {
  return patientMilestoneLabel(stage);
}

export function renderReminderMessage(
  key: LongitudinalReminderMessageKey,
  variables: ReminderTemplateVariables
): string {
  return TEMPLATES[key](variables);
}

export function buildMessageVariables(args: {
  stage: LongitudinalOutcomeStage;
  missingRequiredCount: number;
  missingRequiredLabels: readonly string[];
}): Record<string, string | number | boolean | null> {
  return {
    stageLabel: stageLabelForEngagement(args.stage),
    missingRequiredCount: args.missingRequiredCount,
    missingRequiredLabels: args.missingRequiredLabels.join(", ") || null,
  };
}

/** Forbidden substrings for messaging-safety tests / scans. */
export const FORBIDDEN_ENGAGEMENT_LANGUAGE: readonly string[] = [
  "on track",
  "behind",
  "graft survival",
  "success probability",
  "your transplant is",
  "your result should",
  "expected growth",
  "missed your required deadline",
  "non-compliant",
  "failed to complete",
  "overdue patient",
  "% growth",
];
