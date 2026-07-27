/**
 * FI-OUTCOME-INTELLIGENCE-1C — Status + next-action derivation (server-side).
 */

import type { LongitudinalOutcomeStage } from "@/lib/projection/types";
import { relateToCaptureWindow } from "./longitudinalCaptureSchedule";
import { patientMilestoneLabel } from "./longitudinalCapturePolicy";
import type {
  LongitudinalCaptureMilestoneStatus,
  LongitudinalCaptureNextActionType,
  PatientLongitudinalMilestoneDto,
  PatientLongitudinalNextActionDto,
} from "./longitudinalCaptureTypes";

export type DeriveMilestoneStatusInput = {
  nowDate: string;
  windowStart: string;
  windowEnd: string;
  requiredSatisfied: boolean;
  anyEvidencePresent: boolean;
  observationSnapshotId: string | null;
};

export type DeriveMilestoneStatusResult = {
  status: LongitudinalCaptureMilestoneStatus;
  lateEvidencePresent: boolean;
};

/**
 * Server-derived milestone status.
 *
 * Priority:
 * 1. observed — canonical 1E observation exists
 * 2. before window → future
 * 3. required complete → ready_for_review (even after window / late)
 * 4. after window + no adequate required evidence → missed
 * 5. partial evidence → evidence_incomplete
 * 6. within window + none → due
 */
export function deriveMilestoneStatus(
  input: DeriveMilestoneStatusInput
): DeriveMilestoneStatusResult {
  if (input.observationSnapshotId) {
    return { status: "observed", lateEvidencePresent: false };
  }

  const relation = relateToCaptureWindow({
    nowDate: input.nowDate,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
  });

  if (relation === "before") {
    return { status: "future", lateEvidencePresent: false };
  }

  if (input.requiredSatisfied) {
    return {
      status: "ready_for_review",
      lateEvidencePresent: relation === "after",
    };
  }

  if (relation === "after") {
    if (input.anyEvidencePresent) {
      return { status: "evidence_incomplete", lateEvidencePresent: true };
    }
    return { status: "missed", lateEvidencePresent: false };
  }

  // within window
  if (input.anyEvidencePresent) {
    return { status: "evidence_incomplete", lateEvidencePresent: false };
  }
  return { status: "due", lateEvidencePresent: false };
}

export function deriveNextAction(args: {
  status: LongitudinalCaptureMilestoneStatus;
  stage: LongitudinalOutcomeStage;
  caseId: string;
  reviewAvailable: boolean;
  missingRequiredCount: number;
}): PatientLongitudinalNextActionDto {
  const label = patientMilestoneLabel(args.stage);
  const photosHref = `/cases/${args.caseId}/patient/photos`;

  switch (args.status) {
    case "future": {
      return {
        type: "wait",
        label: `Your next HairAudit review is scheduled for your ${label}.`,
        href: null,
      };
    }
    case "due": {
      return {
        type: "upload_followup_images",
        label: `Your ${label} photos are ready to upload.`,
        href: photosHref,
      };
    }
    case "evidence_incomplete": {
      const n = args.missingRequiredCount;
      return {
        type: "complete_followup_images",
        label:
          n > 0
            ? `Add ${n} remaining follow-up photo${n === 1 ? "" : "s"}.`
            : "Complete your follow-up photos.",
        href: photosHref,
      };
    }
    case "ready_for_review": {
      return {
        type: "wait_for_review",
        label: `Your ${label} images are ready for review.`,
        href: null,
      };
    }
    case "observed": {
      if (args.reviewAvailable) {
        return {
          type: "view_review",
          label: `Your ${label} review is complete.`,
          href: `/cases/${args.caseId}/patient`,
        };
      }
      return {
        type: "view_review",
        label: `Your ${label} HairAudit review is complete.`,
        href: `/cases/${args.caseId}/patient`,
      };
    }
    case "missed": {
      return {
        type: "upload_followup_images",
        label: "Follow-up not yet completed. You can still upload photos.",
        href: photosHref,
      };
    }
    default: {
      const _exhaustive: never = args.status;
      return _exhaustive;
    }
  }
}

export function selectNextPatientMilestone(
  milestones: PatientLongitudinalMilestoneDto[]
): PatientLongitudinalMilestoneDto | null {
  const priority: LongitudinalCaptureMilestoneStatus[] = [
    "due",
    "evidence_incomplete",
    "ready_for_review",
    "future",
    "missed",
    "observed",
  ];
  for (const status of priority) {
    const hit = milestones.find((m) => m.status === status);
    if (hit) return hit;
  }
  return milestones[0] ?? null;
}

export type { LongitudinalCaptureNextActionType };
