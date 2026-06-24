import type { PreSurgeryReportHtmlLabels } from "./PreSurgeryPlanningReportHtml";
import type { ClinicalEvidenceGalleryLabels } from "./clinicalEvidenceGallery";

/** Default English labels for pre-surgery PDF when i18n server context is unavailable. */
export function buildPreSurgeryReportHtmlLabelsEn(planningOutcome: string): PreSurgeryReportHtmlLabels {
  return {
    pdfTitle: "Independent Pre-Surgery Planning Report",
    heroTitle: "Your Pre-Surgery Review is Complete",
    heroSubtitle:
      "We have independently reviewed your hair pattern, donor area, restoration suitability, and long-term treatment considerations. This report is designed to help you make a more informed decision before pursuing treatment.",
    outcomeLabel: "Primary planning outcome",
    planningOutcome,
    scorecardsTitle: "Planning assessment scorecards",
    scorecardsSubtitle: "Key metrics from your independent pre-surgery planning review.",
    scorecardLabels: {
      hair_loss_progression_risk: "Hair Loss Progression Risk",
      donor_area_strength: "Donor Area Strength",
      restoration_suitability: "Restoration Suitability",
      estimated_graft_requirement: "Estimated Graft Requirement",
      long_term_preservation_score: "Long-Term Preservation Score",
      treatment_stabilisation_priority: "Treatment Stabilisation Priority",
    },
    sectionTitles: {
      overall_planning: "Overall Planning Assessment",
      hair_loss_pattern: "Hair Loss Pattern Review",
      donor_area: "Donor Area Review",
      estimated_graft_requirement: "Estimated Graft Requirement",
      surgical_suitability: "Surgical Suitability Review",
      future_progression: "Future Hair Loss and Preservation Planning",
      medical_treatment: "Medical Treatment Considerations",
    },
    sectionsTitle: "Independent planning sections",
    imagesTitle: "Clinical Evidence Reviewed",
    imageViews: {
      front: "Front Hairline View",
      crown: "Crown / Top View",
      donor: "Donor View",
    },
    noPhoto: "Photo not available in this export",
    trustTitle: "Independent Review Completed",
    trustBody:
      "This assessment was generated through an independent review process designed to help patients understand their hair restoration options before making treatment decisions.",
    trustNeutrality:
      "This report is not a clinic sales recommendation. It is intended to support informed decision-making.",
    nextStepsTitle: "Recommended Next Steps",
    nextStepsSubtitle: "Practical actions to help you feel protected before committing financially.",
    reportIdLabel: "Report ID",
    generatedAtLabel: "Generated",
    privacyStatement:
      "This report is based on uploaded images and questionnaire answers only. It is an independent planning review, not a final diagnosis or surgical plan. Image quality may limit interpretation.",
    footerLine:
      "HairAudit — Independent pre-surgery planning review. Discuss all treatment decisions with a qualified medical professional.",
  };
}

export function buildPreSurgeryClinicalEvidenceGalleryLabelsEn(): ClinicalEvidenceGalleryLabels {
  return {
    title: "Clinical Evidence Reviewed",
    subtitle:
      "The following submitted images were processed and reviewed as part of your independent procedural assessment. This assessment incorporates all uploaded visual evidence used during procedural analysis.",
    evidenceProcessedPrefix: "Evidence Processed",
    evidenceProcessedSuffix: "clinical images reviewed during analysis.",
    evidenceIncorporated: "This independent assessment incorporates all submitted visual evidence.",
    additionalReviewed: "+{count} additional images were reviewed as part of this assessment.",
    pdfOmissionNotice:
      "Additional images were processed during analysis but omitted from PDF for layout optimisation.",
    fallbackImageLabel: "Additional Clinical Image",
    noPhoto: "Photo not available in this export",
  };
}

/** Outcome label map for PDF (English). */
export const PRE_SURGERY_OUTCOME_LABELS_EN: Record<string, string> = {
  strong_surgical_candidate: "STRONG SURGICAL CANDIDATE",
  suitable_with_long_term_planning: "SUITABLE WITH LONG-TERM PLANNING",
  medical_stabilisation_recommended_first: "MEDICAL STABILISATION RECOMMENDED FIRST",
  donor_limitations_identified: "DONOR LIMITATIONS IDENTIFIED",
  further_professional_review_recommended: "FURTHER PROFESSIONAL REVIEW RECOMMENDED",
};
