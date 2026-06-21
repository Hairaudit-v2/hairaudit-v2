/**
 * HA-ARCHITECTURE-FIX-2 — returning patient resume flow.
 * Resolves the most relevant open case and the next action for the patient dashboard.
 */

import { normalizeIntakeFormData } from "@/lib/intake/normalizeIntakeFormData";
import {
  isCaseMarkedSuccessfullySubmitted,
  type CaseSubmitStatusFields,
} from "@/lib/patient/caseSubmitStatus";
import {
  isPatientReportDelivered,
  resolvePatientReportDeliveryPhase,
  type PatientReportDeliveryPhase,
} from "@/lib/patient/patientProcessingView";
import {
  computePatientRequiredPhotoProgress,
  type RequiredPhotoProgress,
} from "@/lib/patient/patientRequiredPhotoProgress";
import {
  normalizePatientReviewPathway,
  PATHWAY_MINIMAL_REQUIRED_FIELD_IDS,
  resolvePatientReviewPathwayFromCase,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

export const PATIENT_RESUME_STEPS = [
  "photos_incomplete",
  "questions_incomplete",
  "contact_pending",
  "processing",
  "report_ready",
  "no_open_case",
] as const;

export type PatientResumeStep = (typeof PATIENT_RESUME_STEPS)[number];

/** Lower number = higher priority when choosing among multiple cases. */
export const PATIENT_RESUME_STEP_PRIORITY: Record<PatientResumeStep, number> = {
  photos_incomplete: 1,
  questions_incomplete: 2,
  contact_pending: 3,
  processing: 4,
  report_ready: 5,
  no_open_case: 6,
};

export const PATIENT_PATHWAY_DISPLAY_LABELS: Record<PatientReviewPathway, string> = {
  pre_surgery: "Pre-Surgery Review",
  post_surgery: "Post-Surgery Audit",
};

export type PatientResumeCaseInput = CaseSubmitStatusFields & {
  id: string;
  title?: string | null;
  created_at?: string | null;
  patient_review_pathway?: string | null;
};

export type PatientResumeCaseContext = {
  case: PatientResumeCaseInput;
  pathway: PatientReviewPathway;
  photoProgress: RequiredPhotoProgress;
  questionsComplete: boolean;
  deliveryPhase: PatientReportDeliveryPhase;
  hasReportPdf: boolean;
  step: PatientResumeStep;
  sortTimestamp: number;
};

export type PatientResumeReviewViewModel = {
  step: PatientResumeStep;
  primaryCase: PatientResumeCaseContext | null;
  otherCases: PatientResumeCaseContext[];
  pathwayLabel: string | null;
  headline: string;
  subtext: string;
  stepLabel: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  photoProgress: { completed: number; total: number } | null;
  reassurance: string;
};

function isFieldAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

/** Minimum friction-free intake complete for the case pathway. */
export function isPathwayMinimalIntakeComplete(
  pathway: PatientReviewPathway,
  patientAnswers: Record<string, unknown> | null | undefined
): boolean {
  const flat = normalizeIntakeFormData(patientAnswers ?? {});
  const required = PATHWAY_MINIMAL_REQUIRED_FIELD_IDS[pathway];
  return required.every((id) => isFieldAnswered(flat[id]));
}

export function resolvePatientResumeStep(args: {
  photoProgress: RequiredPhotoProgress;
  questionsComplete: boolean;
  deliveryPhase: PatientReportDeliveryPhase;
}): PatientResumeStep {
  if (isPatientReportDelivered(args.deliveryPhase)) return "report_ready";
  if (args.deliveryPhase === "processing" || args.deliveryPhase === "audit_failed") {
    return "processing";
  }
  if (!args.photoProgress.isComplete) return "photos_incomplete";
  if (!args.questionsComplete) return "questions_incomplete";
  return "contact_pending";
}

function resolveSortTimestamp(c: PatientResumeCaseInput): number {
  for (const raw of [c.submitted_at, c.created_at]) {
    const ms = raw ? new Date(raw).getTime() : NaN;
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

export function buildPatientResumeCaseContext(args: {
  case: PatientResumeCaseInput;
  uploads: Array<{ type?: string | null }>;
  patientAnswers: Record<string, unknown> | null | undefined;
  hasReportPdf: boolean;
}): PatientResumeCaseContext {
  const pathway = resolvePatientReviewPathwayFromCase(args.case);
  const photoProgress = computePatientRequiredPhotoProgress(args.uploads, pathway);
  const questionsComplete = isPathwayMinimalIntakeComplete(pathway, args.patientAnswers);
  const deliveryPhase = resolvePatientReportDeliveryPhase({
    caseStatus: args.case.status,
    hasReportPdf: args.hasReportPdf,
  });
  const step = resolvePatientResumeStep({ photoProgress, questionsComplete, deliveryPhase });

  return {
    case: args.case,
    pathway,
    photoProgress,
    questionsComplete,
    deliveryPhase,
    hasReportPdf: args.hasReportPdf,
    step,
    sortTimestamp: resolveSortTimestamp(args.case),
  };
}

export function comparePatientResumeCases(a: PatientResumeCaseContext, b: PatientResumeCaseContext): number {
  const priorityDiff =
    PATIENT_RESUME_STEP_PRIORITY[a.step] - PATIENT_RESUME_STEP_PRIORITY[b.step];
  if (priorityDiff !== 0) return priorityDiff;
  return b.sortTimestamp - a.sortTimestamp;
}

export function selectPrimaryPatientResumeCase(
  contexts: readonly PatientResumeCaseContext[]
): PatientResumeCaseContext | null {
  if (contexts.length === 0) return null;
  return [...contexts].sort(comparePatientResumeCases)[0] ?? null;
}

function pathwayHeadline(pathway: PatientReviewPathway): string {
  if (pathway === "pre_surgery") return "Continue Your Pre-Surgery Review";
  return "Continue Your Post-Surgery Audit";
}

function copyForStep(
  step: PatientResumeStep,
  ctx: PatientResumeCaseContext | null
): Pick<
  PatientResumeReviewViewModel,
  "headline" | "subtext" | "stepLabel" | "primaryCtaLabel" | "primaryCtaHref" | "reassurance"
> {
  const caseId = ctx?.case.id ?? "";
  const pathway = ctx?.pathway ?? null;

  switch (step) {
    case "photos_incomplete":
      return {
        headline: pathway ? pathwayHeadline(pathway) : "Continue Your Review",
        subtext: "You are a few steps away from receiving your independent review.",
        stepLabel: "Step 1 of 4 — Upload photos",
        primaryCtaLabel: "Continue Uploading Photos",
        primaryCtaHref: `/cases/${caseId}/patient/photos`,
        reassurance: "Upload clear photos so we can prepare your independent review.",
      };
    case "questions_incomplete":
      return {
        headline: pathway ? pathwayHeadline(pathway) : "Continue Your Review",
        subtext: "You are a few steps away from receiving your independent review.",
        stepLabel: "Step 2 of 4 — Answer a few questions",
        primaryCtaLabel: "Continue Questions",
        primaryCtaHref: `/cases/${caseId}/patient/questions`,
        reassurance: "A short intake helps tailor your review summary.",
      };
    case "contact_pending":
      return {
        headline: pathway ? pathwayHeadline(pathway) : "Continue Your Review",
        subtext: "You are a few steps away from receiving your independent review.",
        stepLabel: "Step 3 of 4 — Confirm where to send your report",
        primaryCtaLabel: "Send My Report",
        primaryCtaHref: `/cases/${caseId}/patient/contact`,
        reassurance: "We will email your report as soon as it is ready.",
      };
    case "processing":
      return {
        headline: pathway ? pathwayHeadline(pathway) : "Continue Your Review",
        subtext: "You are a few steps away from receiving your independent review.",
        stepLabel: "Step 4 of 4 — Your review is being prepared",
        primaryCtaLabel: "View Processing Progress",
        primaryCtaHref: `/cases/${caseId}`,
        reassurance: "You can safely close this page — we will email you when your report is ready.",
      };
    case "report_ready":
      return {
        headline: pathway ? pathwayHeadline(pathway) : "Continue Your Review",
        subtext: "Your independent review is ready to view.",
        stepLabel: "Your review is ready",
        primaryCtaLabel: "View My Report",
        primaryCtaHref: `/cases/${caseId}`,
        reassurance: "Your summary is prepared. Open your report for full detail.",
      };
    default:
      return {
        headline: "Start a New Review",
        subtext: "Choose the review type that matches where you are in your hair restoration journey.",
        stepLabel: "",
        primaryCtaLabel: "",
        primaryCtaHref: "",
        reassurance: "Each review is independent, secure, and focused on your photos and intake answers.",
      };
  }
}

export function buildPatientResumeReviewViewModel(args: {
  contexts: readonly PatientResumeCaseContext[];
}): PatientResumeReviewViewModel {
  const primary = selectPrimaryPatientResumeCase(args.contexts);
  const step = primary?.step ?? "no_open_case";
  const copy = copyForStep(step, primary);

  const otherCases =
    primary == null
      ? [...args.contexts].sort((a, b) => b.sortTimestamp - a.sortTimestamp)
      : [...args.contexts]
          .filter((c) => c.case.id !== primary.case.id)
          .sort((a, b) => comparePatientResumeCases(a, b));

  return {
    step,
    primaryCase: primary,
    otherCases,
    pathwayLabel: primary ? PATIENT_PATHWAY_DISPLAY_LABELS[primary.pathway] : null,
    headline: copy.headline,
    subtext: copy.subtext,
    stepLabel: copy.stepLabel,
    primaryCtaLabel: copy.primaryCtaLabel,
    primaryCtaHref: copy.primaryCtaHref,
    photoProgress:
      primary && !primary.photoProgress.isComplete
        ? {
            completed: primary.photoProgress.completedCount,
            total: primary.photoProgress.totalRequired,
          }
        : primary?.photoProgress.isComplete
          ? {
              completed: primary.photoProgress.completedCount,
              total: primary.photoProgress.totalRequired,
            }
          : null,
    reassurance: copy.reassurance,
  };
}

/** Draft/incomplete cases should not show internal dashboard analytics on first screen. */
export function shouldShowPatientDashboardAnalytics(step: PatientResumeStep): boolean {
  return step === "processing" || step === "report_ready";
}

/** True when the resume panel alone should drive the dashboard (hide legacy completion modules). */
export function shouldUsePatientResumePrimaryLayout(step: PatientResumeStep): boolean {
  return step !== "report_ready";
}

export function normalizeResumePathway(value: unknown): PatientReviewPathway {
  return normalizePatientReviewPathway(value);
}

export function isResumeCaseSubmitted(c: CaseSubmitStatusFields): boolean {
  return isCaseMarkedSuccessfullySubmitted(c);
}
