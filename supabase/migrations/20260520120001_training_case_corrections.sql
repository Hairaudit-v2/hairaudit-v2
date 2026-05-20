-- Faculty/admin correction workflow for training cases (additive; does not alter assessments/reviews flows)

-- ---------------------------------------------------------------------------
-- training_cases: voided status + archive/delete metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.training_cases DROP CONSTRAINT IF EXISTS training_cases_status_check;

ALTER TABLE public.training_cases
  ADD CONSTRAINT training_cases_status_check
  CHECK (status IN ('draft', 'in_review', 'reviewed', 'archived', 'voided'));

ALTER TABLE public.training_cases
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

COMMENT ON COLUMN public.training_cases.archived_at IS 'Set when case status becomes archived or voided via faculty correction';
COMMENT ON COLUMN public.training_cases.deleted_at IS 'Soft delete timestamp; case hidden from trainee views when set';

-- ---------------------------------------------------------------------------
-- training_case_uploads: soft delete for controlled image removal
-- ---------------------------------------------------------------------------

ALTER TABLE public.training_case_uploads
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS training_case_uploads_active_idx
  ON public.training_case_uploads(training_case_id)
  WHERE deleted_at IS NULL;

-- Staff may re-categorise uploads (correction workflow)
DROP POLICY IF EXISTS training_case_uploads_update ON public.training_case_uploads;
CREATE POLICY training_case_uploads_update ON public.training_case_uploads
  FOR UPDATE USING (public.academy_has_staff_access(auth.uid()));

-- ---------------------------------------------------------------------------
-- training_case_corrections audit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.training_case_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_case_id UUID NOT NULL REFERENCES public.training_cases(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  correction_type TEXT NOT NULL,
  field_name TEXT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_case_corrections_case_id_idx
  ON public.training_case_corrections(training_case_id);

CREATE INDEX IF NOT EXISTS training_case_corrections_changed_by_idx
  ON public.training_case_corrections(changed_by);

CREATE INDEX IF NOT EXISTS training_case_corrections_created_at_idx
  ON public.training_case_corrections(created_at DESC);

COMMENT ON TABLE public.training_case_corrections IS 'Faculty/admin audit trail for training case data corrections';

-- Staff with case access may read/write corrections (trainees excluded)
CREATE OR REPLACE FUNCTION public.academy_can_manage_training_case_corrections(check_uid UUID, p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.academy_has_staff_access(check_uid)
    AND public.academy_can_access_training_case(check_uid, p_case_id);
$$;

REVOKE ALL ON FUNCTION public.academy_can_manage_training_case_corrections(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.academy_can_manage_training_case_corrections(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.academy_can_manage_training_case_corrections(UUID, UUID) TO service_role;

ALTER TABLE public.training_case_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_case_corrections_select ON public.training_case_corrections
  FOR SELECT USING (
    public.academy_can_manage_training_case_corrections(auth.uid(), training_case_id)
  );

CREATE POLICY training_case_corrections_insert ON public.training_case_corrections
  FOR INSERT WITH CHECK (
    public.academy_can_manage_training_case_corrections(auth.uid(), training_case_id)
    AND (changed_by IS NULL OR changed_by = auth.uid())
  );
