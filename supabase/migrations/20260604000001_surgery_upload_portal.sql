-- HairAudit Mobile Surgery Upload Portal (Stage 1)
-- Adds a 1:1 surgery_upload_details table linked to public.cases for structured
-- surgery-room capture (case basics + surgical preferences + draft/submit status).
-- Images continue to reuse the existing `uploads` table (type 'surgery_photo:<slot>').
-- No changes to cases/reports/uploads schema; least-disruptive additive migration.

-- Access helper: case participants (creator/patient/doctor/clinic) OR auditor.
-- Mirrors the case-membership-or-auditor pattern used by case_evidence_manifests
-- and hair_audit_bulk_admin(). SECURITY DEFINER so RLS on `cases` (none today) or
-- future policies do not block the membership lookup.
CREATE OR REPLACE FUNCTION public.surgery_upload_case_access(p_case_id UUID)
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
      AND (
        c.user_id = auth.uid()
        OR c.patient_id = auth.uid()
        OR c.doctor_id = auth.uid()
        OR c.clinic_id = auth.uid()
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'auditor'
  )
  OR EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND LOWER(COALESCE(u.email, '')) = 'auditor@hairaudit.com'
  );
$$;

CREATE TABLE IF NOT EXISTS public.surgery_upload_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL UNIQUE REFERENCES public.cases(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Case basics (lightweight intake captured at/after surgery)
  patient_reference TEXT,
  clinic_name TEXT,
  surgeon_name TEXT,
  surgery_date DATE,
  procedure_type TEXT
    CHECK (
      procedure_type IS NULL OR procedure_type IN (
        'scalp', 'beard', 'eyebrow', 'female_hairline', 'repair', 'other'
      )
    ),
  notes TEXT,

  -- Surgery preferences / intra-operative details (free-text for Stage 1;
  -- Stage 2 will hydrate defaults from clinic preferences).
  extraction_machine TEXT,
  punch_size TEXT,
  punch_type TEXT,
  implantation_method TEXT,
  prp_used BOOLEAN,
  exosomes_used BOOLEAN,
  storage_solution TEXT,
  planned_grafts INTEGER,
  actual_grafts INTEGER,
  extraction_start_time TEXT,
  implantation_start_time TEXT,
  surgery_finish_time TEXT,
  complication_notes TEXT,

  -- Workflow / draft-submit (intentionally independent of cases.status so the
  -- heavy audit/AI pipeline is NOT triggered at this stage).
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted')),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surgery_upload_details_case
  ON public.surgery_upload_details(case_id);
CREATE INDEX IF NOT EXISTS idx_surgery_upload_details_created_by
  ON public.surgery_upload_details(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_surgery_upload_details_status
  ON public.surgery_upload_details(status, updated_at DESC);

-- Keep updated_at fresh on edits.
CREATE OR REPLACE FUNCTION public.touch_surgery_upload_details_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_surgery_upload_details_updated_at ON public.surgery_upload_details;
CREATE TRIGGER trg_surgery_upload_details_updated_at
  BEFORE UPDATE ON public.surgery_upload_details
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_surgery_upload_details_updated_at();

ALTER TABLE public.surgery_upload_details ENABLE ROW LEVEL SECURITY;

-- Case participants and auditors may read/write their surgery upload detail row.
-- Production writes still go through service-role API routes (which bypass RLS),
-- but these policies keep the table safe for any authenticated direct access and
-- match the existing HairAudit access model.
CREATE POLICY surgery_upload_details_select_access ON public.surgery_upload_details
  FOR SELECT USING (public.surgery_upload_case_access(case_id));

CREATE POLICY surgery_upload_details_insert_access ON public.surgery_upload_details
  FOR INSERT WITH CHECK (public.surgery_upload_case_access(case_id));

CREATE POLICY surgery_upload_details_update_access ON public.surgery_upload_details
  FOR UPDATE USING (public.surgery_upload_case_access(case_id))
  WITH CHECK (public.surgery_upload_case_access(case_id));

CREATE POLICY surgery_upload_details_delete_access ON public.surgery_upload_details
  FOR DELETE USING (public.surgery_upload_case_access(case_id));

COMMENT ON TABLE public.surgery_upload_details IS
  'Stage 1 HairAudit Mobile Surgery Upload Portal: structured surgery capture linked 1:1 to cases(id). Images reuse the uploads table (type surgery_photo:<slot>).';
COMMENT ON COLUMN public.surgery_upload_details.status IS
  'draft | submitted. Submission marks the upload ready for audit/review; it does NOT trigger the audit/AI pipeline in Stage 1.';
COMMENT ON COLUMN public.surgery_upload_details.storage_solution IS
  'ATP / HypoThermosol / other graft storage solution used intra-operatively.';
