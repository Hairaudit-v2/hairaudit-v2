/**
 * HA-UX-7B — Auditor case queue triage: badges, priority scoring, and queue partitioning.
 */

import { isCaseMarkedSuccessfullySubmitted } from "@/lib/patient/caseSubmitStatus";
import {
  computePatientRequiredPhotoProgress,
  type RequiredPhotoProgress,
} from "@/lib/patient/patientRequiredPhotoProgress";
import {
  normalizePatientReviewPathway,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import { AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED } from "@/lib/patient/patientPhotoImageLimitedOverride";

export type AuditorQueueBadge =
  | "FAILED_PROCESSING"
  | "READY_FOR_AUDIT"
  | "MISSING_IMAGES"
  | "AI_PROCESSING"
  | "IMAGE_LIMITED"
  | "ABANDONED"
  | "COMPLETED";

export type AuditorQueueFilter =
  | "all"
  | "needs_action"
  | "ready_to_audit"
  | "failed"
  | "missing_images"
  | "image_limited"
  | "completed"
  | "no_uploads";

export const AUDITOR_QUEUE_FILTER_STORAGE_KEY = "hairaudit-auditor-queue-filter";

export type AuditorQueueCaseInput = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
  submitted_at?: string | null;
  audit_type: "patient" | "doctor" | "clinic" | null;
  patient_review_pathway?: string | null;
  archived_at?: string | null;
  imageUploadCount: number;
  pdfDocumentCount: number;
  uploadTypes: Array<{ type?: string | null }>;
  hasClinicalHistory: boolean;
  patientName: string | null;
  patientEmail: string | null;
  report: {
    status: string | null;
    pdf_path: string | null;
    auditor_review_status?: string | null;
    summary?: Record<string, unknown> | null;
  } | null;
  evidence: {
    missing_categories: string[] | null;
    status?: string | null;
  } | null;
  lastRerunReason?: string | null;
};

export type AuditorQueueDerived = {
  badge: AuditorQueueBadge;
  priorityScore: number;
  isInactive: boolean;
  isNewCase: boolean;
  isCompletedToday: boolean;
  isReadyToAudit: boolean;
  isFailed: boolean;
  isImageLimited: boolean;
  isMissingImages: boolean;
  isAiProcessing: boolean;
  isAbandoned: boolean;
  needsAction: boolean;
  inFailedRecovery: boolean;
  imageLimitedRegenerationNeeded: boolean;
  photoProgress: RequiredPhotoProgress;
  auditTypeLabel: string;
  caseNumberLabel: string;
  failureSummary: string | null;
  auditStatusLabel: "Pending" | "Failed" | "Completed" | "Processing";
  lastActionAt: string;
  actionSortRank: number;
};

const MS_24H = 1000 * 60 * 60 * 24;

const AI_PROCESSING_STATUSES = new Set([
  "submitted",
  "processing",
  "evidence_preparing",
  "evidence_ready",
  "audit_running",
  "audit_complete",
  "pdf_pending",
  "in_review",
]);

const FAILED_CASE_STATUSES = new Set(["audit_failed", "failed"]);
const FAILED_REPORT_STATUSES = new Set(["audit_failed", "failed"]);

function getForensicSummary(summary: Record<string, unknown> | null | undefined) {
  return (summary?.forensic_audit ?? summary?.forensic ?? null) as Record<string, unknown> | null;
}

function isPremiumCase(summary: Record<string, unknown> | null | undefined): boolean {
  const doctorAnswers = summary?.doctor_answers as Record<string, unknown> | null | undefined;
  const clinicAnswers = summary?.clinic_answers as Record<string, unknown> | null | undefined;
  const answers = doctorAnswers ?? clinicAnswers;
  const depth = String(answers?.audit_type ?? "");
  return depth === "advanced_audit" || depth === "forensic_review";
}

function isImageLimitedReport(summary: Record<string, unknown> | null | undefined): boolean {
  const forensic = getForensicSummary(summary);
  return Boolean(forensic?.imageLimitedAssessment ?? summary?.imageLimitedNotice);
}

function isCompletedCase(input: AuditorQueueCaseInput): boolean {
  const reportReview = String(input.report?.auditor_review_status ?? "");
  const caseStatus = String(input.status ?? "");
  const hasPdf = Boolean(input.report?.pdf_path);
  return (
    caseStatus === "complete" ||
    reportReview === "completed" ||
    (hasPdf && String(input.report?.status ?? "") === "complete")
  );
}

function isFailedCase(input: AuditorQueueCaseInput): boolean {
  const caseStatus = String(input.status ?? "");
  const reportStatus = String(input.report?.status ?? "");
  const evidenceStatus = String(input.evidence?.status ?? "");
  if (FAILED_CASE_STATUSES.has(caseStatus)) return true;
  if (FAILED_REPORT_STATUSES.has(reportStatus)) return true;
  if (evidenceStatus === "failed") return true;
  if (caseStatus === "pdf_pending" && !input.report?.pdf_path && reportStatus === "failed") return true;
  return false;
}

function isAiProcessingCase(input: AuditorQueueCaseInput, completed: boolean, failed: boolean): boolean {
  if (completed || failed) return false;
  const caseStatus = String(input.status ?? "");
  const reportStatus = String(input.report?.status ?? "");
  if (AI_PROCESSING_STATUSES.has(caseStatus) && caseStatus !== "submitted") return true;
  if (reportStatus === "processing") return true;
  if (["evidence_preparing", "audit_running", "pdf_pending"].includes(caseStatus)) return true;
  return false;
}

function isReadyToAuditCase(
  input: AuditorQueueCaseInput,
  photoProgress: RequiredPhotoProgress,
  completed: boolean,
  failed: boolean,
  aiProcessing: boolean
): boolean {
  if (completed || failed || aiProcessing) return false;
  const intakeComplete = isCaseMarkedSuccessfullySubmitted(input);
  const evidenceComplete = photoProgress.isComplete || (input.evidence?.missing_categories?.length ?? 0) === 0;
  const aiFinished =
    String(input.report?.status ?? "") === "complete" ||
    Boolean(input.report?.summary) ||
    intakeComplete;
  return intakeComplete && evidenceComplete && aiFinished;
}

function isAbandonedCase(input: AuditorQueueCaseInput): boolean {
  const status = String(input.status ?? "").trim();
  if (status === "draft" && !input.submitted_at) return true;
  if (input.imageUploadCount === 0 && !isCaseMarkedSuccessfullySubmitted(input)) return true;
  return false;
}

function isInactiveCase(input: AuditorQueueCaseInput, abandoned: boolean): boolean {
  if (input.archived_at) return false;
  if (input.imageUploadCount === 0) return true;
  return abandoned;
}

export function deriveAuditTypeLabel(input: AuditorQueueCaseInput): string {
  const pathway = normalizePatientReviewPathway(input.patient_review_pathway);
  if (input.audit_type === "doctor") return "Doctor Audit";
  if (input.audit_type === "clinic") return "Clinic Audit";
  if (pathway === "pre_surgery") return "Pre-Surgery Audit";
  return "Post Surgery Audit";
}

export function deriveCaseNumberLabel(caseId: string): string {
  return `#${caseId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export function deriveAuditorQueueCase(
  input: AuditorQueueCaseInput,
  nowMs: number = Date.now()
): AuditorQueueDerived {
  const pathway = normalizePatientReviewPathway(
    input.patient_review_pathway
  ) as PatientReviewPathway;
  const photoProgress = computePatientRequiredPhotoProgress(input.uploadTypes, pathway);
  const completed = isCompletedCase(input);
  const failed = isFailedCase(input);
  const imageLimited =
    isImageLimitedReport(input.report?.summary ?? null) ||
    input.lastRerunReason === AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED;
  const missingImages =
    !photoProgress.isComplete &&
    input.imageUploadCount > 0 &&
    isCaseMarkedSuccessfullySubmitted(input) &&
    !completed;
  const aiProcessing = isAiProcessingCase(input, completed, failed);
  const readyToAudit = isReadyToAuditCase(input, photoProgress, completed, failed, aiProcessing);
  const abandoned = isAbandonedCase(input);
  const inactive = isInactiveCase(input, abandoned);

  const submittedMs = new Date(input.submitted_at ?? input.created_at).getTime();
  const isNewCase = Number.isFinite(submittedMs) && nowMs - submittedMs <= MS_24H && !completed;

  const completedMs = input.report?.pdf_path
    ? new Date(input.updated_at ?? input.submitted_at ?? input.created_at).getTime()
    : NaN;
  const isCompletedToday = completed && Number.isFinite(completedMs) && nowMs - completedMs <= MS_24H;

  let badge: AuditorQueueBadge;
  if (completed) badge = "COMPLETED";
  else if (failed) badge = "FAILED_PROCESSING";
  else if (imageLimited && !photoProgress.isComplete) badge = "IMAGE_LIMITED";
  else if (readyToAudit) badge = "READY_FOR_AUDIT";
  else if (missingImages || (!photoProgress.isComplete && input.imageUploadCount > 0)) badge = "MISSING_IMAGES";
  else if (aiProcessing) badge = "AI_PROCESSING";
  else if (abandoned || inactive) badge = "ABANDONED";
  else badge = "AI_PROCESSING";

  let priorityScore = 0;
  if (photoProgress.isComplete) priorityScore += 50;
  if (failed) priorityScore += 40;
  if (input.hasClinicalHistory) priorityScore += 30;
  if (input.pdfDocumentCount > 0) priorityScore += 20;
  if (isPremiumCase(input.report?.summary ?? null)) priorityScore += 10;
  if (input.imageUploadCount === 0) priorityScore -= 50;
  if (isNewCase) priorityScore += 15;
  if (readyToAudit) priorityScore += 25;

  const imageLimitedRegenerationNeeded =
    imageLimited && (failed || missingImages) && !completed;

  const needsAction =
    !completed &&
    !inactive &&
    (failed ||
      readyToAudit ||
      isNewCase ||
      imageLimitedRegenerationNeeded ||
      missingImages ||
      aiProcessing);

  const inFailedRecovery = failed;

  let actionSortRank = 99;
  if (failed) actionSortRank = 1;
  else if (readyToAudit) actionSortRank = 2;
  else if (isNewCase) actionSortRank = 3;
  else if (missingImages) actionSortRank = 4;
  else if (aiProcessing) actionSortRank = 5;

  const missingLabels = photoProgress.missingLabels;
  const evidenceMissing = input.evidence?.missing_categories ?? [];
  const failureSummary = failed
    ? missingLabels.length
      ? `Missing ${missingLabels.slice(0, 2).join(" + ")}${missingLabels.length > 2 ? "…" : ""}`
      : evidenceMissing.length
        ? `Missing ${evidenceMissing.slice(0, 2).join(", ")}`
        : "Processing failed"
    : null;

  let auditStatusLabel: AuditorQueueDerived["auditStatusLabel"] = "Pending";
  if (completed) auditStatusLabel = "Completed";
  else if (failed) auditStatusLabel = "Failed";
  else if (aiProcessing) auditStatusLabel = "Processing";

  const lastActionAt =
    input.updated_at ??
    input.submitted_at ??
    input.created_at;

  return {
    badge,
    priorityScore,
    isInactive: inactive,
    isNewCase,
    isCompletedToday,
    isReadyToAudit: readyToAudit,
    isFailed: failed,
    isImageLimited: imageLimited,
    isMissingImages: missingImages,
    isAiProcessing: aiProcessing,
    isAbandoned: abandoned,
    needsAction,
    inFailedRecovery,
    imageLimitedRegenerationNeeded,
    photoProgress,
    auditTypeLabel: deriveAuditTypeLabel(input),
    caseNumberLabel: deriveCaseNumberLabel(input.id),
    failureSummary,
    auditStatusLabel,
    lastActionAt,
    actionSortRank,
  };
}

export type AuditorQueueSummaryCounts = {
  newCases: number;
  readyToAudit: number;
  incompleteSubmissions: number;
  failedProcessing: number;
  imageLimitedCases: number;
  completedToday: number;
};

export function computeQueueSummaryCounts(
  rows: Array<{ derived: AuditorQueueDerived; input: AuditorQueueCaseInput }>
): AuditorQueueSummaryCounts {
  const active = rows.filter((r) => !r.input.archived_at && !r.derived.isInactive);
  return {
    newCases: active.filter((r) => r.derived.isNewCase).length,
    readyToAudit: active.filter((r) => r.derived.isReadyToAudit).length,
    incompleteSubmissions: active.filter((r) => r.derived.isMissingImages).length,
    failedProcessing: active.filter((r) => r.derived.isFailed).length,
    imageLimitedCases: active.filter((r) => r.derived.isImageLimited).length,
    completedToday: rows.filter((r) => r.derived.isCompletedToday).length,
  };
}

export function matchesQueueFilter(
  filter: AuditorQueueFilter,
  row: { derived: AuditorQueueDerived; input: AuditorQueueCaseInput }
): boolean {
  const { derived, input } = row;
  switch (filter) {
    case "all":
      return !derived.isInactive;
    case "needs_action":
      return derived.needsAction && !derived.isInactive;
    case "ready_to_audit":
      return derived.isReadyToAudit && !derived.isInactive;
    case "failed":
      return derived.isFailed && !derived.isInactive;
    case "missing_images":
      return derived.isMissingImages && !derived.isInactive;
    case "image_limited":
      return derived.isImageLimited && !derived.isInactive;
    case "completed":
      return derived.badge === "COMPLETED";
    case "no_uploads":
      return input.imageUploadCount === 0 || derived.isInactive;
    default:
      return true;
  }
}

export function badgeStyles(badge: AuditorQueueBadge): { bg: string; text: string; label: string } {
  switch (badge) {
    case "FAILED_PROCESSING":
      return { bg: "bg-red-100 border-red-300", text: "text-red-800", label: "Failed Processing" };
    case "READY_FOR_AUDIT":
      return { bg: "bg-emerald-100 border-emerald-300", text: "text-emerald-800", label: "Ready For Audit" };
    case "MISSING_IMAGES":
      return { bg: "bg-orange-100 border-orange-300", text: "text-orange-800", label: "Missing Images" };
    case "AI_PROCESSING":
      return { bg: "bg-blue-100 border-blue-300", text: "text-blue-800", label: "AI Processing" };
    case "IMAGE_LIMITED":
      return { bg: "bg-violet-100 border-violet-300", text: "text-violet-800", label: "Image Limited" };
    case "ABANDONED":
      return { bg: "bg-slate-100 border-slate-300", text: "text-slate-600", label: "Abandoned" };
    case "COMPLETED":
      return { bg: "bg-emerald-900/10 border-emerald-800", text: "text-emerald-950", label: "Completed" };
  }
}

export function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export function countUploadStats(uploadRows: Array<{ case_id: string; type?: string | null }>) {
  const byCase = new Map<string, { imageUploadCount: number; pdfDocumentCount: number; uploadTypes: Array<{ type?: string | null }> }>();
  for (const row of uploadRows) {
    const cid = String(row.case_id);
    let entry = byCase.get(cid);
    if (!entry) {
      entry = { imageUploadCount: 0, pdfDocumentCount: 0, uploadTypes: [] };
      byCase.set(cid, entry);
    }
    const type = String(row.type ?? "").toLowerCase();
    entry.uploadTypes.push({ type: row.type });
    if (type.startsWith("patient_photo:") || type.startsWith("doctor_photo:") || type.startsWith("clinic_photo:")) {
      entry.imageUploadCount += 1;
    }
    if (type.includes("document") || type.includes("_pdf") || type.endsWith(":pdf")) {
      entry.pdfDocumentCount += 1;
    }
  }
  return byCase;
}
