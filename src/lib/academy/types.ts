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
  assigned_trainer_id: string | null;
  program_id: string | null;
  current_stage: string;
  status: string;
  notes: string | null;
  auth_user_id: string | null;
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
  extraction_minutes: number | null;
  implantation_minutes: number | null;
  total_minutes: number | null;
  extraction_grafts_per_hour: number | null;
  implantation_grafts_per_hour: number | null;
  transection_rate: number | null;
  buried_graft_rate: number | null;
  popping_rate: number | null;
  out_of_body_time_estimate: number | null;
  punch_size: string | null;
  punch_type: string | null;
  implantation_method: string | null;
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
