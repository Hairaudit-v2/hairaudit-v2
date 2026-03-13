-- Clinic Intelligence Portal foundation:
-- - Re-enable clinic/doctor roles in profiles
-- - Add future-safe clinic portal profile/capability/workspace schema
-- - Add visibility and submission-channel controls on cases

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'doctor', 'clinic', 'auditor'));

CREATE OR REPLACE FUNCTION public.handle_beta_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_role TEXT;
BEGIN
  resolved_role := CASE
    WHEN NEW.email = 'auditor@hairaudit.com' THEN 'auditor'
    WHEN LOWER(COALESCE(NEW.raw_user_meta_data->>'role', '')) IN ('patient', 'doctor', 'clinic', 'auditor')
      THEN LOWER(NEW.raw_user_meta_data->>'role')
    ELSE 'patient'
  END;

  INSERT INTO public.profiles (id, email, name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), ''),
    resolved_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    role = CASE
      WHEN public.profiles.role IN ('auditor', 'clinic', 'doctor') THEN public.profiles.role
      WHEN EXCLUDED.role = 'auditor' THEN 'auditor'
      ELSE EXCLUDED.role
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS visibility_scope TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility_scope IN ('public', 'internal')),
  ADD COLUMN IF NOT EXISTS submission_channel TEXT NOT NULL DEFAULT 'patient_submitted'
    CHECK (submission_channel IN ('patient_submitted', 'clinic_submitted', 'doctor_submitted', 'imported')),
  ADD COLUMN IF NOT EXISTS clinic_submission_notes TEXT;

CREATE TABLE IF NOT EXISTS clinic_portal_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_profile_id UUID NOT NULL UNIQUE REFERENCES clinic_profiles(id) ON DELETE CASCADE,
  onboarding_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN ('not_started', 'in_progress', 'complete')),
  onboarding_current_step TEXT NOT NULL DEFAULT 'foundation',
  onboarding_completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  onboarding_completed_at TIMESTAMPTZ,
  portal_mode TEXT NOT NULL DEFAULT 'hairaudit_public'
    CHECK (portal_mode IN (
      'hairaudit_public',
      'clinic_internal',
      'training',
      'doctor_benchmarking',
      'clinic_benchmarking',
      'follicle_whitelabel'
    )),
  basic_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  advanced_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  training_readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  internal_qa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  doctor_benchmarking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  clinic_benchmarking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  white_label_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinic_capability_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_profile_id UUID NOT NULL REFERENCES clinic_profiles(id) ON DELETE CASCADE,
  capability_type TEXT NOT NULL
    CHECK (capability_type IN ('method', 'tool', 'device', 'machine', 'optional_extra', 'protocol')),
  capability_name TEXT NOT NULL,
  capability_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_capability_unique_name
  ON clinic_capability_catalog (clinic_profile_id, capability_type, lower(capability_name));

CREATE INDEX IF NOT EXISTS idx_clinic_capability_profile
  ON clinic_capability_catalog (clinic_profile_id, capability_type, is_active);

CREATE TABLE IF NOT EXISTS clinic_case_workspaces (
  case_id UUID PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  clinic_profile_id UUID NOT NULL REFERENCES clinic_profiles(id) ON DELETE CASCADE,
  submission_channel TEXT NOT NULL DEFAULT 'patient_submitted'
    CHECK (submission_channel IN ('patient_submitted', 'clinic_submitted', 'doctor_submitted', 'imported')),
  visibility_scope TEXT NOT NULL DEFAULT 'internal'
    CHECK (visibility_scope IN ('public', 'internal')),
  clinic_response_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (clinic_response_status IN ('not_requested', 'pending_response', 'responded')),
  clinic_response_summary TEXT,
  clinic_response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  responded_at TIMESTAMPTZ,
  training_flag BOOLEAN NOT NULL DEFAULT FALSE,
  benchmark_include BOOLEAN NOT NULL DEFAULT TRUE,
  white_label_scope TEXT NOT NULL DEFAULT 'hairaudit'
    CHECK (white_label_scope IN ('hairaudit', 'follicle_intelligence', 'custom')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_case_workspace_profile
  ON clinic_case_workspaces (clinic_profile_id, clinic_response_status, visibility_scope);

CREATE INDEX IF NOT EXISTS idx_clinic_case_workspace_training
  ON clinic_case_workspaces (training_flag, benchmark_include);

ALTER TABLE clinic_portal_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_capability_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_case_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_portal_profiles_select_owner" ON clinic_portal_profiles;
CREATE POLICY "clinic_portal_profiles_select_owner" ON clinic_portal_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM clinic_profiles cp
      WHERE cp.id = clinic_portal_profiles.clinic_profile_id
        AND cp.linked_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "clinic_capability_catalog_select_owner" ON clinic_capability_catalog;
CREATE POLICY "clinic_capability_catalog_select_owner" ON clinic_capability_catalog
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM clinic_profiles cp
      WHERE cp.id = clinic_capability_catalog.clinic_profile_id
        AND cp.linked_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "clinic_case_workspaces_select_members" ON clinic_case_workspaces;
CREATE POLICY "clinic_case_workspaces_select_members" ON clinic_case_workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM cases c
      WHERE c.id = clinic_case_workspaces.case_id
        AND (
          c.user_id = auth.uid()
          OR c.patient_id = auth.uid()
          OR c.doctor_id = auth.uid()
          OR c.clinic_id = auth.uid()
        )
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_clinic_portal_profiles_updated_at ON clinic_portal_profiles;
    CREATE TRIGGER trg_clinic_portal_profiles_updated_at
      BEFORE UPDATE ON clinic_portal_profiles
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();

    DROP TRIGGER IF EXISTS trg_clinic_capability_catalog_updated_at ON clinic_capability_catalog;
    CREATE TRIGGER trg_clinic_capability_catalog_updated_at
      BEFORE UPDATE ON clinic_capability_catalog
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();

    DROP TRIGGER IF EXISTS trg_clinic_case_workspaces_updated_at ON clinic_case_workspaces;
    CREATE TRIGGER trg_clinic_case_workspaces_updated_at
      BEFORE UPDATE ON clinic_case_workspaces
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END
$$;
