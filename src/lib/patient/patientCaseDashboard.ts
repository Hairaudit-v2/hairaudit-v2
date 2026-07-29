/**
 * HA-PATHWAY-FIX-2 — pathway-selected patient case dashboard view-model.
 *
 * The entire patient case dashboard must follow `cases.patient_review_pathway`
 * (server-side, fail-closed). Never trust URL/query/client pathway overrides.
 */

import {
  isPathwayMinimalIntakeComplete,
  PATIENT_PATHWAY_DISPLAY_LABELS,
} from "@/lib/patient/patientResumeReview";
import {
  resolvePatientReportDeliveryPhase,
  type PatientReportDeliveryPhase,
} from "@/lib/patient/patientProcessingView";
import {
  computePatientRequiredPhotoProgress,
  type RequiredPhotoProgress,
} from "@/lib/patient/patientRequiredPhotoProgress";
import {
  PATHWAY_EVIDENCE_PACKS,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import { resolveCanonicalPatientReviewPathway } from "@/lib/patient/patientPathwayQuestionnaire";

export { resolveCanonicalPatientReviewPathway };

export const INVALID_PATIENT_REVIEW_PATHWAY_DASHBOARD_ERROR =
  "This case is missing a valid review pathway. Please start a new review from your dashboard.";

/** Post-surgery chrome that must never mount for pre_surgery patients. */
export const PRE_SURGERY_FORBIDDEN_DASHBOARD_STRINGS = [
  "Graft Integrity Index",
  "claimed grafts",
  "estimated extracted",
  "estimated implanted",
  "variance versus claimed",
  "Months Post-op",
  "Audit Source",
  "Submit for audit",
  "Complete your audit",
  "Pending Auditor Review",
  "benchmarked against global surgical standards",
  "surgery-day",
  "immediate post-op",
  "early healing",
] as const;

export type PatientCaseDashboardNextActionId =
  | "complete_photos"
  | "complete_questions"
  | "submit_review"
  | "review_preparing"
  | "view_report"
  | "pathway_invalid";

export type PatientCaseDashboardNextAction = {
  id: PatientCaseDashboardNextActionId;
  title: string;
  subtitle: string;
  primaryCtaLabel: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
};

export type PatientCaseSummaryField =
  | "case_reference"
  | "review_type"
  | "status"
  | "created_date"
  | "last_updated"
  | "procedure_date"
  | "months_post_op"
  | "audit_source"
  | "clinic"
  | "score"
  | "confidence";

export type PatientCaseDashboardSectionId =
  | "header"
  | "next_action"
  | "case_summary"
  | "photo_evidence"
  | "questionnaire"
  | "clinic_contribution"
  | "planning_assessment"
  | "graft_integrity"
  | "report_card"
  | "contribution_paths"
  | "evidence_summary"
  | "intelligence_dashboard"
  | "domains"
  | "latest_report_benchmarking";

export type PatientCaseDashboardViewModel = {
  pathway: PatientReviewPathway | null;
  pathwayValid: boolean;
  pathwayLabel: string | null;
  headerEyebrow: string;
  headerTitle: string;
  headerDescription: string;
  nextAction: PatientCaseDashboardNextAction;
  summaryFields: readonly PatientCaseSummaryField[];
  sections: ReadonlySet<PatientCaseDashboardSectionId>;
  photoProgress: RequiredPhotoProgress | null;
  questionsComplete: boolean;
  deliveryPhase: PatientReportDeliveryPhase;
  requiredPhotoKeys: readonly string[];
  planningAssessmentPlaceholder: string;
  reportCardTitle: string;
  reportCardPendingText: string;
  questionnaireLabel: string;
  clinicContributionTitle: string;
  clinicContributionBody: string;
  submitLabel: string;
  submitResubmitLabel: string;
  submitWhatHappensNext: string;
};

const PRE_SURGERY_SECTIONS: readonly PatientCaseDashboardSectionId[] = [
  "header",
  "next_action",
  "case_summary",
  "photo_evidence",
  "questionnaire",
  "clinic_contribution",
  "planning_assessment",
  "report_card",
];

const POST_SURGERY_SECTIONS: readonly PatientCaseDashboardSectionId[] = [
  "header",
  "next_action",
  "case_summary",
  "photo_evidence",
  "questionnaire",
  "clinic_contribution",
  "graft_integrity",
  "contribution_paths",
  "evidence_summary",
  "intelligence_dashboard",
  "domains",
  "latest_report_benchmarking",
  "report_card",
];

const PRE_SURGERY_SUMMARY_FIELDS: readonly PatientCaseSummaryField[] = [
  "case_reference",
  "review_type",
  "status",
  "created_date",
  "last_updated",
];

const POST_SURGERY_SUMMARY_FIELDS: readonly PatientCaseSummaryField[] = [
  "case_reference",
  "clinic",
  "audit_source",
  "procedure_date",
  "months_post_op",
  "score",
  "confidence",
];

export const PRE_SURGERY_PLANNING_OUTPUTS = [
  "Observed hair-loss pattern",
  "Donor visibility",
  "Indicative graft range",
  "Priority treatment areas",
  "Hairline-planning considerations",
  "Existing-hair protection considerations",
  "Staged-treatment considerations",
  "Questions to ask a treating clinic",
] as const;

export const PRE_SURGERY_PLANNING_PLACEHOLDER =
  "Your Pre-Surgery Planning Assessment will be prepared after your photos and questions are reviewed. It will cover planning considerations such as hair-loss pattern, donor visibility, indicative graft range, and questions to discuss with a treating clinic.";

export const PRE_SURGERY_REPORT_PENDING_TEXT =
  "Your report will provide an independent planning review based on the information and photos available.";

/** Resolve pathway for patient dashboard only — fail closed, ignore client/URL. */
export function resolvePatientDashboardPathwayFromCase(
  row: { patient_review_pathway?: string | null } | null | undefined,
  opts?: { urlPathway?: unknown; clientPathway?: unknown }
): PatientReviewPathway | null {
  void opts?.urlPathway;
  void opts?.clientPathway;
  return resolveCanonicalPatientReviewPathway(row?.patient_review_pathway);
}

export function shouldMountPatientPostSurgeryChrome(args: {
  isPatientForCase: boolean;
  pathway: PatientReviewPathway | null;
  /** When patient is awaiting report delivery, forensic chrome is already hidden. */
  patientHidesForensicWorkspace: boolean;
}): boolean {
  if (!args.isPatientForCase) return !args.patientHidesForensicWorkspace;
  if (args.pathway !== "post_surgery") return false;
  return !args.patientHidesForensicWorkspace;
}

export function shouldMountPatientPreSurgeryChrome(args: {
  isPatientForCase: boolean;
  pathway: PatientReviewPathway | null;
}): boolean {
  return args.isPatientForCase && args.pathway === "pre_surgery";
}

export function resolvePatientCaseDashboardNextAction(args: {
  pathway: PatientReviewPathway | null;
  photoProgress: RequiredPhotoProgress | null;
  questionsComplete: boolean;
  deliveryPhase: PatientReportDeliveryPhase;
  caseId: string;
}): PatientCaseDashboardNextAction {
  const { pathway, caseId } = args;
  if (!pathway) {
    return {
      id: "pathway_invalid",
      title: "Review pathway unavailable",
      subtitle: INVALID_PATIENT_REVIEW_PATHWAY_DASHBOARD_ERROR,
      primaryCtaLabel: "Return to dashboard",
      primaryCtaHref: "/dashboard/patient",
      secondaryCtaLabel: null,
      secondaryCtaHref: null,
    };
  }

  const isPre = pathway === "pre_surgery";
  const photosHref = `/cases/${caseId}/patient/photos`;
  const questionsHref = `/cases/${caseId}/patient/questions`;
  const caseHref = `/cases/${caseId}`;

  if (args.deliveryPhase === "delivered") {
    return {
      id: "view_report",
      title: isPre ? "View Your Pre-Surgery Review Report" : "Your report is ready",
      subtitle: isPre
        ? "Your independent planning review is ready to view."
        : "View findings, photos, and next steps.",
      primaryCtaLabel: isPre ? "View Pre-Surgery Review Report" : "View Report",
      primaryCtaHref: caseHref,
      secondaryCtaLabel: null,
      secondaryCtaHref: null,
    };
  }

  if (args.deliveryPhase === "processing" || args.deliveryPhase === "audit_failed") {
    return {
      id: "review_preparing",
      title: isPre
        ? "Your Pre-Surgery Review Is Being Prepared"
        : "Your report is being prepared",
      subtitle: isPre
        ? "Specialists are preparing your independent planning review. We will notify you when it is ready."
        : "Your images are being carefully reviewed. We will email you when your report is ready.",
      primaryCtaLabel: null,
      primaryCtaHref: null,
      secondaryCtaLabel: null,
      secondaryCtaHref: null,
    };
  }

  if (!args.photoProgress?.isComplete) {
    return {
      id: "complete_photos",
      title: isPre ? "Complete Your Photos" : "Complete your audit",
      subtitle: isPre
        ? "Upload the required planning photos so we can prepare your review."
        : "Upload photos · Complete questions",
      primaryCtaLabel: "Upload Photos",
      primaryCtaHref: photosHref,
      secondaryCtaLabel: isPre ? null : "Complete Intake Questions",
      secondaryCtaHref: isPre ? null : questionsHref,
    };
  }

  if (!args.questionsComplete) {
    return {
      id: "complete_questions",
      title: isPre ? "Complete Your Pre-Surgery Questions" : "Complete your audit",
      subtitle: isPre
        ? "Answer a few planning questions, then submit your review."
        : "Upload photos · Complete questions",
      primaryCtaLabel: isPre ? "Continue Questions" : "Complete Intake Questions",
      primaryCtaHref: questionsHref,
      secondaryCtaLabel: isPre ? "Review Uploaded Photos" : "Upload Photos",
      secondaryCtaHref: photosHref,
    };
  }

  return {
    id: "submit_review",
    title: isPre ? "Submit Pre-Surgery Review" : "Submit for audit",
    subtitle: isPre
      ? "Your photos and questions are ready. Submit to start your planning review."
      : "Your photos and questions are ready. Submit to start your independent review.",
    primaryCtaLabel: isPre ? "Submit Pre-Surgery Review" : "Submit for audit",
    primaryCtaHref: caseHref,
    secondaryCtaLabel: isPre ? "Review Uploaded Photos" : "Upload Photos",
    secondaryCtaHref: photosHref,
  };
}

export function buildPatientCaseDashboardViewModel(args: {
  caseId: string;
  caseTitle?: string | null;
  caseStatus: string | null | undefined;
  patientReviewPathway: unknown;
  uploads: Array<{ type?: string | null }>;
  patientAnswers: Record<string, unknown> | null | undefined;
  hasReportPdf: boolean;
  /** Intentionally ignored — must not select dashboard pathway. */
  urlPathway?: unknown;
  clientPathway?: unknown;
}): PatientCaseDashboardViewModel {
  void args.urlPathway;
  void args.clientPathway;

  const pathway = resolveCanonicalPatientReviewPathway(args.patientReviewPathway);
  const deliveryPhase = resolvePatientReportDeliveryPhase({
    caseStatus: args.caseStatus,
    hasReportPdf: args.hasReportPdf,
    patientTrustLayer: true,
  });

  const photoProgress = pathway
    ? computePatientRequiredPhotoProgress(args.uploads, pathway)
    : null;
  const questionsComplete = pathway
    ? isPathwayMinimalIntakeComplete(pathway, args.patientAnswers)
    : false;

  const nextAction = resolvePatientCaseDashboardNextAction({
    pathway,
    photoProgress,
    questionsComplete,
    deliveryPhase,
    caseId: args.caseId,
  });

  if (!pathway) {
    return {
      pathway: null,
      pathwayValid: false,
      pathwayLabel: null,
      headerEyebrow: "Your HairAudit Review",
      headerTitle: args.caseTitle?.trim() || "Untitled case",
      headerDescription: INVALID_PATIENT_REVIEW_PATHWAY_DASHBOARD_ERROR,
      nextAction,
      summaryFields: ["case_reference", "status"],
      sections: new Set<PatientCaseDashboardSectionId>(["header", "next_action"]),
      photoProgress: null,
      questionsComplete: false,
      deliveryPhase,
      requiredPhotoKeys: [],
      planningAssessmentPlaceholder: PRE_SURGERY_PLANNING_PLACEHOLDER,
      reportCardTitle: "Review Report",
      reportCardPendingText: PRE_SURGERY_REPORT_PENDING_TEXT,
      questionnaireLabel: "Questions",
      clinicContributionTitle: "",
      clinicContributionBody: "",
      submitLabel: "Submit review",
      submitResubmitLabel: "Resubmit review",
      submitWhatHappensNext:
        "Once you submit, we will prepare your independent review and notify you when it is ready.",
    };
  }

  const isPre = pathway === "pre_surgery";

  return {
    pathway,
    pathwayValid: true,
    pathwayLabel: PATIENT_PATHWAY_DISPLAY_LABELS[pathway],
    headerEyebrow: "Your HairAudit Review",
    headerTitle: args.caseTitle?.trim() || PATIENT_PATHWAY_DISPLAY_LABELS[pathway],
    headerDescription: isPre
      ? "An independent planning review covering suitability, graft requirements, and treatment options — based on your photos and answers."
      : "Complete your case details and photos so we can prepare your independent review.",
    nextAction,
    summaryFields: isPre ? PRE_SURGERY_SUMMARY_FIELDS : POST_SURGERY_SUMMARY_FIELDS,
    sections: new Set(isPre ? PRE_SURGERY_SECTIONS : POST_SURGERY_SECTIONS),
    photoProgress,
    questionsComplete,
    deliveryPhase,
    requiredPhotoKeys: PATHWAY_EVIDENCE_PACKS[pathway].requiredPhotoKeys,
    planningAssessmentPlaceholder: PRE_SURGERY_PLANNING_PLACEHOLDER,
    reportCardTitle: isPre ? "Pre-Surgery Review Report" : "Latest Report",
    reportCardPendingText: isPre
      ? PRE_SURGERY_REPORT_PENDING_TEXT
      : "Your independent review report will appear here when ready.",
    questionnaireLabel: isPre ? "Pre-Surgery Questions" : "Patient Questions",
    clinicContributionTitle: isPre
      ? "Add a Clinic Quote or Treatment Plan"
      : "Invite Clinic Contribution",
    clinicContributionBody: isPre
      ? "Optionally upload a quote or proposed treatment plan, or invite a clinic to share proposed technique, graft estimate, surgeon, and treatment details. You can skip this section — it does not block submission."
      : "Allow HairAudit to contact your clinic or surgeon to request procedural documentation for a more complete review of your case.",
    submitLabel: isPre ? "Submit Pre-Surgery Review" : "Submit for audit",
    submitResubmitLabel: isPre ? "Resubmit Pre-Surgery Review" : "Resubmit for audit",
    submitWhatHappensNext: isPre
      ? "Once you submit, specialists will prepare your independent planning review. We will notify you by email when your Pre-Surgery Review Report is ready."
      : "Once you submit your case, our system will process your audit. When your report is ready, we'll notify you by email and make it available in your dashboard.",
  };
}

/** True when a rendered HTML/text blob contains forbidden post-surgery chrome for pre_surgery. */
export function preSurgeryDashboardContainsForbiddenChrome(renderedText: string): boolean {
  const lower = renderedText.toLowerCase();
  return PRE_SURGERY_FORBIDDEN_DASHBOARD_STRINGS.some((s) => lower.includes(s.toLowerCase()));
}

export function patientCaseDashboardHasSection(
  model: PatientCaseDashboardViewModel,
  section: PatientCaseDashboardSectionId
): boolean {
  return model.sections.has(section);
}
