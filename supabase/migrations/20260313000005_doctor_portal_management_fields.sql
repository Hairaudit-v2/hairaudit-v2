-- Doctor management extensions for Clinic Intelligence Portal
-- Adds public/professional + internal governance fields on doctor_profiles

ALTER TABLE doctor_profiles
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS professional_title TEXT,
  ADD COLUMN IF NOT EXISTS short_bio TEXT,
  ADD COLUMN IF NOT EXISTS specialties JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS years_experience INT,
  ADD COLUMN IF NOT EXISTS public_summary TEXT,
  ADD COLUMN IF NOT EXISTS associated_branches JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clinic_role TEXT NOT NULL DEFAULT 'doctor'
    CHECK (clinic_role IN ('owner', 'admin', 'lead_surgeon', 'surgeon', 'assistant', 'coordinator', 'other')),
  ADD COLUMN IF NOT EXISTS case_permissions JSONB NOT NULL DEFAULT '{"can_assign_cases": true, "can_edit_case_details": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS can_respond_audits BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_submit_cases BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_internal_cases BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_clinic_active
  ON doctor_profiles(clinic_profile_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_archived_at
  ON doctor_profiles(archived_at);
