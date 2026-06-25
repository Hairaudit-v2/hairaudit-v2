/**
 * Patient-facing delivery state for HA-TRUST-2 / HA-TRUST-4.
 * Keeps partial reports, scores, and forensic workspace hidden until the report is ready.
 */

import {
  buildPatientTrustStatusDisplay,
  type PatientTrustInternalState,
} from "@/lib/patient/patientTrustStatusTranslator";

export type PatientReportDeliveryPhase = "draft" | "processing" | "delivered" | "audit_failed";

export type PatientProcessingTimelineStage =
  | "photos_received"
  | "organising_evidence"
  | "hair_pattern_review"
  | "donor_area_review"
  | "restoration_suitability_review"
  | "procedural_risk_review"
  | "summary_preparation"
  | "report_ready";

export type PatientProcessingTimelineStepState =
  | "complete"
  | "active"
  | "pending"
  | "delayed"
  | "ready";

export type PatientProcessingTimelineStep = {
  stage: PatientProcessingTimelineStage;
  state: PatientProcessingTimelineStepState;
};

export const PATIENT_PROCESSING_TIMELINE_STAGES: readonly PatientProcessingTimelineStage[] = [
  "photos_received",
  "organising_evidence",
  "hair_pattern_review",
  "donor_area_review",
  "restoration_suitability_review",
  "procedural_risk_review",
  "summary_preparation",
  "report_ready",
] as const;

/** Typical minutes from submission until a report is prepared (patient-facing ETA). */
export const PATIENT_REPORT_TYPICAL_READY_MINUTES = 5;

/** After this many minutes without delivery, the active stage is marked delayed. */
export const PATIENT_REPORT_DELAYED_THRESHOLD_MINUTES = 15;

export type PatientCaseStatusPayload = {
  caseId: string;
  status: string;
  reportReady: boolean;
  submittedAt: string | null;
  estimatedReadyAt: string | null;
  currentStage: PatientProcessingTimelineStage;
  timeline: PatientProcessingTimelineStep[];
  maskedEmail: string | null;
  reportUrl: string | null;
  /** HA-TRUST-4 trust-preserving patient-visible status */
  trustTitle: string;
  trustSubcopy: string;
  trustInternalState: PatientTrustInternalState;
  showTrustBanner: boolean;
};

export function normalizePatientCaseStatus(status: string | null | undefined): string {
  return String(status ?? "draft").trim().toLowerCase();
}

export function resolvePatientReportDeliveryPhase(args: {
  caseStatus: string | null | undefined;
  hasReportPdf: boolean;
  /** When true, map failure states to processing for patient-facing delivery phase. */
  patientTrustLayer?: boolean;
}): PatientReportDeliveryPhase {
  const status = normalizePatientCaseStatus(args.caseStatus);
  if (status === "audit_failed") {
    return args.patientTrustLayer ? "processing" : "audit_failed";
  }
  if (status === "draft") return "draft";
  if (status === "awaiting_patient_information") return "draft";
  if (status === "complete" && args.hasReportPdf) return "delivered";
  if (
    status === "submitted" ||
    status === "processing" ||
    status === "complete" ||
    status === "pdf_ready" ||
    status === "pdf_pending" ||
    status === "evidence_preparing" ||
    status === "evidence_ready" ||
    status === "audit_running" ||
    status === "audit_complete"
  ) {
    return "processing";
  }
  return "draft";
}

export function isPatientAwaitingReportDelivery(phase: PatientReportDeliveryPhase): boolean {
  return phase === "processing";
}

export function isPatientReportDelivered(phase: PatientReportDeliveryPhase): boolean {
  return phase === "delivered";
}

export function shouldHidePatientForensicWorkspace(args: {
  isPatientForCase: boolean;
  deliveryPhase: PatientReportDeliveryPhase;
}): boolean {
  return args.isPatientForCase && isPatientAwaitingReportDelivery(args.deliveryPhase);
}

export function shouldShowPatientReportContent(args: {
  isPatientForCase: boolean;
  deliveryPhase: PatientReportDeliveryPhase;
}): boolean {
  if (!args.isPatientForCase) return true;
  return isPatientReportDelivered(args.deliveryPhase);
}

/** Mask email for patient reassurance without exposing full address in UI. */
export function maskNotificationEmail(email: string | null | undefined): string | null {
  const trimmed = String(email ?? "").trim();
  if (!trimmed || !trimmed.includes("@")) return null;
  const [local, domain] = trimmed.split("@");
  if (!local || !domain) return null;
  const visible = local.slice(0, 1);
  const maskedLocal =
    local.length <= 1 ? `${visible}•` : `${visible}${"•".repeat(Math.min(4, local.length - 1))}`;
  return `${maskedLocal}@${domain}`;
}

export function resolvePatientProcessingActiveIndex(args: {
  caseStatus: string | null | undefined;
  hasReportPdf: boolean;
}): number {
  const status = normalizePatientCaseStatus(args.caseStatus);
  const stageCount = PATIENT_PROCESSING_TIMELINE_STAGES.length;

  if (status === "complete" && args.hasReportPdf) return stageCount;
  if (status === "complete" && !args.hasReportPdf) return 6;
  if (status === "pdf_ready") return 7;
  if (status === "pdf_pending") return 6;
  if (status === "evidence_ready") return 5;
  if (status === "audit_complete") return 4;
  if (status === "audit_running") return 3;
  if (status === "processing") return 2;
  if (status === "evidence_preparing") return 1;
  if (status === "submitted") return 1;
  return 0;
}

export function isPatientProcessingStageDelayed(args: {
  submittedAt: string | null | undefined;
  activeIndex: number;
  reportReady: boolean;
  nowMs?: number;
}): boolean {
  if (args.reportReady) return false;
  const submittedAt = String(args.submittedAt ?? "").trim();
  if (!submittedAt) return false;

  const submittedMs = new Date(submittedAt).getTime();
  if (!Number.isFinite(submittedMs)) return false;

  const nowMs = args.nowMs ?? Date.now();
  const elapsedMinutes = (nowMs - submittedMs) / 60_000;
  const perStageMinutes = 2;
  const expectedMinutes = Math.max(
    PATIENT_REPORT_DELAYED_THRESHOLD_MINUTES,
    (args.activeIndex + 1) * perStageMinutes
  );
  return elapsedMinutes >= expectedMinutes;
}

export function resolveEstimatedReadyAt(args: {
  submittedAt: string | null | undefined;
  reportReady: boolean;
  isDelayed: boolean;
}): string | null {
  if (args.reportReady) return null;
  const submittedAt = String(args.submittedAt ?? "").trim();
  if (!submittedAt) return null;

  const submittedMs = new Date(submittedAt).getTime();
  if (!Number.isFinite(submittedMs)) return null;

  const minutes = args.isDelayed
    ? PATIENT_REPORT_TYPICAL_READY_MINUTES * 2
    : PATIENT_REPORT_TYPICAL_READY_MINUTES;
  return new Date(submittedMs + minutes * 60_000).toISOString();
}

export function resolvePatientProcessingTimeline(args: {
  caseStatus: string | null | undefined;
  hasReportPdf: boolean;
  submittedAt?: string | null;
  nowMs?: number;
}): PatientProcessingTimelineStep[] {
  const activeIndex = resolvePatientProcessingActiveIndex(args);
  const reportReady = normalizePatientCaseStatus(args.caseStatus) === "complete" && args.hasReportPdf;
  const delayed = isPatientProcessingStageDelayed({
    submittedAt: args.submittedAt,
    activeIndex,
    reportReady,
    nowMs: args.nowMs,
  });

  return PATIENT_PROCESSING_TIMELINE_STAGES.map((stage, index) => {
    if (activeIndex >= PATIENT_PROCESSING_TIMELINE_STAGES.length) {
      return {
        stage,
        state: stage === "report_ready" ? ("ready" as const) : ("complete" as const),
      };
    }
    if (index < activeIndex) return { stage, state: "complete" as const };
    if (index === activeIndex) {
      return { stage, state: delayed ? ("delayed" as const) : ("active" as const) };
    }
    return { stage, state: "pending" as const };
  });
}

export function resolveCurrentPatientProcessingStage(args: {
  caseStatus: string | null | undefined;
  hasReportPdf: boolean;
}): PatientProcessingTimelineStage {
  const activeIndex = resolvePatientProcessingActiveIndex(args);
  if (activeIndex >= PATIENT_PROCESSING_TIMELINE_STAGES.length) {
    return "report_ready";
  }
  return PATIENT_PROCESSING_TIMELINE_STAGES[activeIndex] ?? "photos_received";
}

export function buildPatientCaseStatusPayload(args: {
  caseId: string;
  caseStatus: string | null | undefined;
  hasReportPdf: boolean;
  submittedAt?: string | null;
  notificationEmail?: string | null;
  nowMs?: number;
  imageLimitedPathway?: boolean;
  rerunReason?: string | null;
}): PatientCaseStatusPayload {
  const status = normalizePatientCaseStatus(args.caseStatus);
  const reportReady = status === "complete" && args.hasReportPdf;
  const trustDisplay = buildPatientTrustStatusDisplay({
    caseStatus: status,
    hasReportPdf: args.hasReportPdf,
    imageLimitedPathway: args.imageLimitedPathway,
    rerunReason: args.rerunReason,
  });
  const activeIndex = resolvePatientProcessingActiveIndex({
    caseStatus: args.caseStatus,
    hasReportPdf: args.hasReportPdf,
  });
  const delayed = isPatientProcessingStageDelayed({
    submittedAt: args.submittedAt,
    activeIndex,
    reportReady,
    nowMs: args.nowMs,
  });
  const timeline = resolvePatientProcessingTimeline({
    caseStatus: args.caseStatus,
    hasReportPdf: args.hasReportPdf,
    submittedAt: args.submittedAt,
    nowMs: args.nowMs,
  });

  return {
    caseId: args.caseId,
    status,
    reportReady,
    submittedAt: args.submittedAt ?? null,
    estimatedReadyAt: resolveEstimatedReadyAt({
      submittedAt: args.submittedAt,
      reportReady,
      isDelayed: delayed,
    }),
    currentStage: resolveCurrentPatientProcessingStage({
      caseStatus: args.caseStatus,
      hasReportPdf: args.hasReportPdf,
    }),
    timeline,
    maskedEmail: maskNotificationEmail(args.notificationEmail),
    reportUrl: reportReady ? `/cases/${args.caseId}` : null,
    trustTitle: trustDisplay.title,
    trustSubcopy: trustDisplay.subcopy,
    trustInternalState: trustDisplay.internalState,
    showTrustBanner: trustDisplay.showTrustBanner,
  };
}

export function shouldPollPatientCaseStatus(reportReady: boolean, enabled = true): boolean {
  return enabled && !reportReady;
}

export function getPatientCasePollIntervalMs(isDocumentHidden: boolean): number {
  return isDocumentHidden ? 30_000 : 12_000;
}
