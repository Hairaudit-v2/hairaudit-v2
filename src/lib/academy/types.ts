import type { AcademyUserRole } from "./constants";

export type AcademyUserRow = {
  user_id: string;
  role: AcademyUserRole;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingDoctorRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  clinic_name: string | null;
  registration_number: string | null;
  start_date: string | null;
  academy_site_id: string | null;
  assigned_trainer_id: string | null;
  program_id: string | null;
  current_stage: string;
  status: string;
  notes: string | null;
  auth_user_id: string | null;
  competency_wave_start_date: string | null;
  competency_final_readiness_at: string | null;
  competency_final_readiness_by: string | null;
  competency_final_readiness_status?: string | null;
  competency_final_readiness_notes?: string | null;
  /** Limitations / supervision rules (structured JSON). */
  competency_restrictions_json?: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TrainingCaseRow = {
  id: string;
  training_doctor_id: string;
  trainer_id: string;
  surgery_date: string;
  procedure_type: string | null;
  complexity_level: string | null;
  patient_sex: string | null;
  patient_age_band: string | null;
  hair_characteristics_json: Record<string, unknown>;
  donor_characteristics_json: Record<string, unknown>;
  zones_treated_json: Record<string, unknown>;
  trainee_roles_json: Record<string, unknown>;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TrainingCaseMetricsRow = {
  id: string;
  training_case_id: string;
  grafts_attempted: number | null;
  grafts_extracted: number | null;
  grafts_implanted: number | null;
  extraction_start_time: string | null;
  extraction_end_time: string | null;
  implantation_start_time: string | null;
  implantation_end_time: string | null;
  extraction_minutes: number | null;
  implantation_minutes: number | null;
  total_minutes: number | null;
  extraction_grafts_per_hour: number | null;
  implantation_grafts_per_hour: number | null;
  transection_rate: number | null;
  buried_graft_rate: number | null;
  popping_rate: number | null;
  transected_grafts_count: number | null;
  buried_grafts_count: number | null;
  popped_grafts_count: number | null;
  out_of_body_time_estimate: number | null;
  punch_size: string | null;
  punch_type: string | null;
  implantation_method: string | null;
  total_hairs: number | null;
  hair_to_graft_ratio: number | null;
  observed_by_trainer: boolean;
  created_at: string;
  updated_at: string;
};

export type TrainingCompetencyLadderRow = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type TrainingCompetencyStepRow = {
  id: string;
  ladder_id: string;
  step_index: number;
  label: string;
  short_label: string | null;
  is_target: boolean;
  is_optional: boolean;
  criteria_json: Record<string, unknown>;
  min_signed_observations?: number | null;
  min_distinct_cases?: number | null;
  requires_trainer_observation?: boolean;
  repeatability_rule_json?: Record<string, unknown>;
  created_at: string;
};

export type PerformanceDemonstration = "not_specified" | "single_session_peak" | "repeatable_across_sessions";

export type TrainingCompetencyAchievementRow = {
  id: string;
  training_doctor_id: string;
  step_id: string;
  achieved_at: string;
  signed_off_by: string;
  trainer_comments: string | null;
  evidence_training_case_id: string | null;
  performance_demonstration: PerformanceDemonstration;
  capture_json: Record<string, unknown>;
  single_session_override?: boolean;
  created_at: string;
  updated_at: string;
};

export type TrainingCompetencyStepStateRow = {
  training_doctor_id: string;
  step_id: string;
  status: string;
  achievement_id: string | null;
  trainer_notes: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type TrainingCompetencyStepObservationRow = {
  id: string;
  training_doctor_id: string;
  step_id: string;
  training_case_id: string | null;
  recorded_by: string;
  threshold_met: boolean;
  trainer_observed: boolean;
  checklist_json: Record<string, unknown>;
  notes: string | null;
  created_at: string;
};

export type TrainingCompetencyWeeklyReviewRow = {
  id: string;
  training_doctor_id: string;
  week_number: number;
  review_start_date: string;
  review_end_date: string;
  strengths: string | null;
  focus_areas: string | null;
  risks_or_concerns: string | null;
  recommended_next_targets: string | null;
  reviewed_by: string;
  reviewed_at: string;
  created_at: string;
  updated_at: string;
};

export type TrainingCaseAssessmentRow = {
  id: string;
  training_case_id: string;
  trainer_id: string;
  stage_at_assessment: string;
  domain_scores_json: Record<string, unknown>;
  strengths: string | null;
  weaknesses: string | null;
  corrective_actions: string | null;
  ready_to_progress: boolean;
  trainer_confidence: number | null;
  overall_score: number | null;
  signed_off_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingCaseUploadRow = {
  id: string;
  training_case_id: string;
  uploaded_by: string;
  type: string;
  storage_path: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type TrainingStageHistoryRow = {
  id: string;
  training_doctor_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
  changed_by: string | null;
  reason: string | null;
  metadata_json: Record<string, unknown>;
};
