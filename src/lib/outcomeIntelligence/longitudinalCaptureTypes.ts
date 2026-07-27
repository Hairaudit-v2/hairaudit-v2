/**
 * FI-OUTCOME-INTELLIGENCE-1C — Prospective longitudinal capture plan types.
 *
 * Operational capture orchestration only. Does not predict outcomes, score
 * success, send reminders, or materialize cohort analytics.
 */

import type {
  LongitudinalEvidenceRole,
  LongitudinalOutcomeStage,
} from "@/lib/projection/types";

export const CAPTURE_PLAN_VERSION = "fi-outcome-capture-plan-v1" as const;
export const CAPTURE_PROTOCOL_VERSION = "fi-outcome-capture-protocol-v1" as const;

export type CapturePlanVersion = typeof CAPTURE_PLAN_VERSION;
export type CaptureProtocolVersion = typeof CAPTURE_PROTOCOL_VERSION;

/** Supported protocol versions for historical resolution. */
export const CAPTURE_PROTOCOL_VERSIONS = [
  CAPTURE_PROTOCOL_VERSION,
] as const satisfies readonly CaptureProtocolVersion[];

export type LongitudinalCaptureMilestoneStatus =
  | "future"
  | "due"
  | "evidence_incomplete"
  | "ready_for_review"
  | "observed"
  | "missed";

export type LongitudinalCaptureNextActionType =
  | "wait"
  | "upload_followup_images"
  | "complete_followup_images"
  | "wait_for_review"
  | "view_review";

export type ReferenceImageSource =
  | "surgery_day"
  | "preoperative"
  | "prior_followup";

export type LongitudinalCaptureMilestone = {
  stage: LongitudinalOutcomeStage;
  targetDate: string;
  windowStart: string;
  windowEnd: string;
  status: LongitudinalCaptureMilestoneStatus;
  requiredEvidenceRoles: LongitudinalEvidenceRole[];
  recommendedEvidenceRoles: LongitudinalEvidenceRole[];
  presentEvidenceRoles: LongitudinalEvidenceRole[];
  missingRequiredEvidenceRoles: LongitudinalEvidenceRole[];
  missingRecommendedEvidenceRoles: LongitudinalEvidenceRole[];
  observationSnapshotId: string | null;
  completedAt: string | null;
  /** Internal: evidence arrived after windowEnd but still usable via 1E. */
  lateEvidencePresent: boolean;
  comparisonAvailable: boolean;
  reviewAvailable: boolean;
};

/**
 * Full server-side capture plan. Patient/case IDs stay server-side only.
 */
export type LongitudinalCapturePlan = {
  id: string;
  projectionSnapshotId: string;
  caseId: string;
  patientId: string;
  procedureDate: string;
  planVersion: CapturePlanVersion;
  protocolVersion: CaptureProtocolVersion;
  createdAt: string;
  milestones: LongitudinalCaptureMilestone[];
};

/** Minimal persisted identity — milestone state is derived at read time. */
export type LongitudinalCapturePlanRecord = {
  id: string;
  projectionSnapshotId: string;
  caseId: string;
  patientId: string;
  procedureDate: string;
  capturePolicyVersion: CapturePlanVersion;
  captureProtocolVersion: CaptureProtocolVersion;
  createdAt: string;
};

export type CaptureViewInstruction = {
  role: LongitudinalEvidenceRole;
  patientLabel: string;
  required: boolean;
  whyRequested: string;
  captureInstructions: string[];
  referenceImageAvailable: boolean;
  referenceImageSource: ReferenceImageSource | null;
};

export type PatientLongitudinalViewDto = {
  key: string;
  label: string;
  complete: boolean;
};

export type PatientLongitudinalNextActionDto = {
  type: LongitudinalCaptureNextActionType;
  label: string;
  href: string | null;
};

export type PatientLongitudinalMilestoneDto = {
  stage: LongitudinalOutcomeStage;
  label: string;
  targetDate: string;
  status: LongitudinalCaptureMilestoneStatus;
  requiredViews: PatientLongitudinalViewDto[];
  recommendedViews: PatientLongitudinalViewDto[];
  nextAction: PatientLongitudinalNextActionDto;
};

export type PatientLongitudinalCaptureDto = {
  planVersion: CapturePlanVersion;
  protocolVersion: CaptureProtocolVersion;
  procedureDate: string;
  milestones: PatientLongitudinalMilestoneDto[];
  nextMilestone: PatientLongitudinalMilestoneDto | null;
  photographyGuidance: string[];
};

export type CaptureProgrammeHealth = {
  totalPlans: number;
  totalMilestones: number;
  future: number;
  due: number;
  incomplete: number;
  ready: number;
  observed: number;
  missed: number;
};

export type CreateCapturePlanInput = {
  projectionSnapshotId: string;
  caseId: string;
  patientId: string;
  procedureDate: string;
  /** Defaults to current plan/protocol versions. */
  planVersion?: CapturePlanVersion;
  protocolVersion?: CaptureProtocolVersion;
  now?: string;
  id?: string;
};

export type CreateCapturePlanResult =
  | {
      ok: true;
      created: boolean;
      reused: boolean;
      record: LongitudinalCapturePlanRecord;
    }
  | {
      ok: false;
      code:
        | "PROJECTION_NOT_FOUND"
        | "OWNERSHIP_MISMATCH"
        | "INVALID_PROCEDURE_DATE"
        | "CASE_MISMATCH"
        | "UNSUPPORTED_POLICY_VERSION";
      reason: string;
    };

export type ResolveCapturePlanResult =
  | { ok: true; plan: LongitudinalCapturePlan }
  | {
      ok: false;
      code:
        | "PROJECTION_NOT_FOUND"
        | "OWNERSHIP_MISMATCH"
        | "INVALID_PROCEDURE_DATE"
        | "CASE_MISMATCH"
        | "PLAN_NOT_FOUND"
        | "UNSUPPORTED_POLICY_VERSION";
      reason: string;
    };
