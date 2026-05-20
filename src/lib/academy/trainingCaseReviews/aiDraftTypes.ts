import type { TrainingCaseReviewSectionInput } from "./types";

export const AI_REVIEW_IMAGE_LIMITATION_COPY =
  "AI observations are based only on the uploaded images and case data. Faculty review is required before any feedback is released to the trainee.";

export type TrainingCaseAiReviewDraftStatus = "draft" | "completed" | "failed";

export type AiReviewConfidence = "low" | "medium" | "high";

export type AiReviewSectionSuggestion = {
  sectionKey: string;
  whatWentWell?: string | null;
  needsImprovement?: string | null;
  clinicalImportance?: string | null;
  nextCaseFocus?: string | null;
  confidence?: AiReviewConfidence | null;
  imageLimitations?: string | null;
};

export type TrainingCaseAiReviewStructuredFeedback = {
  overallSummary?: string | null;
  imageQualityNotes?: string[] | null;
  missingCategories?: string[] | null;
  strengths?: string[] | null;
  improvementAreas?: string[] | null;
  suggestedNextFocus?: string | null;
  sectionSuggestions?: AiReviewSectionSuggestion[] | null;
  safetyNotes?: string[] | null;
  /** True when AI provider was not configured — placeholder only */
  placeholder?: boolean;
  /** Present when server-side validation failed (staff troubleshooting) */
  validationErrors?: string[] | null;
};

export type GenerateTrainingCaseAiReviewDraftResult = {
  draft: TrainingCaseAiReviewDraftRow;
  staffMessage: string;
};

export type TrainingCaseAiReviewDraftRow = {
  id: string;
  training_case_id: string;
  training_case_review_id: string | null;
  requested_by: string;
  ai_model: string | null;
  status: TrainingCaseAiReviewDraftStatus;
  image_count: number;
  missing_categories: string[] | null;
  overall_summary: string | null;
  strengths: string[] | null;
  improvement_areas: string[] | null;
  suggested_next_focus: string | null;
  structured_feedback: TrainingCaseAiReviewStructuredFeedback | null;
  safety_notes: string[] | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type MappedAiSectionSuggestion = {
  sectionKey: string;
  sectionTitle: string;
  suggestion: AiReviewSectionSuggestion;
  /** Pre-filled section fields faculty can accept */
  sectionInput: Partial<TrainingCaseReviewSectionInput>;
};
