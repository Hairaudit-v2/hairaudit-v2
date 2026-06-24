-- HA-INTELLIGENCE-8: Structured clinical history layer (admin/operator-entered).
-- One row per case; stores prior surgery, graft metrics, medication history, and notes
-- from external documents (e.g. surgical PDFs). Writes via service-role server actions;
-- RLS limits authenticated access to auditors/operators only.

CREATE TABLE IF NOT EXISTS public.hairaudit_case_clinical_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL UNIQUE REFERENCES public.cases(id) ON DELETE CASCADE,
  prior_surgery_count INTEGER,
  prior_procedure_type TEXT,
  prior_surgery_date DATE,
  prior_clinic_name TEXT,
  prior_surgeon_name TEXT,
  prior_graft_count INTEGER,
  estimated_hair_count INTEGER,
  average_hairs_per_graft NUMERIC(5, 2),
  donor_grafts_removed INTEGER,
  recipient_zones TEXT[] NOT NULL DEFAULT '{}',
  donor_depletion_level TEXT,
  visible_scarring_level TEXT,
  medication_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  supporting_document_notes TEXT,
  clinician_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hairaudit_case_clinical_history_case_id
  ON public.hairaudit_case_clinical_history(case_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_case_clinical_history_updated_at
  ON public.hairaudit_case_clinical_history(updated_at DESC);

-- updated_at trigger (table-specific touch function pattern)
CREATE OR REPLACE FUNCTION public.touch_hairaudit_case_clinical_history_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hairaudit_case_clinical_history_updated_at ON public.hairaudit_case_clinical_history;
CREATE TRIGGER trg_hairaudit_case_clinical_history_updated_at
  BEFORE UPDATE ON public.hairaudit_case_clinical_history
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_hairaudit_case_clinical_history_updated_at();

-- Auditor/operator access helper (includes email fallback used elsewhere in HairAudit).
CREATE OR REPLACE FUNCTION public.hairaudit_clinical_history_operator_access(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cases c
    WHERE c.id = p_case_id
  )
  AND (
    public.hairaudit_current_user_is_auditor()
    OR EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = auth.uid()
        AND LOWER(COALESCE(u.email, '')) = 'auditor@hairaudit.com'
    )
  );
$$;

COMMENT ON FUNCTION public.hairaudit_clinical_history_operator_access(UUID) IS
  'Auditor/operator write+read access for structured case clinical history. Patients have no access.';

ALTER TABLE public.hairaudit_case_clinical_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY hairaudit_case_clinical_history_select_operator
  ON public.hairaudit_case_clinical_history
  FOR SELECT
  TO authenticated
  USING (public.hairaudit_clinical_history_operator_access(case_id));

CREATE POLICY hairaudit_case_clinical_history_insert_operator
  ON public.hairaudit_case_clinical_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.hairaudit_clinical_history_operator_access(case_id));

CREATE POLICY hairaudit_case_clinical_history_update_operator
  ON public.hairaudit_case_clinical_history
  FOR UPDATE
  TO authenticated
  USING (public.hairaudit_clinical_history_operator_access(case_id))
  WITH CHECK (public.hairaudit_clinical_history_operator_access(case_id));

-- service_role bypasses RLS by default in Supabase.

COMMENT ON TABLE public.hairaudit_case_clinical_history IS
  'Operator-entered structured clinical history for a case (prior surgery, graft counts, medications). Not patient-editable.';
