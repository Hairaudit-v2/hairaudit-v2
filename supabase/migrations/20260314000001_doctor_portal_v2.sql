-- Doctor portal v2 schema for defaults, overrides, resolved snapshots, and visibility lifecycle.
-- Goal: defaults are reusable, case settings are immutable after submission lock, and analytics remain queryable.

DO $$
BEGIN
  CREATE TYPE doctor_case_status AS ENUM ('draft', 'submitted', 'in_review', 'needs_input', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE doctor_case_visibility_intent AS ENUM ('internal_only', 'internal_now_public_later', 'public_if_approved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE doctor_report_visibility_state AS ENUM ('INTERNAL', 'PUBLIC_PENDING_REVIEW', 'PUBLIC_APPROVED', 'PUBLIC_LIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE doctor_training_enrollment_status AS ENUM ('not_started', 'in_progress', 'completed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE doctor_profiles
  ADD COLUMN IF NOT EXISTS public_display_name TEXT,
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS procedures_offered JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS searchable_specialties JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS public_profile_visibility BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_profile_readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS doctor_default_surgical_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_profile_id UUID REFERENCES doctor_profiles(id) ON DELETE SET NULL,
  profile_version INT NOT NULL DEFAULT 1,
  extraction_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  graft_holding_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  implantation_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  adjunct_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  postop_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  copy_to_future_uploads BOOLEAN NOT NULL DEFAULT TRUE,
  last_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_default_surgical_profiles_profile
  ON doctor_default_surgical_profiles(doctor_profile_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS doctor_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_profile_id UUID REFERENCES doctor_profiles(id) ON DELETE SET NULL,
  clinic_profile_id UUID REFERENCES clinic_profiles(id) ON DELETE SET NULL,
  source_case_id UUID REFERENCES doctor_cases(id) ON DELETE SET NULL,
  patient_reference TEXT NOT NULL,
  surgery_date DATE,
  clinic_location TEXT,
  case_category TEXT,
  case_subtypes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status doctor_case_status NOT NULL DEFAULT 'draft',
  visibility_intent doctor_case_visibility_intent NOT NULL DEFAULT 'internal_now_public_later',
  submitted_at TIMESTAMPTZ,
  settings_locked_at TIMESTAMPTZ,
  score NUMERIC(5,2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_cases_doctor_created
  ON doctor_cases(doctor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_status
  ON doctor_cases(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_visibility_intent
  ON doctor_cases(visibility_intent, created_at DESC);

CREATE TABLE IF NOT EXISTS doctor_case_surgical_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_case_id UUID UNIQUE NOT NULL REFERENCES doctor_cases(id) ON DELETE CASCADE,
  override_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  advanced_override_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctor_case_resolved_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_case_id UUID UNIQUE NOT NULL REFERENCES doctor_cases(id) ON DELETE CASCADE,
  doctor_default_profile_id UUID REFERENCES doctor_default_surgical_profiles(id) ON DELETE SET NULL,
  defaults_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  overrides_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  defaults_version_used INT NOT NULL DEFAULT 1,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_doctor_case_resolved_settings_locked
  ON doctor_case_resolved_settings(is_locked, resolved_at DESC);

CREATE TABLE IF NOT EXISTS doctor_case_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_case_id UUID NOT NULL REFERENCES doctor_cases(id) ON DELETE CASCADE,
  upload_category TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  bytes INT,
  width INT,
  height INT,
  upload_state TEXT NOT NULL DEFAULT 'uploaded' CHECK (upload_state IN ('uploaded', 'processing', 'ready', 'failed')),
  quality_prompt_level TEXT NOT NULL DEFAULT 'none' CHECK (quality_prompt_level IN ('none', 'recommended', 'required')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_case_uploads_case_category
  ON doctor_case_uploads(doctor_case_id, upload_category);

CREATE TABLE IF NOT EXISTS doctor_report_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_case_id UUID UNIQUE NOT NULL REFERENCES doctor_cases(id) ON DELETE CASCADE,
  visibility_state doctor_report_visibility_state NOT NULL DEFAULT 'INTERNAL',
  requested_public_at TIMESTAMPTZ,
  approved_public_at TIMESTAMPTZ,
  published_live_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_report_visibility_state
  ON doctor_report_visibility(visibility_state, updated_at DESC);

CREATE TABLE IF NOT EXISTS doctor_training_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_profile_id UUID REFERENCES doctor_profiles(id) ON DELETE SET NULL,
  module_key TEXT NOT NULL,
  enrollment_status doctor_training_enrollment_status NOT NULL DEFAULT 'not_started',
  payment_state TEXT NOT NULL DEFAULT 'placeholder' CHECK (payment_state IN ('placeholder', 'pending', 'paid', 'waived')),
  unlocked_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_user_id, module_key)
);

CREATE TABLE IF NOT EXISTS doctor_surgical_option_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group TEXT NOT NULL,
  option_value TEXT NOT NULL,
  option_label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(option_group, option_value)
);

INSERT INTO doctor_surgical_option_catalog (option_group, option_value, option_label, sort_order)
VALUES
  ('extraction_method', 'FUE', 'FUE', 10),
  ('extraction_method', 'DHI', 'DHI', 20),
  ('extraction_method', 'FUT', 'FUT', 30),
  ('holding_solution', 'HYPOTHERMOSOL', 'HypoThermosol', 10),
  ('holding_solution', 'SALINE', 'Saline', 20),
  ('holding_solution', 'LR', 'Lactated Ringer''s', 30),
  ('implantation_technique', 'DHI_ASSISTED', 'DHI-assisted', 10),
  ('implantation_technique', 'FORCEPS', 'Forceps placement', 20),
  ('workflow_model', 'PARALLEL_LANES', 'Parallel extraction + implantation lanes', 10),
  ('workflow_model', 'SEQUENTIAL', 'Sequential workflow', 20)
ON CONFLICT (option_group, option_value) DO NOTHING;

CREATE OR REPLACE FUNCTION set_doctor_portal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doctor_defaults_updated_at ON doctor_default_surgical_profiles;
CREATE TRIGGER trg_doctor_defaults_updated_at
BEFORE UPDATE ON doctor_default_surgical_profiles
FOR EACH ROW EXECUTE FUNCTION set_doctor_portal_updated_at();

DROP TRIGGER IF EXISTS trg_doctor_cases_updated_at ON doctor_cases;
CREATE TRIGGER trg_doctor_cases_updated_at
BEFORE UPDATE ON doctor_cases
FOR EACH ROW EXECUTE FUNCTION set_doctor_portal_updated_at();

DROP TRIGGER IF EXISTS trg_doctor_case_overrides_updated_at ON doctor_case_surgical_overrides;
CREATE TRIGGER trg_doctor_case_overrides_updated_at
BEFORE UPDATE ON doctor_case_surgical_overrides
FOR EACH ROW EXECUTE FUNCTION set_doctor_portal_updated_at();

DROP TRIGGER IF EXISTS trg_doctor_report_visibility_updated_at ON doctor_report_visibility;
CREATE TRIGGER trg_doctor_report_visibility_updated_at
BEFORE UPDATE ON doctor_report_visibility
FOR EACH ROW EXECUTE FUNCTION set_doctor_portal_updated_at();

DROP TRIGGER IF EXISTS trg_doctor_training_enrollments_updated_at ON doctor_training_enrollments;
CREATE TRIGGER trg_doctor_training_enrollments_updated_at
BEFORE UPDATE ON doctor_training_enrollments
FOR EACH ROW EXECUTE FUNCTION set_doctor_portal_updated_at();

CREATE OR REPLACE FUNCTION doctor_upsert_resolved_settings(p_case_id UUID)
RETURNS VOID AS $$
DECLARE
  v_case doctor_cases%ROWTYPE;
  v_defaults doctor_default_surgical_profiles%ROWTYPE;
  v_overrides doctor_case_surgical_overrides%ROWTYPE;
  v_defaults_payload JSONB;
  v_overrides_payload JSONB;
  v_resolved_payload JSONB;
BEGIN
  SELECT * INTO v_case FROM doctor_cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN
    RETURN;
  END IF;

  -- Preserve immutability once locked.
  IF v_case.settings_locked_at IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_defaults
  FROM doctor_default_surgical_profiles
  WHERE doctor_user_id = v_case.doctor_user_id
  LIMIT 1;

  SELECT * INTO v_overrides
  FROM doctor_case_surgical_overrides
  WHERE doctor_case_id = v_case.id
  LIMIT 1;

  v_defaults_payload := jsonb_build_object(
    'extraction', COALESCE(v_defaults.extraction_defaults, '{}'::jsonb),
    'graftHolding', COALESCE(v_defaults.graft_holding_defaults, '{}'::jsonb),
    'implantation', COALESCE(v_defaults.implantation_defaults, '{}'::jsonb),
    'adjuncts', COALESCE(v_defaults.adjunct_defaults, '{}'::jsonb),
    'workflow', COALESCE(v_defaults.workflow_defaults, '{}'::jsonb),
    'postOp', COALESCE(v_defaults.postop_defaults, '{}'::jsonb)
  );

  v_overrides_payload := COALESCE(v_overrides.override_payload, '{}'::jsonb) || COALESCE(v_overrides.advanced_override_payload, '{}'::jsonb);
  v_resolved_payload := COALESCE(v_defaults_payload, '{}'::jsonb) || COALESCE(v_overrides_payload, '{}'::jsonb);

  INSERT INTO doctor_case_resolved_settings (
    doctor_case_id,
    doctor_default_profile_id,
    defaults_snapshot,
    overrides_snapshot,
    resolved_settings,
    defaults_version_used,
    resolved_at,
    is_locked
  )
  VALUES (
    v_case.id,
    v_defaults.id,
    v_defaults_payload,
    v_overrides_payload,
    v_resolved_payload,
    COALESCE(v_defaults.profile_version, 1),
    NOW(),
    FALSE
  )
  ON CONFLICT (doctor_case_id) DO UPDATE SET
    doctor_default_profile_id = EXCLUDED.doctor_default_profile_id,
    defaults_snapshot = EXCLUDED.defaults_snapshot,
    overrides_snapshot = EXCLUDED.overrides_snapshot,
    resolved_settings = EXCLUDED.resolved_settings,
    defaults_version_used = EXCLUDED.defaults_version_used,
    resolved_at = NOW(),
    is_locked = FALSE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION doctor_lock_resolved_settings()
RETURNS TRIGGER AS $$
DECLARE
  v_existing doctor_case_resolved_settings%ROWTYPE;
BEGIN
  IF NEW.submitted_at IS NOT NULL AND OLD.submitted_at IS NULL THEN
    IF NEW.settings_locked_at IS NULL THEN
      NEW.settings_locked_at = NOW();
    END IF;

    PERFORM doctor_upsert_resolved_settings(NEW.id);
    SELECT * INTO v_existing FROM doctor_case_resolved_settings WHERE doctor_case_id = NEW.id;

    IF v_existing.id IS NOT NULL THEN
      UPDATE doctor_case_resolved_settings
      SET is_locked = TRUE, resolved_at = NOW()
      WHERE doctor_case_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION doctor_resolve_settings_on_case_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM doctor_upsert_resolved_settings(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION doctor_resolve_settings_on_override_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM doctor_upsert_resolved_settings(NEW.doctor_case_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION doctor_block_override_mutation_when_locked()
RETURNS TRIGGER AS $$
DECLARE
  v_case doctor_cases%ROWTYPE;
  v_case_id UUID;
BEGIN
  v_case_id := COALESCE(NEW.doctor_case_id, OLD.doctor_case_id);
  SELECT * INTO v_case FROM doctor_cases WHERE id = v_case_id;
  IF v_case.settings_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Overrides cannot be changed after submission lock for case %', v_case_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION doctor_increment_default_profile_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_version = COALESCE(OLD.profile_version, 1) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doctor_case_resolve_on_insert ON doctor_cases;
CREATE TRIGGER trg_doctor_case_resolve_on_insert
AFTER INSERT ON doctor_cases
FOR EACH ROW
EXECUTE FUNCTION doctor_resolve_settings_on_case_change();

DROP TRIGGER IF EXISTS trg_doctor_case_resolve_on_update ON doctor_cases;
CREATE TRIGGER trg_doctor_case_resolve_on_update
AFTER UPDATE OF doctor_user_id, metadata, visibility_intent, status ON doctor_cases
FOR EACH ROW
WHEN (NEW.settings_locked_at IS NULL)
EXECUTE FUNCTION doctor_resolve_settings_on_case_change();

DROP TRIGGER IF EXISTS trg_doctor_case_lock_on_submit ON doctor_cases;
CREATE TRIGGER trg_doctor_case_lock_on_submit
BEFORE UPDATE OF submitted_at ON doctor_cases
FOR EACH ROW
EXECUTE FUNCTION doctor_lock_resolved_settings();

DROP TRIGGER IF EXISTS trg_doctor_override_resolve_on_insert ON doctor_case_surgical_overrides;
CREATE TRIGGER trg_doctor_override_resolve_on_insert
AFTER INSERT ON doctor_case_surgical_overrides
FOR EACH ROW
EXECUTE FUNCTION doctor_resolve_settings_on_override_change();

DROP TRIGGER IF EXISTS trg_doctor_override_resolve_on_update ON doctor_case_surgical_overrides;
CREATE TRIGGER trg_doctor_override_resolve_on_update
AFTER UPDATE ON doctor_case_surgical_overrides
FOR EACH ROW
EXECUTE FUNCTION doctor_resolve_settings_on_override_change();

DROP TRIGGER IF EXISTS trg_doctor_override_block_update_when_locked ON doctor_case_surgical_overrides;
CREATE TRIGGER trg_doctor_override_block_update_when_locked
BEFORE UPDATE ON doctor_case_surgical_overrides
FOR EACH ROW
EXECUTE FUNCTION doctor_block_override_mutation_when_locked();

DROP TRIGGER IF EXISTS trg_doctor_override_block_delete_when_locked ON doctor_case_surgical_overrides;
CREATE TRIGGER trg_doctor_override_block_delete_when_locked
BEFORE DELETE ON doctor_case_surgical_overrides
FOR EACH ROW
EXECUTE FUNCTION doctor_block_override_mutation_when_locked();

DROP TRIGGER IF EXISTS trg_doctor_default_profile_version_bump ON doctor_default_surgical_profiles;
CREATE TRIGGER trg_doctor_default_profile_version_bump
BEFORE UPDATE ON doctor_default_surgical_profiles
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION doctor_increment_default_profile_version();

CREATE OR REPLACE FUNCTION doctor_get_resolved_settings_for_audit(p_case_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_resolved JSONB;
BEGIN
  SELECT resolved_settings
  INTO v_resolved
  FROM doctor_case_resolved_settings
  WHERE doctor_case_id = p_case_id
  LIMIT 1;

  RETURN COALESCE(v_resolved, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE VIEW doctor_case_audit_runtime AS
SELECT
  dc.id AS doctor_case_id,
  dc.status,
  dc.submitted_at,
  dc.settings_locked_at,
  dcrs.defaults_version_used,
  dcrs.is_locked,
  dcrs.resolved_at,
  dcrs.resolved_settings
FROM doctor_cases dc
LEFT JOIN doctor_case_resolved_settings dcrs
  ON dcrs.doctor_case_id = dc.id;

-- Keep RLS posture aligned with existing owner-read model.
ALTER TABLE doctor_default_surgical_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_case_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_case_surgical_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_case_resolved_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_report_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_surgical_option_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doctor_defaults_select_owner ON doctor_default_surgical_profiles;
CREATE POLICY doctor_defaults_select_owner ON doctor_default_surgical_profiles
  FOR SELECT USING (doctor_user_id = auth.uid());

DROP POLICY IF EXISTS doctor_cases_select_owner ON doctor_cases;
CREATE POLICY doctor_cases_select_owner ON doctor_cases
  FOR SELECT USING (doctor_user_id = auth.uid());

DROP POLICY IF EXISTS doctor_case_uploads_select_owner ON doctor_case_uploads;
CREATE POLICY doctor_case_uploads_select_owner ON doctor_case_uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM doctor_cases dc
      WHERE dc.id = doctor_case_uploads.doctor_case_id
        AND dc.doctor_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS doctor_case_overrides_select_owner ON doctor_case_surgical_overrides;
CREATE POLICY doctor_case_overrides_select_owner ON doctor_case_surgical_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM doctor_cases dc
      WHERE dc.id = doctor_case_surgical_overrides.doctor_case_id
        AND dc.doctor_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS doctor_case_resolved_select_owner ON doctor_case_resolved_settings;
CREATE POLICY doctor_case_resolved_select_owner ON doctor_case_resolved_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM doctor_cases dc
      WHERE dc.id = doctor_case_resolved_settings.doctor_case_id
        AND dc.doctor_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS doctor_report_visibility_select_owner ON doctor_report_visibility;
CREATE POLICY doctor_report_visibility_select_owner ON doctor_report_visibility
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM doctor_cases dc
      WHERE dc.id = doctor_report_visibility.doctor_case_id
        AND dc.doctor_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS doctor_training_select_owner ON doctor_training_enrollments;
CREATE POLICY doctor_training_select_owner ON doctor_training_enrollments
  FOR SELECT USING (doctor_user_id = auth.uid());

DROP POLICY IF EXISTS doctor_option_catalog_read_all ON doctor_surgical_option_catalog;
CREATE POLICY doctor_option_catalog_read_all ON doctor_surgical_option_catalog
  FOR SELECT USING (TRUE);
