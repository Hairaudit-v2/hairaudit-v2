-- Academy admin console: programs.is_active, cohorts, DB-backed training modules + assignments.

-- ---------------------------------------------------------------------------
-- Programs: active flag (inactive hidden from trainee dropdowns in app)
-- ---------------------------------------------------------------------------
ALTER TABLE public.training_programs
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.training_programs.is_active IS 'When false, prefer not enrolling new trainees; existing links remain';

-- Tighten program mutations to academy_admin (staff use existing programs only)
DROP POLICY IF EXISTS training_programs_insert ON public.training_programs;
CREATE POLICY training_programs_insert ON public.training_programs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

DROP POLICY IF EXISTS training_programs_update ON public.training_programs;
CREATE POLICY training_programs_update ON public.training_programs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

-- ---------------------------------------------------------------------------
-- Cohorts / intakes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  academy_site_id UUID REFERENCES public.academy_sites(id) ON DELETE SET NULL,
  program_id UUID REFERENCES public.training_programs(id) ON DELETE SET NULL,
  start_date DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_cohorts_site_idx ON public.training_cohorts(academy_site_id);
CREATE INDEX IF NOT EXISTS training_cohorts_program_idx ON public.training_cohorts(program_id);

CREATE TABLE IF NOT EXISTS public.training_cohort_trainers (
  cohort_id UUID NOT NULL REFERENCES public.training_cohorts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cohort_id, user_id)
);

CREATE INDEX IF NOT EXISTS training_cohort_trainers_user_idx ON public.training_cohort_trainers(user_id);

CREATE TABLE IF NOT EXISTS public.training_cohort_trainees (
  cohort_id UUID NOT NULL REFERENCES public.training_cohorts(id) ON DELETE CASCADE,
  training_doctor_id UUID NOT NULL REFERENCES public.training_doctors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cohort_id, training_doctor_id)
);

CREATE INDEX IF NOT EXISTS training_cohort_trainees_doctor_idx ON public.training_cohort_trainees(training_doctor_id);

DROP TRIGGER IF EXISTS trg_training_cohorts_updated_at ON public.training_cohorts;
CREATE TRIGGER trg_training_cohorts_updated_at
  BEFORE UPDATE ON public.training_cohorts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE public.training_cohorts IS 'Intake/cohort grouping for site, program, trainers, and trainees';
COMMENT ON TABLE public.training_cohort_trainers IS 'Auth users (trainers) associated with a cohort';
COMMENT ON TABLE public.training_cohort_trainees IS 'Trainee profiles (training_doctors) in a cohort';

-- ---------------------------------------------------------------------------
-- Training modules (DB catalog; JSON file remains fallback for unmigrated ids)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_modules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  last_updated DATE NOT NULL DEFAULT CURRENT_DATE,
  read_online_url TEXT,
  download_url TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'draft')),
  mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  recommended BOOLEAN NOT NULL DEFAULT FALSE,
  recommended_weeks INT[] NOT NULL DEFAULT '{}',
  related_competency_ladder_keys TEXT[] NOT NULL DEFAULT '{}',
  requires_assignment BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_modules_status_idx ON public.training_modules(status);

CREATE TABLE IF NOT EXISTS public.training_module_user_assignments (
  module_id TEXT NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (module_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.training_module_cohort_assignments (
  module_id TEXT NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.training_cohorts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (module_id, cohort_id)
);

DROP TRIGGER IF EXISTS trg_training_modules_updated_at ON public.training_modules;
CREATE TRIGGER trg_training_modules_updated_at
  BEFORE UPDATE ON public.training_modules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE public.training_modules IS 'IIOHR training library entries; merged with public JSON fallback by id in app';
COMMENT ON TABLE public.training_module_user_assignments IS 'Direct module visibility for auth users when requires_assignment';
COMMENT ON TABLE public.training_module_cohort_assignments IS 'Module visibility for trainees in cohort';

-- ---------------------------------------------------------------------------
-- RLS: cohorts
-- ---------------------------------------------------------------------------
ALTER TABLE public.training_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_cohort_trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_cohort_trainees ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_cohorts_select ON public.training_cohorts
  FOR SELECT USING (
    public.academy_has_staff_access(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.training_cohort_trainers ctr
      WHERE ctr.cohort_id = training_cohorts.id AND ctr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.training_cohort_trainees ct
      JOIN public.training_doctors td ON td.id = ct.training_doctor_id
      WHERE ct.cohort_id = training_cohorts.id AND td.auth_user_id = auth.uid()
    )
  );

CREATE POLICY training_cohorts_insert ON public.training_cohorts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
    AND created_by = auth.uid()
  );

CREATE POLICY training_cohorts_update ON public.training_cohorts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

CREATE POLICY training_cohorts_delete ON public.training_cohorts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

CREATE POLICY training_cohort_trainers_select ON public.training_cohort_trainers
  FOR SELECT USING (
    public.academy_has_staff_access(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.training_cohort_trainees ct
      JOIN public.training_doctors td ON td.id = ct.training_doctor_id
      WHERE ct.cohort_id = training_cohort_trainers.cohort_id AND td.auth_user_id = auth.uid()
    )
  );

CREATE POLICY training_cohort_trainers_mutate ON public.training_cohort_trainers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

CREATE POLICY training_cohort_trainees_select ON public.training_cohort_trainees
  FOR SELECT USING (
    public.academy_has_staff_access(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.training_doctors td
      WHERE td.id = training_cohort_trainees.training_doctor_id AND td.auth_user_id = auth.uid()
    )
  );

CREATE POLICY training_cohort_trainees_mutate ON public.training_cohort_trainees
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

-- ---------------------------------------------------------------------------
-- RLS: training modules
-- ---------------------------------------------------------------------------
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_module_user_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_module_cohort_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_modules_select ON public.training_modules
  FOR SELECT USING (
    status = 'approved'
    OR public.academy_has_staff_access(auth.uid())
  );

CREATE POLICY training_modules_insert ON public.training_modules
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

CREATE POLICY training_modules_update ON public.training_modules
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

CREATE POLICY training_modules_delete ON public.training_modules
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

CREATE POLICY training_module_user_assignments_select ON public.training_module_user_assignments
  FOR SELECT USING (
    public.academy_has_staff_access(auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY training_module_user_assignments_mutate ON public.training_module_user_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

CREATE POLICY training_module_cohort_assignments_select ON public.training_module_cohort_assignments
  FOR SELECT USING (
    public.academy_has_staff_access(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.training_cohort_trainees ct
      JOIN public.training_doctors td ON td.id = ct.training_doctor_id
      WHERE ct.cohort_id = training_module_cohort_assignments.cohort_id AND td.auth_user_id = auth.uid()
    )
  );

CREATE POLICY training_module_cohort_assignments_mutate ON public.training_module_cohort_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );
