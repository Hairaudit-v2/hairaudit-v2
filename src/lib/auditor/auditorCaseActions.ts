/**
 * HA-AUDITOR-DASHBOARD-REGRESSION-1A — Context-aware auditor case CTAs.
 * Canonical edit workspace: /cases/[caseId]
 */

import type { AuditorQueueCaseInput, AuditorQueueDerived } from "@/lib/auditor/auditorQueueTriage";

export const AUDITOR_CASE_WORKSPACE_PATH = (caseId: string) => `/cases/${caseId}`;

export type AuditorCaseActionKind =
  | "start_audit"
  | "continue_audit"
  | "open_manual_audit"
  | "retry_processing"
  | "retry_pdf"
  | "view_case"
  | "request_missing_images"
  | "review_report"
  | "edit_report"
  | "finalise_report"
  | "regenerate_audit"
  | "image_limited_override"
  | "mark_for_review";

export type AuditorCaseAction = {
  kind: AuditorCaseActionKind;
  label: string;
  /** Primary visual weight (filled button). */
  primary: boolean;
  /** Opens the case workspace. */
  opensWorkspace: boolean;
  /** Call lifecycle mark_in_progress before navigate. */
  claimAssignment: boolean;
};

function hasGeneratedReport(input: AuditorQueueCaseInput): boolean {
  return Boolean(input.report?.pdf_path) || Boolean(input.report?.summary) || String(input.report?.status ?? "") === "complete";
}

function isAuditInProgress(input: AuditorQueueCaseInput, derived: AuditorQueueDerived): boolean {
  if (derived.needsManualInput) return true;
  if (input.auditor_started_at) return true;
  const review = String(input.report?.auditor_review_status ?? "");
  return review === "available" || review === "in_review";
}

/**
 * Resolve ordered, context-aware actions for a queue card.
 * Failed AI processing never removes manual audit access.
 */
export function resolveAuditorCaseActions(
  input: AuditorQueueCaseInput,
  derived: AuditorQueueDerived
): AuditorCaseAction[] {
  const actions: AuditorCaseAction[] = [];

  if (derived.badge === "COMPLETED") {
    actions.push(
      { kind: "review_report", label: "Review Report", primary: true, opensWorkspace: true, claimAssignment: false },
      { kind: "edit_report", label: "Edit Report", primary: false, opensWorkspace: true, claimAssignment: false },
      { kind: "finalise_report", label: "Finalise Report", primary: false, opensWorkspace: true, claimAssignment: false }
    );
    return actions;
  }

  // Failed processing must never lose manual edit access — check before waiting-on-patient.
  if (derived.isFailed) {
    actions.push({
      kind: "open_manual_audit",
      label: "Open Manual Audit",
      primary: true,
      opensWorkspace: true,
      claimAssignment: true,
    });
    if (derived.failureType === "PDF_GENERATION") {
      actions.push({
        kind: "retry_pdf",
        label: "Retry Processing",
        primary: false,
        opensWorkspace: false,
        claimAssignment: false,
      });
    } else {
      actions.push({
        kind: "retry_processing",
        label: "Retry Processing",
        primary: false,
        opensWorkspace: false,
        claimAssignment: false,
      });
    }
    return actions;
  }

  if (derived.waitingOnPatient || derived.badge === "MISSING_IMAGES") {
    actions.push({
      kind: "view_case",
      label: "View Case",
      primary: true,
      opensWorkspace: true,
      claimAssignment: false,
    });
    if (derived.isMissingImages || derived.waitingOnPatient) {
      actions.push({
        kind: "request_missing_images",
        label: "Request Missing Images",
        primary: false,
        opensWorkspace: false,
        claimAssignment: false,
      });
    }
    return actions;
  }

  if (hasGeneratedReport(input) && (derived.isReadyToAudit || isAuditInProgress(input, derived))) {
    if (isAuditInProgress(input, derived)) {
      actions.push({
        kind: "continue_audit",
        label: "Continue Audit",
        primary: true,
        opensWorkspace: true,
        claimAssignment: true,
      });
    } else {
      actions.push({
        kind: "start_audit",
        label: "Start Audit",
        primary: true,
        opensWorkspace: true,
        claimAssignment: true,
      });
    }
    actions.push(
      { kind: "review_report", label: "Review Report", primary: false, opensWorkspace: true, claimAssignment: false },
      { kind: "edit_report", label: "Edit Report", primary: false, opensWorkspace: true, claimAssignment: false },
      { kind: "finalise_report", label: "Finalise Report", primary: false, opensWorkspace: true, claimAssignment: false }
    );
    if (derived.imageLimitedRegenerationNeeded || derived.isImageLimited) {
      actions.push({
        kind: "image_limited_override",
        label: "Image Limited Override",
        primary: false,
        opensWorkspace: false,
        claimAssignment: false,
      });
    }
    return actions;
  }

  if (isAuditInProgress(input, derived)) {
    actions.push({
      kind: "continue_audit",
      label: "Continue Audit",
      primary: true,
      opensWorkspace: true,
      claimAssignment: true,
    });
  } else if (derived.isReadyToAudit || derived.badge === "READY_FOR_AUDIT") {
    actions.push({
      kind: "start_audit",
      label: "Start Audit",
      primary: true,
      opensWorkspace: true,
      claimAssignment: true,
    });
  } else if (derived.isAiProcessing) {
    actions.push({
      kind: "view_case",
      label: "View Case",
      primary: true,
      opensWorkspace: true,
      claimAssignment: false,
    });
  } else {
    actions.push({
      kind: "start_audit",
      label: "Start Audit",
      primary: true,
      opensWorkspace: true,
      claimAssignment: true,
    });
  }

  if (!derived.isAiProcessing) {
    actions.push({
      kind: "regenerate_audit",
      label: "Regenerate",
      primary: false,
      opensWorkspace: false,
      claimAssignment: false,
    });
  }

  if (derived.imageLimitedRegenerationNeeded || derived.isImageLimited) {
    actions.push({
      kind: "image_limited_override",
      label: "Image Limited Override",
      primary: false,
      opensWorkspace: false,
      claimAssignment: false,
    });
  }

  if (derived.needsManualInput === false && derived.isReadyToAudit) {
    actions.push({
      kind: "mark_for_review",
      label: "Mark For Review",
      primary: false,
      opensWorkspace: false,
      claimAssignment: false,
    });
  }

  return actions;
}
