-- IIOHR Academy: surgical training tracking (parallel to HairAudit patient audit; no profiles.role changes)
-- Tables MUST be created before helper functions (Postgres validates SQL function bodies at CREATE time).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.academy_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('academy_admin', 'trainer', 'clinic_staff', 'trainee')),
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.training_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.training_doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  country TEXT,
  clinic_name TEXT,
  registration_number TEXT,
  start_date DATE,
  assigned_trainer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  program_id UUID REFERENCES public.training_programs(id) ON DELETE SET NULL,
  current_stage TEXT NOT NULL DEFAULT 'foundation',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'graduated', 'withdrawn')),
  notes TEXT,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_doctors_program_id_idx ON public.training_doctors(program_id);
CREATE INDEX IF NOT EXISTS training_doctors_assigned_trainer_id_idx ON public.training_doctors(assigned_trainer_id);
CREATE INDEX IF NOT EXISTS training_doctors_auth_user_id_idx ON public.training_doctors(auth_user_id);

CREATE TABLE IF NOT EXISTS public.training_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_doctor_id UUID NOT NULL REFERENCES public.training_doctors(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id),
  surgery_date DATE NOT NULL,
  procedure_type TEXT,
  complexity_level TEXT,
  patient_sex TEXT,
  patient_age_band TEXT,
  hair_characteristics_json JSONB NOT NULL DEFAULT '{}',
  donor_characteristics_json JSONB NOT NULL DEFAULT '{}',
  zones_treated_json JSONB NOT NULL DEFAULT '{}',
  trainee_roles_json JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'reviewed', 'archived')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_cases_training_doctor_id_idx ON public.training_cases(training_doctor_id);
CREATE INDEX IF NOT EXISTS training_cases_surgery_date_idx ON public.training_cases(surgery_date DESC);

CREATE TABLE IF NOT EXISTS public.training_case_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_case_id UUID NOT NULL REFERENCES public.training_cases(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN (
    'training_photo:preop_front',
    'training_photo:preop_sides',
    'training_photo:donor_rear',
    'training_photo:intraop_extraction',
    'training_photo:intraop_implantation',
    'training_photo:postop_day0',
    'training_photo:preop_crown',
    'training_photo:hairline_design',
    'training_photo:graft_tray',
    'training_photo:donor_closeup',
    'training_photo:recipient_closeup'
  )),
  storage_path TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_case_uploads_case_id_idx ON public.training_case_uploads(training_case_id);

CREATE TABLE IF NOT EXISTS public.training_case_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_case_id UUID NOT NULL UNIQUE REFERENCES public.training_cases(id) ON DELETE CASCADE,
  grafts_attempted INT,
  grafts_extracted INT,
  grafts_implanted INT,
  extraction_minutes NUMERIC(10,2),
  implantation_minutes NUMERIC(10,2),
  total_minutes NUMERIC(10,2),
  extraction_grafts_per_hour NUMERIC(12,2),
  implantation_grafts_per_hour NUMERIC(12,2),
  transection_rate NUMERIC(6,3),
  buried_graft_rate NUMERIC(6,3),
  popping_rate NUMERIC(6,3),
  out_of_body_time_estimate NUMERIC(10,2),
  punch_size TEXT,
  punch_type TEXT,
  implantation_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.training_case_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_case_id UUID NOT NULL REFERENCES public.training_cases(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id),
  stage_at_assessment TEXT NOT NULL,
  domain_scores_json JSONB NOT NULL DEFAULT '{}',
  strengths TEXT,
  weaknesses TEXT,
  corrective_actions TEXT,
  ready_to_progress BOOLEAN NOT NULL DEFAULT FALSE,
  trainer_confidence INT CHECK (trainer_confidence IS NULL OR (trainer_confidence >= 1 AND trainer_confidence <= 5)),
  overall_score NUMERIC(4,1),
  signed_off_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_case_assessments_case_id_idx ON public.training_case_assessments(training_case_id);

CREATE TABLE IF NOT EXISTS public.training_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_doctor_id UUID NOT NULL REFERENCES public.training_doctors(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS training_stage_history_doctor_id_idx ON public.training_stage_history(training_doctor_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- Helper functions (after tables exist; SECURITY DEFINER bypasses RLS for membership checks)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.academy_has_staff_access(check_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academy_users au
    WHERE au.user_id = check_uid
      AND au.role IN ('academy_admin', 'trainer', 'clinic_staff')
  );
$$;

CREATE OR REPLACE FUNCTION public.academy_can_access_training_doctor(check_uid UUID, p_doctor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.academy_has_staff_access(check_uid)
  OR EXISTS (
    SELECT 1 FROM public.training_doctors td
    WHERE td.id = p_doctor_id AND td.auth_user_id = check_uid
  );
$$;

CREATE OR REPLACE FUNCTION public.academy_can_access_training_case(check_uid UUID, p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.academy_has_staff_access(check_uid)
  OR EXISTS (
    SELECT 1 FROM public.training_cases tc
    JOIN public.training_doctors td ON td.id = tc.training_doctor_id
    WHERE tc.id = p_case_id AND td.auth_user_id = check_uid
  );
$$;

REVOKE ALL ON FUNCTION public.academy_has_staff_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.academy_has_staff_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.academy_has_staff_access(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.academy_can_access_training_doctor(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.academy_can_access_training_doctor(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.academy_can_access_training_doctor(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.academy_can_access_training_case(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.academy_can_access_training_case(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.academy_can_access_training_case(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse set_updated_at if present)
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_academy_users_updated_at ON public.academy_users;
CREATE TRIGGER trg_academy_users_updated_at
  BEFORE UPDATE ON public.academy_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_training_programs_updated_at ON public.training_programs;
CREATE TRIGGER trg_training_programs_updated_at
  BEFORE UPDATE ON public.training_programs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_training_doctors_updated_at ON public.training_doctors;
CREATE TRIGGER trg_training_doctors_updated_at
  BEFORE UPDATE ON public.training_doctors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_training_cases_updated_at ON public.training_cases;
CREATE TRIGGER trg_training_cases_updated_at
  BEFORE UPDATE ON public.training_cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_training_case_metrics_updated_at ON public.training_case_metrics;
CREATE TRIGGER trg_training_case_metrics_updated_at
  BEFORE UPDATE ON public.training_case_metrics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_training_case_assessments_updated_at ON public.training_case_assessments;
CREATE TRIGGER trg_training_case_assessments_updated_at
  BEFORE UPDATE ON public.training_case_assessments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.academy_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_case_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_case_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_case_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_stage_history ENABLE ROW LEVEL SECURITY;

-- academy_users
CREATE POLICY academy_users_select ON public.academy_users
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.academy_has_staff_access(auth.uid())
  );

CREATE POLICY academy_users_insert ON public.academy_users
  FOR INSERT WITH CHECK (
    (SELECT COUNT(*)::int FROM public.academy_users) = 0
    OR EXISTS (
      SELECT 1 FROM public.academy_users au
      WHERE au.user_id = auth.uid() AND au.role = 'academy_admin'
    )
  );

CREATE POLICY academy_users_update ON public.academy_users
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.academy_users au
      WHERE au.user_id = auth.uid() AND au.role = 'academy_admin'
    )
  );

-- training_programs (staff only)
CREATE POLICY training_programs_select ON public.training_programs
  FOR SELECT USING (
    public.academy_has_staff_access(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.training_doctors td
      WHERE td.program_id = training_programs.id AND td.auth_user_id = auth.uid()
    )
  );

CREATE POLICY training_programs_insert ON public.training_programs
  FOR INSERT WITH CHECK (public.academy_has_staff_access(auth.uid()));

CREATE POLICY training_programs_update ON public.training_programs
  FOR UPDATE USING (public.academy_has_staff_access(auth.uid()));

CREATE POLICY training_programs_delete ON public.training_programs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

-- training_doctors
CREATE POLICY training_doctors_select ON public.training_doctors
  FOR SELECT USING (public.academy_can_access_training_doctor(auth.uid(), id));

CREATE POLICY training_doctors_insert ON public.training_doctors
  FOR INSERT WITH CHECK (public.academy_has_staff_access(auth.uid()) AND created_by = auth.uid());

CREATE POLICY training_doctors_update ON public.training_doctors
  FOR UPDATE USING (public.academy_has_staff_access(auth.uid()));

CREATE POLICY training_doctors_delete ON public.training_doctors
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

-- training_cases
CREATE POLICY training_cases_select ON public.training_cases
  FOR SELECT USING (public.academy_can_access_training_case(auth.uid(), id));

CREATE POLICY training_cases_insert ON public.training_cases
  FOR INSERT WITH CHECK (
    public.academy_has_staff_access(auth.uid())
    AND created_by = auth.uid()
    AND public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_cases_update ON public.training_cases
  FOR UPDATE USING (public.academy_has_staff_access(auth.uid()));

CREATE POLICY training_cases_delete ON public.training_cases
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

-- training_case_uploads
CREATE POLICY training_case_uploads_select ON public.training_case_uploads
  FOR SELECT USING (public.academy_can_access_training_case(auth.uid(), training_case_id));

CREATE POLICY training_case_uploads_insert ON public.training_case_uploads
  FOR INSERT WITH CHECK (
    public.academy_can_access_training_case(auth.uid(), training_case_id)
    AND uploaded_by = auth.uid()
  );

CREATE POLICY training_case_uploads_delete ON public.training_case_uploads
  FOR DELETE USING (public.academy_has_staff_access(auth.uid()));

-- training_case_metrics
CREATE POLICY training_case_metrics_select ON public.training_case_metrics
  FOR SELECT USING (public.academy_can_access_training_case(auth.uid(), training_case_id));

CREATE POLICY training_case_metrics_insert ON public.training_case_metrics
  FOR INSERT WITH CHECK (
    public.academy_has_staff_access(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.training_cases tc WHERE tc.id = training_case_id
    )
  );

CREATE POLICY training_case_metrics_update ON public.training_case_metrics
  FOR UPDATE USING (public.academy_has_staff_access(auth.uid()));

CREATE POLICY training_case_metrics_delete ON public.training_case_metrics
  FOR DELETE USING (public.academy_has_staff_access(auth.uid()));

-- training_case_assessments
CREATE POLICY training_case_assessments_select ON public.training_case_assessments
  FOR SELECT USING (public.academy_can_access_training_case(auth.uid(), training_case_id));

CREATE POLICY training_case_assessments_insert ON public.training_case_assessments
  FOR INSERT WITH CHECK (
    public.academy_has_staff_access(auth.uid())
    AND trainer_id = auth.uid()
  );

CREATE POLICY training_case_assessments_update ON public.training_case_assessments
  FOR UPDATE USING (public.academy_has_staff_access(auth.uid()) AND trainer_id = auth.uid());

CREATE POLICY training_case_assessments_delete ON public.training_case_assessments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

-- training_stage_history
CREATE POLICY training_stage_history_select ON public.training_stage_history
  FOR SELECT USING (public.academy_can_access_training_doctor(auth.uid(), training_doctor_id));

CREATE POLICY training_stage_history_insert ON public.training_stage_history
  FOR INSERT WITH CHECK (public.academy_has_staff_access(auth.uid()));

COMMENT ON TABLE public.academy_users IS 'IIOHR academy membership; orthogonal to profiles.role';
COMMENT ON TABLE public.training_cases IS 'FUE training cases; not linked to public patient audit cases table';

-- Default program for bootstrapping UI (optional)
INSERT INTO public.training_programs (id, name, description)
SELECT 'a0000000-0000-4000-8000-000000000001', 'Standard FUE Academy', 'Default IIOHR surgical training program'
WHERE NOT EXISTS (SELECT 1 FROM public.training_programs WHERE id = 'a0000000-0000-4000-8000-000000000001');
