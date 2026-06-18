/**
 * Patient-facing delivery state for HA-TRUST-2.
 * Keeps partial reports, scores, and forensic workspace hidden until the report is ready.
 */

export type PatientReportDeliveryPhase = "draft" | "processing" | "delivered" | "audit_failed";

export type PatientProcessingTimelineStage =
  | "submission_received"
  | "clinical_review"
  | "report_preparation"
  | "email_notification";

export type PatientProcessingTimelineStep = {
  stage: PatientProcessingTimelineStage;
  state: "complete" | "active" | "upcoming";
};

export function normalizePatientCaseStatus(status: string | null | undefined): string {
  return String(status ?? "draft").trim().toLowerCase();
}

export function resolvePatientReportDeliveryPhase(args: {
  caseStatus: string | null | undefined;
  hasReportPdf: boolean;
}): PatientReportDeliveryPhase {
  const status = normalizePatientCaseStatus(args.caseStatus);
  if (status === "audit_failed") return "audit_failed";
  if (status === "draft") return "draft";
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
    local.length <= 1 ? `${visible}*` : `${visible}${"*".repeat(Math.min(3, local.length - 1))}`;
  return `${maskedLocal}@${domain}`;
}

export function resolvePatientProcessingTimeline(args: {
  caseStatus: string | null | undefined;
  hasReportPdf: boolean;
}): PatientProcessingTimelineStep[] {
  const status = normalizePatientCaseStatus(args.caseStatus);
  const stages: PatientProcessingTimelineStage[] = [
    "submission_received",
    "clinical_review",
    "report_preparation",
    "email_notification",
  ];

  let activeIndex = 1;
  if (status === "submitted") activeIndex = 1;
  else if (status === "processing" || status === "audit_running" || status === "evidence_preparing") activeIndex = 1;
  else if (
    status === "audit_complete" ||
    status === "evidence_ready" ||
    status === "pdf_pending" ||
    status === "pdf_ready"
  ) {
    activeIndex = 2;
  } else if (status === "complete" && !args.hasReportPdf) activeIndex = 2;
  else if (status === "complete" && args.hasReportPdf) activeIndex = stages.length;

  return stages.map((stage, index) => ({
    stage,
    state: index < activeIndex ? "complete" : index === activeIndex ? "active" : "upcoming",
  }));
}
