-- HairAudit Mobile Surgery Upload Portal — Stage 2
-- Clinic-level surgery defaults/preferences + a per-case flag recording whether a
-- new surgery upload was pre-filled from those defaults.
--
-- Defaults are linked to clinic_profiles(id) (the cleanest existing relationship:
-- clinic_profiles.linked_user_id = the clinic's auth user, and
-- doctor_profiles.clinic_profile_id ties doctors to a clinic). Defaults are COPIED
-- into surgery_upload_details at create time, never dynamically linked, so historical
-- cases remain accurate when defaults change.

-- ---------------------------------------------------------------------------
-- 1) Per-case flag: did this surgery upload start from clinic defaults?
-- ---------------------------------------------------------------------------
ALTER TABLE public.surgery_upload_details
  ADD COLUMN IF NOT EXISTS prefilled_from_clinic_defaults BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.surgery_upload_details.prefilled_from_clinic_defaults IS
  'TRUE when this row was pre-filled from surgery_upload_clinic_defaults at creation. Used only for the UI cue; values remain independently editable per case.';

-- ---------------------------------------------------------------------------
-- 2) Clinic defaults table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.surgery_upload_clinic_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_profile_id UUID NOT NULL UNIQUE
    REFERENCES public.clinic_profiles(id) ON DELETE CASCADE,

  -- Defaults map 1:1 to per-case surgery_upload_details columns.
  default_extraction_machine TEXT,
  default_punch_type TEXT,
  default_punch_size TEXT,
  default_implantation_method TEXT,
  default_prp_used BOOLEAN,
  default_exosomes_used BOOLEAN,
  default_storage_solution TEXT,   -- ATP / HypoThermosol / other storage solution
  default_notes TEXT,

  -- Reserved for Stage 3 (custom required/optional photo checklist per clinic).
  default_photo_checklist_config JSONB,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surgery_upload_clinic_defaults_clinic
  ON public.surgery_upload_clinic_defaults(clinic_profile_id);

-- updated_at trigger (matches project convention used by other Stage tables).
CREATE OR REPLACE FUNCTION public.touch_surgery_upload_clinic_defaults_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_surgery_upload_clinic_defaults_updated_at
  ON public.surgery_upload_clinic_defaults;
CREATE TRIGGER trg_surgery_upload_clinic_defaults_updated_at
  BEFORE UPDATE ON public.surgery_upload_clinic_defaults
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_surgery_upload_clinic_defaults_updated_at();

-- ---------------------------------------------------------------------------
-- 3) RLS access helpers (SECURITY DEFINER so they can read clinic/doctor links)
-- ---------------------------------------------------------------------------
-- Read: clinic owner OR a doctor linked to the clinic OR auditor.
CREATE OR REPLACE FUNCTION public.surgery_defaults_can_read(p_clinic_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_profiles cp
    WHERE cp.id = p_clinic_profile_id
      AND cp.linked_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.doctor_profiles dp
    WHERE dp.clinic_profile_id = p_clinic_profile_id
      AND dp.linked_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'auditor'
  )
  OR EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND LOWER(COALESCE(u.email, '')) = 'auditor@hairaudit.com'
  );
$$;

-- Write: clinic owner OR auditor only (doctors are read-only).
CREATE OR REPLACE FUNCTION public.surgery_defaults_can_write(p_clinic_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_profiles cp
    WHERE cp.id = p_clinic_profile_id
      AND cp.linked_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'auditor'
  )
  OR EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND LOWER(COALESCE(u.email, '')) = 'auditor@hairaudit.com'
  );
$$;

ALTER TABLE public.surgery_upload_clinic_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY surgery_clinic_defaults_select ON public.surgery_upload_clinic_defaults
  FOR SELECT USING (public.surgery_defaults_can_read(clinic_profile_id));

CREATE POLICY surgery_clinic_defaults_insert ON public.surgery_upload_clinic_defaults
  FOR INSERT WITH CHECK (public.surgery_defaults_can_write(clinic_profile_id));

CREATE POLICY surgery_clinic_defaults_update ON public.surgery_upload_clinic_defaults
  FOR UPDATE USING (public.surgery_defaults_can_write(clinic_profile_id))
  WITH CHECK (public.surgery_defaults_can_write(clinic_profile_id));

CREATE POLICY surgery_clinic_defaults_delete ON public.surgery_upload_clinic_defaults
  FOR DELETE USING (public.surgery_defaults_can_write(clinic_profile_id));

COMMENT ON TABLE public.surgery_upload_clinic_defaults IS
  'Stage 2: clinic-level defaults for the Mobile Surgery Upload Portal, copied into new surgery_upload_details rows. One row per clinic_profile.';
