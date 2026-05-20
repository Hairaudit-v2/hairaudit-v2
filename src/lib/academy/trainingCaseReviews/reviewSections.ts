import type { AcademyPhotoCategory } from "../constants";

export type TrainingCaseReviewSectionDef = {
  key: string;
  title: string;
  sortOrder: number;
};

/** Structured developmental feedback categories for faculty review. */
export const TRAINING_CASE_REVIEW_SECTIONS: TrainingCaseReviewSectionDef[] = [
  { key: "case_preparation", title: "Case preparation and planning", sortOrder: 0 },
  { key: "donor_management", title: "Donor area management", sortOrder: 1 },
  { key: "extraction_pattern", title: "Extraction pattern and donor spread", sortOrder: 2 },
  { key: "graft_quality", title: "Graft quality / visible transection concerns", sortOrder: 3 },
  { key: "graft_handling", title: "Graft handling and hydration", sortOrder: 4 },
  { key: "recipient_design", title: "Recipient site design", sortOrder: 5 },
  { key: "hairline_design", title: "Hairline design and naturalness", sortOrder: 6 },
  { key: "direction_angle", title: "Direction, angle, and distribution", sortOrder: 7 },
  { key: "density_planning", title: "Density planning", sortOrder: 8 },
  { key: "implantation_quality", title: "Implantation quality", sortOrder: 9 },
  { key: "bleeding_trauma", title: "Bleeding, trauma, or tissue handling", sortOrder: 10 },
  { key: "postop_presentation", title: "Post-operative presentation", sortOrder: 11 },
  { key: "communication_docs", title: "Communication and documentation", sortOrder: 12 },
  { key: "overall_learning", title: "Overall learning points", sortOrder: 13 },
  { key: "next_focus", title: "Recommended next focus area", sortOrder: 14 },
];

export type ReviewImageCategoryDef = {
  key: string;
  title: string;
  /** Existing upload category when images are linked from training_case_uploads */
  linkedUploadCategory?: AcademyPhotoCategory;
  sortOrder: number;
};

/**
 * Image review slots — maps to existing upload categories where possible.
 * Follow-up categories are review-only labels (may not have uploads yet).
 */
export const REVIEW_IMAGE_CATEGORIES: ReviewImageCategoryDef[] = [
  { key: "preop_front", title: "Pre-operative front", linkedUploadCategory: "preop_front", sortOrder: 0 },
  { key: "preop_temples", title: "Pre-operative temples", linkedUploadCategory: "preop_sides", sortOrder: 1 },
  { key: "preop_crown", title: "Pre-operative crown", linkedUploadCategory: "preop_crown", sortOrder: 2 },
  { key: "donor_before", title: "Donor before extraction", linkedUploadCategory: "donor_rear", sortOrder: 3 },
  { key: "donor_after", title: "Donor after extraction", linkedUploadCategory: "donor_closeup", sortOrder: 4 },
  { key: "grafts_tray", title: "Grafts on gauze / Petri dish", linkedUploadCategory: "graft_tray", sortOrder: 5 },
  { key: "recipient_sites", title: "Recipient site creation", linkedUploadCategory: "intraop_implantation", sortOrder: 6 },
  { key: "postop_front", title: "Immediate post-op front", linkedUploadCategory: "postop_day0", sortOrder: 7 },
  { key: "postop_temples", title: "Immediate post-op temples", linkedUploadCategory: "postop_day0", sortOrder: 8 },
  { key: "postop_crown", title: "Immediate post-op crown", linkedUploadCategory: "postop_day0", sortOrder: 9 },
  { key: "postop_donor", title: "Immediate post-op donor", linkedUploadCategory: "donor_rear", sortOrder: 10 },
  { key: "followup_7d", title: "7-day follow-up", sortOrder: 11 },
  { key: "followup_14d", title: "14-day follow-up", sortOrder: 12 },
  { key: "followup_growth", title: "Growth follow-up", sortOrder: 13 },
];

export function defaultSectionRows(reviewId: string) {
  return TRAINING_CASE_REVIEW_SECTIONS.map((s) => ({
    review_id: reviewId,
    section_key: s.key,
    section_title: s.title,
    sort_order: s.sortOrder,
    developmental_level: null,
    what_went_well: null,
    needs_improvement: null,
    clinical_importance: null,
    next_case_focus: null,
    faculty_note: null,
  }));
}
