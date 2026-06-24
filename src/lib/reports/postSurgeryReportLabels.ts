import type { PostSurgeryReportHtmlLabels } from "./PostSurgeryAuditReportHtml";

/** Default English labels for post-surgery PDF when i18n server context is unavailable. */
export function buildPostSurgeryReportHtmlLabelsEn(
  proceduralOutcome: string,
  repairState: string
): PostSurgeryReportHtmlLabels {
  return {
    heroTitle: "Your Post-Surgery Audit is Complete",
    heroSubtitle:
      "We have independently reviewed your transplant result, donor condition, density patterns, procedural integrity, and long-term restoration concerns. This review is designed to help you objectively understand your surgical outcome.",
    outcomeLabel: "Primary procedural outcome",
    proceduralOutcome,
    scorecardsTitle: "Procedural assessment scores",
    scorecardsSubtitle: "Key metrics from your independent procedural review.",
    scorecardLabels: {
      donor_preservation: "Donor Preservation Score",
      extraction_pattern: "Extraction Pattern Quality",
      density_distribution: "Density Distribution Score",
      recipient_area: "Recipient Area Assessment",
      healing_quality: "Healing Quality Assessment",
      repair_probability: "Repair Probability",
    },
    sectionTitles: {
      overall_procedure: "Overall Procedure Assessment",
      donor_area: "Donor Area Review",
      extraction_pattern: "Extraction Pattern Analysis",
      density_distribution: "Density Distribution Review",
      recipient_area: "Recipient Area Assessment",
      procedural_integrity: "Procedural Integrity Review",
      long_term_risk: "Long-Term Risk Assessment",
      repair_considerations: "Repair Considerations",
    },
    sectionsTitle: "Independent review sections",
    concernsTitle: "Potential Concerns Identified",
    concernsSubtitle:
      "Objective observations based on your uploaded images. These are not a diagnosis — discuss them with your treating team.",
    concernSeverity: {
      low: "Low concern",
      moderate: "Moderate concern",
      elevated: "Elevated concern",
      significant: "Significant concern",
    },
    imagesTitle: "Your uploaded images",
    imageViews: {
      front: "Front View",
      donor: "Donor View",
    },
    noPhoto: "Photo not available in this export",
    photoEmbedFailed: "Image was reviewed but could not be embedded in this PDF export.",
    imageLimitedTitle: "Enhanced image-limited review",
    knownClinicalContextTitle: "Known Clinical Context Provided",
    postOperativeTitle: "Post-Operative Guidance & Next Steps",
    postOperativeSubtitle:
      "General information to support your recovery and follow-up — not a diagnosis or treatment plan.",
    repairPlanningTitle: "Repair / Refinement Considerations",
    repairPlanningSubtitle:
      "Factors to discuss with a qualified clinician if you are considering further refinement or repair.",
    trustTitle: "Independent Review Completed",
    trustBody:
      "This assessment was generated using an independent review system designed to evaluate procedural quality objectively and separately from clinic recommendations.",
    trustNeutrality:
      "This report is not influenced by the clinic that performed your surgery.",
    nextStepsTitle: "Recommended Next Steps",
    nextStepsSubtitle: "Practical actions based on this independent review.",
    repairLabel: "Repair consideration",
    repairState,
    reportIdLabel: "Report ID",
    generatedAtLabel: "Generated",
    privacyStatement:
      "This report is based on uploaded images and questionnaire answers only. It is not a medical diagnosis. Image quality may limit interpretation.",
    footerLine: "HairAudit — Independent procedural review. Your treating clinician remains responsible for diagnosis and treatment.",
  };
}

/** Outcome label map for PDF (English). */
export const POST_SURGERY_OUTCOME_LABELS_EN: Record<string, string> = {
  strong_outcome: "STRONG PROCEDURAL OUTCOME DETECTED",
  moderate_concerns: "MODERATE PROCEDURAL CONCERNS IDENTIFIED",
  donor_preservation_concerns: "SIGNIFICANT DONOR PRESERVATION CONCERNS DETECTED",
  significant_concerns: "SIGNIFICANT PROCEDURAL CONCERNS IDENTIFIED",
};

export const POST_SURGERY_REPAIR_LABELS_EN: Record<string, string> = {
  no_repair_concerns: "No repair concerns identified",
  minor_observation: "Minor concerns requiring observation",
  moderate_consultation: "Moderate repair consultation recommended",
  significant_planning: "Significant repair planning may be beneficial",
};
