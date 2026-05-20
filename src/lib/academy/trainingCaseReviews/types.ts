export type TrainingCaseReviewStatus = "draft" | "submitted" | "archived";

export type DevelopmentalLevel =
  | "needs_faculty_support"
  | "developing"
  | "competent_for_stage"
  | "strong"
  | "advanced_trainee";

export type TrainingCaseReviewRow = {
  id: string;
  training_case_id: string | null;
  trainee_id: string;
  reviewer_id: string;
  cohort_id: string | null;
  program_id: string | null;
  review_status: TrainingCaseReviewStatus;
  case_date: string | null;
  case_type: string | null;
  case_difficulty: string | null;
  trainee_stage: string | null;
  overall_level: DevelopmentalLevel | string | null;
  summary: string | null;
  main_strengths: string[] | null;
  improvement_priorities: string[] | null;
  recommended_next_focus: string | null;
  faculty_recommendation: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingCaseReviewSectionRow = {
  id: string;
  review_id: string;
  section_key: string;
  section_title: string;
  developmental_level: DevelopmentalLevel | string | null;
  what_went_well: string | null;
  needs_improvement: string | null;
  clinical_importance: string | null;
  next_case_focus: string | null;
  faculty_note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TrainingCaseReviewImageRow = {
  id: string;
  review_id: string;
  image_id: string | null;
  image_url: string | null;
  image_category: string;
  reviewer_comment: string | null;
  image_quality_level: string | null;
  sort_order: number;
  created_at: string;
};

export type TrainingCaseReviewBundle = {
  review: TrainingCaseReviewRow;
  sections: TrainingCaseReviewSectionRow[];
  images: TrainingCaseReviewImageRow[];
};

export type TrainingCaseReviewSectionInput = {
  section_key: string;
  developmental_level?: DevelopmentalLevel | string | null;
  what_went_well?: string | null;
  needs_improvement?: string | null;
  clinical_importance?: string | null;
  next_case_focus?: string | null;
  faculty_note?: string | null;
};

export type TrainingCaseReviewImageInput = {
  id?: string;
  image_id?: string | null;
  image_category: string;
  reviewer_comment?: string | null;
  image_quality_level?: string | null;
  sort_order?: number;
};

export type TrainingCaseReviewUpsertBody = {
  case_date?: string | null;
  case_type?: string | null;
  case_difficulty?: string | null;
  trainee_stage?: string | null;
  overall_level?: DevelopmentalLevel | string | null;
  summary?: string | null;
  main_strengths?: string[] | null;
  improvement_priorities?: string[] | null;
  recommended_next_focus?: string | null;
  faculty_recommendation?: string | null;
  sections?: TrainingCaseReviewSectionInput[];
  images?: TrainingCaseReviewImageInput[];
};
