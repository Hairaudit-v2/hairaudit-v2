/**
 * FI-OUTCOME-INTELLIGENCE-1E — Allowlisted guided capture DTO.
 *
 * Built only from canonical 1C milestone state + signed image URLs.
 * Does not recalculate required evidence or treatment scope.
 */

import type { LongitudinalOutcomeStage } from "@/lib/projection/types";
import type {
  LongitudinalCaptureMilestoneStatus,
  LongitudinalCaptureNextActionType,
  PatientLongitudinalNextActionDto,
  ReferenceImageSource,
} from "./longitudinalCaptureTypes";

export type GuidedCaptureViewDto = {
  /** Public view key from 1C (front, top, …) — not storage taxonomy. */
  key: string;
  label: string;
  required: boolean;
  complete: boolean;
  whyRequested: string;
  instructions: string[];
  referenceImage: {
    available: boolean;
    url: string | null;
    label: string | null;
    source: ReferenceImageSource | null;
  };
  currentImage: {
    available: boolean;
    url: string | null;
    uploadId: string | null;
  };
  /**
   * Existing patient upload category for this role/stage.
   * Server-selected; client must not invent categories.
   */
  uploadCategory: string;
};

export type GuidedCaptureProgressDto = {
  requiredComplete: number;
  requiredTotal: number;
  recommendedComplete: number;
  recommendedTotal: number;
};

export type GuidedLongitudinalCaptureDto = {
  stage: LongitudinalOutcomeStage;
  title: string;
  subtitle: string;
  targetDate: string;
  windowStart: string;
  windowEnd: string;
  status: LongitudinalCaptureMilestoneStatus;
  statusMessage: string;
  progress: GuidedCaptureProgressDto;
  views: GuidedCaptureViewDto[];
  nextAction: PatientLongitudinalNextActionDto;
  photographyGuidance: string[];
  representativeCaptureNote: string;
  recommendedNote: string;
  referenceMatchNote: string;
  earlyUploadNote: string | null;
  capturePolicyVersion: string;
  protocolVersion: string;
  uiEnabled: boolean;
};

export type GuidedCaptureLandingMilestoneDto = {
  stage: LongitudinalOutcomeStage;
  label: string;
  targetDate: string;
  status: LongitudinalCaptureMilestoneStatus;
  statusLabel: string;
  href: string | null;
  progress: GuidedCaptureProgressDto;
};

export type GuidedCaptureLandingDto = {
  procedureDate: string;
  milestones: GuidedCaptureLandingMilestoneDto[];
  photographyGuidance: string[];
  uiEnabled: boolean;
};

export type GuidedCaptureWizardStep =
  | { mode: "intro" }
  | { mode: "view"; viewKey: string; index: number }
  | { mode: "review" }
  | { mode: "complete" }
  | { mode: "status_only" };

export type PatientSafeNextActionType = LongitudinalCaptureNextActionType;
