/**
 * HA-TRUST-4 — Patient failure-state translation engine.
 * Converts internal pipeline states into trust-preserving clinical communication.
 * Auditor/admin surfaces must continue using technical language elsewhere.
 */

/** Internal system states that map to patient-visible trust copy. */
export const PATIENT_TRUST_INTERNAL_STATES = [
  "processing",
  "failed",
  "missing_images",
  "awaiting_translation",
  "image_limited",
  "manual_review_required",
  "regenerating",
  "pdf_rebuild",
  "classifier_retry",
  "audit_recovery_mode",
  "completed",
] as const;

export type PatientTrustInternalState = (typeof PATIENT_TRUST_INTERNAL_STATES)[number];

export type PatientTrustStatusTranslation = {
  title: string;
  subcopy: string;
};

/** Minutes after submission before delayed reassurance email may send. */
export const PATIENT_REVIEW_DELAYED_EMAIL_THRESHOLD_MINUTES = 30;

const TRUST_STATUS_MAP: Record<PatientTrustInternalState, PatientTrustStatusTranslation> = {
  processing: {
    title: "Specialist Review In Progress",
    subcopy:
      "Your case is currently being reviewed by our clinical intelligence systems.",
  },
  failed: {
    title: "Additional Quality Review In Progress",
    subcopy:
      "Your case is undergoing additional review steps to ensure the highest level of report accuracy.",
  },
  missing_images: {
    title: "Reviewing Submitted Case Materials",
    subcopy:
      "Our specialists are reviewing the information and images submitted as part of your case.",
  },
  awaiting_translation: {
    title: "Preparing Clinical Review",
    subcopy: "Your submitted information is being prepared for specialist review.",
  },
  image_limited: {
    title: "Enhanced Clinical Review Completed",
    subcopy:
      "Your report was prepared using the clinical information and case materials currently available. Our specialist team has taken additional care to ensure the highest possible level of assessment accuracy.",
  },
  manual_review_required: {
    title: "Specialist Review Escalated",
    subcopy:
      "Your case has been escalated for additional specialist review to ensure report quality.",
  },
  regenerating: {
    title: "Final Verification In Progress",
    subcopy: "Your report is currently undergoing final review before release.",
  },
  pdf_rebuild: {
    title: "Preparing Final Report",
    subcopy: "Your final report is currently being prepared for delivery.",
  },
  classifier_retry: {
    title: "Additional Quality Verification In Progress",
    subcopy: "Your case is currently undergoing an additional verification step.",
  },
  audit_recovery_mode: {
    title: "Specialist Review Continuing",
    subcopy:
      "Our review team is actively working through additional quality assurance steps.",
  },
  completed: {
    title: "Report Ready",
    subcopy: "Your HairAudit review has been completed and is now available.",
  },
};

/** Trust banner shown on all non-completed patient states. */
export const PATIENT_TRUST_BANNER_COPY = {
  headline: "Your HairAudit review is actively being processed.",
  body:
    "In some situations our specialist review team performs additional quality checks to ensure the highest possible level of report accuracy.",
  patience: "This may occasionally extend processing time slightly.",
  thanks: "Thank you for your patience.",
} as const;

/** Patient-safe report download / PDF unavailable messaging. */
export const PATIENT_REPORT_PREPARING_COPY: PatientTrustStatusTranslation = {
  title: "Preparing Final Report",
  subcopy:
    "Your final report is currently being prepared for release. Our review systems are completing final quality verification before delivery. Please check back shortly.",
};

/** Image-limited pathway — patient must never see internal workflow labels. */
export const PATIENT_IMAGE_LIMITED_TRUST_NOTICE = TRUST_STATUS_MAP.image_limited;

/** Forbidden patient-facing fragments — used in tests and sanitizers. */
export const PATIENT_FORBIDDEN_TERMS = [
  "failed",
  "error",
  "processing failure",
  "missing required images",
  "regeneration failed",
  "pdf missing",
  "classifier failed",
  "retrying job",
  "rebuild pdf",
  "audit failed",
  "missing photos",
  "missing donor",
  "image limited audit",
  "image-limited audit",
] as const;

export function translatePatientVisibleCaseStatus(
  internalState: PatientTrustInternalState
): PatientTrustStatusTranslation {
  return TRUST_STATUS_MAP[internalState];
}

export type ResolvePatientTrustInternalStateArgs = {
  caseStatus: string | null | undefined;
  hasReportPdf?: boolean;
  /** When true, case used document-assisted image-limited pathway. */
  imageLimitedPathway?: boolean;
  /** Auditor rerun reason or pipeline sub-state hint. */
  rerunReason?: string | null;
};

export function resolvePatientTrustInternalState(
  args: ResolvePatientTrustInternalStateArgs
): PatientTrustInternalState {
  const status = String(args.caseStatus ?? "draft").trim().toLowerCase();
  const hasPdf = Boolean(args.hasReportPdf);

  if (status === "complete" && hasPdf) {
    return args.imageLimitedPathway ? "image_limited" : "completed";
  }
  if (args.imageLimitedPathway && status === "complete") return "image_limited";

  if (status === "audit_failed" || status === "failed") return "failed";
  if (status === "complete" && !hasPdf) return "pdf_rebuild";
  if (status === "pdf_pending" || status === "pdf_ready") return "pdf_rebuild";
  if (status === "evidence_preparing") return "awaiting_translation";
  if (status === "audit_running") return "classifier_retry";
  if (
    args.rerunReason === "document_assisted_image_limited" ||
    args.rerunReason === "missing_images"
  ) {
    return "missing_images";
  }
  if (status === "manual_review_required" || status === "in_review") {
    return "manual_review_required";
  }
  if (
    status === "submitted" ||
    status === "processing" ||
    status === "evidence_ready" ||
    status === "audit_complete" ||
    status === "regenerating"
  ) {
    return "processing";
  }

  return "processing";
}

export function buildPatientTrustStatusDisplay(
  args: ResolvePatientTrustInternalStateArgs
): PatientTrustStatusTranslation & {
  internalState: PatientTrustInternalState;
  showTrustBanner: boolean;
} {
  const internalState = resolvePatientTrustInternalState(args);
  const translation = translatePatientVisibleCaseStatus(internalState);
  const showTrustBanner =
    internalState !== "completed" && internalState !== "image_limited";

  return {
    ...translation,
    internalState,
    showTrustBanner,
  };
}

/** Maps internal timeline/log events to patient-safe event labels. */
const PATIENT_TIMELINE_EVENT_MAP: Record<string, string> = {
  "AI processing failed": "Additional quality review initiated",
  "Missing required donor image": "Case materials undergoing specialist review",
  "Missing required crown image": "Case materials undergoing specialist review",
  "Missing required patient photos": "Case materials undergoing specialist review",
  "PDF rebuild triggered": "Final report preparation underway",
  "Report regeneration failed": "Additional quality verification in progress",
  "Classifier failed": "Additional quality verification in progress",
  "Audit pipeline failed": "Additional quality review initiated",
  "PDF missing": "Final report preparation underway",
};

export function translatePatientTimelineEvent(internalEvent: string): string {
  const trimmed = String(internalEvent ?? "").trim();
  if (!trimmed) return translatePatientVisibleCaseStatus("processing").title;

  const direct = PATIENT_TIMELINE_EVENT_MAP[trimmed];
  if (direct) return direct;

  const lower = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(PATIENT_TIMELINE_EVENT_MAP)) {
    if (lower.includes(key.toLowerCase())) return value;
  }

  if (/fail|error|missing|regenerat|rebuild|classifier|retry/i.test(lower)) {
    return translatePatientVisibleCaseStatus("audit_recovery_mode").title;
  }

  return trimmed;
}

export type PatientSafeApiResponse = {
  status: string;
  message: string;
};

/** Converts technical API errors into patient-safe responses. */
export function toPatientSafeApiResponse(
  technicalError: string,
  context?: "report_download" | "status" | "generic"
): PatientSafeApiResponse {
  const lower = String(technicalError ?? "").toLowerCase();

  if (
    context === "report_download" ||
    /report file|pdf|could not load|not ready|missing.*pdf|regenerat/i.test(lower)
  ) {
    return {
      status: "preparing_report",
      message: PATIENT_REPORT_PREPARING_COPY.subcopy,
    };
  }

  if (/missing.*image|missing.*photo|required.*photo/i.test(lower)) {
    return {
      status: "reviewing_materials",
      message: translatePatientVisibleCaseStatus("missing_images").subcopy,
    };
  }

  if (/fail|error|processing failure|unavailable|not found/i.test(lower)) {
    return {
      status: "additional_review",
      message: translatePatientVisibleCaseStatus("audit_recovery_mode").subcopy,
    };
  }

  return {
    status: "in_progress",
    message: translatePatientVisibleCaseStatus("processing").subcopy,
  };
}

export function containsPatientForbiddenTerm(text: string): boolean {
  const lower = String(text ?? "").toLowerCase();
  return PATIENT_FORBIDDEN_TERMS.some((term) => lower.includes(term));
}

/** Delayed reassurance email — subject and body (HA-TRUST-4 Part 4). */
export const PATIENT_REVIEW_STILL_IN_PROGRESS_EMAIL = {
  subject: "Your HairAudit review is still in progress",
  body: `Thank you for submitting your HairAudit review.

Your case is currently undergoing an additional quality review step to ensure the highest level of assessment accuracy.

In some situations our specialist team performs additional review to ensure your report is as accurate and helpful as possible.

This occasionally takes slightly longer than standard processing.

Our team is actively reviewing your case and we will notify you as soon as your report is ready.

Thank you for your patience.

The HairAudit Clinical Team`,
} as const;
