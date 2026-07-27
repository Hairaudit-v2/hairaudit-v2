/**
 * FI-OUTCOME-INTELLIGENCE-1E — Build patient-safe guided capture DTO from 1C.
 */

import type { LongitudinalEvidenceRole, LongitudinalOutcomeStage } from "@/lib/projection/types";
import { deriveNextAction } from "./longitudinalCaptureDto";
import {
  patientMilestoneLabel,
  patientSafeLabelForRole,
  publicViewKeyForRole,
  whyRequestedForRole,
} from "./longitudinalCapturePolicy";
import type { LongitudinalCaptureMilestone, LongitudinalCapturePlan } from "./longitudinalCaptureTypes";
import type {
  GuidedCaptureLandingDto,
  GuidedCaptureLandingMilestoneDto,
  GuidedCaptureViewDto,
  GuidedLongitudinalCaptureDto,
} from "./guidedCaptureDto";
import {
  GUIDED_CAPTURE_RECOMMENDED_COPY,
  GUIDED_CAPTURE_REFERENCE_MATCH_COPY,
  GUIDED_CAPTURE_REPRESENTATIVE_COPY,
  guidedInstructionsForRole,
  guidedPhotographyGuidance,
} from "./guidedCaptureInstructions";
import {
  resolveCurrentImageForCategory,
  resolveReferenceImageForRole,
  type ReferenceCandidateUpload,
} from "./guidedCaptureReference";
import { uploadCategoryForGuidedRole } from "./longitudinalFollowupUploadAllowance";
import {
  formatTargetDateForPatient,
  canUploadForMilestoneStatus,
} from "./guidedCaptureWizard";
import { LONGITUDINAL_OUTCOME_STAGES } from "@/lib/projection/longitudinalEvidence";

export type SignedUrlResolver = (storagePath: string) => Promise<string | null>;

export function isLongitudinalOutcomeStage(
  value: string
): value is LongitudinalOutcomeStage {
  return (LONGITUDINAL_OUTCOME_STAGES as readonly string[]).includes(value);
}

export function guidedCaptureHref(
  caseId: string,
  stage: LongitudinalOutcomeStage
): string {
  return `/cases/${caseId}/patient/follow-up/${stage}`;
}

export function guidedCaptureLandingHref(caseId: string): string {
  return `/cases/${caseId}/patient/follow-up`;
}

export function buildStatusMessage(args: {
  status: LongitudinalCaptureMilestone["status"];
  stage: LongitudinalOutcomeStage;
  targetDate: string;
  reviewAvailable: boolean;
}): string {
  const label = patientMilestoneLabel(args.stage);
  const date = formatTargetDateForPatient(args.targetDate);
  switch (args.status) {
    case "future":
      return `Your ${label} opens on ${date}.`;
    case "due":
      return `Your ${label} is ready.`;
    case "evidence_incomplete":
      return "You’re nearly there.";
    case "ready_for_review":
      return "Your required photos are complete.";
    case "observed":
      return args.reviewAvailable
        ? `Your ${label} review is ready.`
        : `Your ${label} review has been completed.`;
    case "missed":
      return `Your ${label} follow-up is still available.`;
    default: {
      const _exhaustive: never = args.status;
      return _exhaustive;
    }
  }
}

export function landingStatusLabel(
  status: LongitudinalCaptureMilestone["status"]
): string {
  switch (status) {
    case "future":
      return "Upcoming";
    case "due":
      return "Ready now";
    case "evidence_incomplete":
      return "In progress";
    case "ready_for_review":
      return "Photos complete";
    case "observed":
      return "Completed";
    case "missed":
      return "Still available";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function roleFromPublicKey(
  key: string,
  roles: LongitudinalEvidenceRole[]
): LongitudinalEvidenceRole | null {
  for (const role of roles) {
    if (publicViewKeyForRole(role) === key) return role;
  }
  return null;
}

export async function buildGuidedLongitudinalCaptureDto(args: {
  plan: LongitudinalCapturePlan;
  milestone: LongitudinalCaptureMilestone;
  uploads: ReferenceCandidateUpload[];
  resolveSignedUrl: SignedUrlResolver;
  uiEnabled: boolean;
  /** Product policy: early evidence before window (default false). */
  allowEarlyUpload?: boolean;
}): Promise<GuidedLongitudinalCaptureDto> {
  const allowEarly = args.allowEarlyUpload === true;
  const m = args.milestone;
  const presentSet = new Set(m.presentEvidenceRoles);
  const requiredSet = new Set(m.requiredEvidenceRoles);
  const allRoles = [
    ...m.requiredEvidenceRoles,
    ...m.recommendedEvidenceRoles,
  ];

  const views: GuidedCaptureViewDto[] = [];
  for (const role of allRoles) {
    const required = requiredSet.has(role);
    const complete = presentSet.has(role);
    const uploadCategory = uploadCategoryForGuidedRole(m.stage, role);
    const current = resolveCurrentImageForCategory({
      uploadCategory,
      uploads: args.uploads,
    });
    const reference = resolveReferenceImageForRole({
      role,
      stage: m.stage,
      uploads: args.uploads,
    });

    const currentUrl = current
      ? await args.resolveSignedUrl(current.storagePath)
      : null;
    const referenceUrl = reference
      ? await args.resolveSignedUrl(reference.storagePath)
      : null;

    views.push({
      key: publicViewKeyForRole(role),
      label: patientSafeLabelForRole(role),
      required,
      complete,
      whyRequested: whyRequestedForRole(role),
      instructions: guidedInstructionsForRole(role),
      referenceImage: {
        available: Boolean(reference && referenceUrl),
        url: referenceUrl,
        label: reference?.label ?? null,
        source: reference?.source ?? null,
      },
      currentImage: {
        available: Boolean(current && currentUrl),
        url: currentUrl,
        uploadId: current?.uploadId ?? null,
      },
      uploadCategory,
    });
  }

  const requiredTotal = m.requiredEvidenceRoles.length;
  const requiredComplete = m.requiredEvidenceRoles.filter((r) =>
    presentSet.has(r)
  ).length;
  const recommendedTotal = m.recommendedEvidenceRoles.length;
  const recommendedComplete = m.recommendedEvidenceRoles.filter((r) =>
    presentSet.has(r)
  ).length;

  const nextAction = deriveNextAction({
    status: m.status,
    stage: m.stage,
    caseId: args.plan.caseId,
    reviewAvailable: m.reviewAvailable,
    missingRequiredCount: m.missingRequiredEvidenceRoles.length,
  });

  const canUpload = canUploadForMilestoneStatus(m.status, allowEarly);

  return {
    stage: m.stage,
    title: `Your ${patientMilestoneLabel(m.stage)}`,
    subtitle:
      "Capture a consistent set of follow-up photos so HairAudit can document how your transplant looks at this stage.",
    targetDate: m.targetDate,
    windowStart: m.windowStart,
    windowEnd: m.windowEnd,
    status: m.status,
    statusMessage: buildStatusMessage({
      status: m.status,
      stage: m.stage,
      targetDate: m.targetDate,
      reviewAvailable: m.reviewAvailable,
    }),
    progress: {
      requiredComplete,
      requiredTotal,
      recommendedComplete,
      recommendedTotal,
    },
    views,
    nextAction,
    photographyGuidance: guidedPhotographyGuidance(),
    representativeCaptureNote: GUIDED_CAPTURE_REPRESENTATIVE_COPY,
    recommendedNote: GUIDED_CAPTURE_RECOMMENDED_COPY,
    referenceMatchNote: GUIDED_CAPTURE_REFERENCE_MATCH_COPY,
    earlyUploadNote:
      m.status === "future" && canUpload
        ? "You can add photos early. HairAudit may confirm which follow-up stage they belong to after review."
        : null,
    capturePolicyVersion: args.plan.planVersion,
    protocolVersion: args.plan.protocolVersion,
    uiEnabled: args.uiEnabled,
  };
}

export function buildGuidedCaptureLandingDto(args: {
  plan: LongitudinalCapturePlan;
  uiEnabled: boolean;
}): GuidedCaptureLandingDto {
  const milestones: GuidedCaptureLandingMilestoneDto[] = args.plan.milestones.map(
    (m) => {
      const presentSet = new Set(m.presentEvidenceRoles);
      const requiredComplete = m.requiredEvidenceRoles.filter((r) =>
        presentSet.has(r)
      ).length;
      const recommendedComplete = m.recommendedEvidenceRoles.filter((r) =>
        presentSet.has(r)
      ).length;
      const href =
        m.status === "future"
          ? guidedCaptureHref(args.plan.caseId, m.stage)
          : guidedCaptureHref(args.plan.caseId, m.stage);
      return {
        stage: m.stage,
        label: patientMilestoneLabel(m.stage),
        targetDate: m.targetDate,
        status: m.status,
        statusLabel: landingStatusLabel(m.status),
        href,
        progress: {
          requiredComplete,
          requiredTotal: m.requiredEvidenceRoles.length,
          recommendedComplete,
          recommendedTotal: m.recommendedEvidenceRoles.length,
        },
      };
    }
  );

  return {
    procedureDate: args.plan.procedureDate,
    milestones,
    photographyGuidance: guidedPhotographyGuidance(),
    uiEnabled: args.uiEnabled,
  };
}

export { roleFromPublicKey };
