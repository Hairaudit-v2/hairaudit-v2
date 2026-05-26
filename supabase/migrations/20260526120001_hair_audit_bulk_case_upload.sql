-- HairAudit bulk case upload: batch wrapper, case intake fields, and staged images.

CREATE TABLE IF NOT EXISTS public.hair_audit_case_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clinic_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  batch_name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'doctor_supplied_batch',
  shared_surgery_date DATE,
  shared_location TEXT,
  shared_punch_type TEXT,
  shared_punch_size TEXT,
  shared_extraction_method TEXT,
  shared_implantation_method TEXT,
  shared_equipment_notes TEXT,
  shared_preservation_notes TEXT,
  shared_general_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'ready_for_review', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hair_audit_case_batches_created_by
  ON public.hair_audit_case_batches(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hair_audit_case_batches_status
  ON public.hair_audit_case_batches(status, created_at DESC);

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.hair_audit_case_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS case_label TEXT,
  ADD COLUMN IF NOT EXISTS patient_reference TEXT,
  ADD COLUMN IF NOT EXISTS patient_email TEXT,
  ADD COLUMN IF NOT EXISTS graft_count INTEGER,
  ADD COLUMN IF NOT EXISTS hair_count INTEGER,
  ADD COLUMN IF NOT EXISTS case_specific_notes TEXT,
  ADD COLUMN IF NOT EXISTS intake_status TEXT
    CHECK (intake_status IS NULL OR intake_status IN ('draft', 'incomplete', 'ready_for_audit'));

CREATE INDEX IF NOT EXISTS idx_cases_batch_id ON public.cases(batch_id);
CREATE INDEX IF NOT EXISTS idx_cases_intake_status ON public.cases(intake_status);

CREATE TABLE IF NOT EXISTS public.hair_audit_case_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.hair_audit_case_batches(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  image_category TEXT
    CHECK (
      image_category IS NULL OR image_category IN (
        'pre_op_front',
        'pre_op_temples',
        'pre_op_crown',
        'donor_before',
        'donor_extraction',
        'donor_after',
        'recipient_placement',
        'immediate_post_op',
        'result_front',
        'result_temples',
        'result_crown',
        'equipment',
        'punch_photo',
        'other'
      )
    ),
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hair_audit_case_images_batch
  ON public.hair_audit_case_images(batch_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_hair_audit_case_images_case
  ON public.hair_audit_case_images(case_id);

CREATE OR REPLACE FUNCTION public.hair_audit_bulk_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid
      AND p.role = 'auditor'
  )
  OR EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = uid
      AND LOWER(COALESCE(u.email, '')) = 'auditor@hairaudit.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_hair_audit_batch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hair_audit_case_batches_updated_at ON public.hair_audit_case_batches;
CREATE TRIGGER trg_hair_audit_case_batches_updated_at
  BEFORE UPDATE ON public.hair_audit_case_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_hair_audit_batch_updated_at();

ALTER TABLE public.hair_audit_case_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hair_audit_case_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY hair_audit_batches_select_admin ON public.hair_audit_case_batches
  FOR SELECT USING (public.hair_audit_bulk_admin(auth.uid()));

CREATE POLICY hair_audit_batches_insert_admin ON public.hair_audit_case_batches
  FOR INSERT WITH CHECK (public.hair_audit_bulk_admin(auth.uid()));

CREATE POLICY hair_audit_batches_update_admin ON public.hair_audit_case_batches
  FOR UPDATE USING (public.hair_audit_bulk_admin(auth.uid()));

CREATE POLICY hair_audit_batches_delete_admin ON public.hair_audit_case_batches
  FOR DELETE USING (public.hair_audit_bulk_admin(auth.uid()));

CREATE POLICY hair_audit_images_select_admin ON public.hair_audit_case_images
  FOR SELECT USING (public.hair_audit_bulk_admin(auth.uid()));

CREATE POLICY hair_audit_images_insert_admin ON public.hair_audit_case_images
  FOR INSERT WITH CHECK (public.hair_audit_bulk_admin(auth.uid()));

CREATE POLICY hair_audit_images_update_admin ON public.hair_audit_case_images
  FOR UPDATE USING (public.hair_audit_bulk_admin(auth.uid()));

CREATE POLICY hair_audit_images_delete_admin ON public.hair_audit_case_images
  FOR DELETE USING (public.hair_audit_bulk_admin(auth.uid()));
