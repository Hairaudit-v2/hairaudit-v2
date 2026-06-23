-- Patient journey RLS hardening — narrow participant + auditor read access on core
-- forensic tables. Writes remain service-role / server API only (Inngest, uploads).
--
-- Mirrors app-layer canAccessCase in src/lib/case-access.ts and src/lib/auth/permissions.ts.
-- Safe for anonymous audit sessions: cases.user_id = auth.uid() includes anon users.

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER — stable search_path)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hairaudit_current_user_is_auditor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'auditor'
  );
$$;

COMMENT ON FUNCTION public.hairaudit_current_user_is_auditor() IS
  'True when the authenticated user has profiles.role = auditor.';

CREATE OR REPLACE FUNCTION public.hairaudit_user_can_access_case(p_case_id uuid)
RETURNS boolean
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
  OR public.hairaudit_current_user_is_auditor();
$$;

COMMENT ON FUNCTION public.hairaudit_user_can_access_case(uuid) IS
  'Case participant (owner/patient/doctor/clinic) or auditor. Used by patient-facing RLS.';

CREATE OR REPLACE FUNCTION public.hairaudit_storage_object_case_id(object_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  parts text[];
  candidate text;
BEGIN
  IF object_name IS NULL OR btrim(object_name) = '' THEN
    RETURN NULL;
  END IF;

  parts := string_to_array(replace(btrim(object_name), '\', '/'), '/');

  IF array_length(parts, 1) IS NULL OR array_length(parts, 1) < 1 THEN
    RETURN NULL;
  END IF;

  IF parts[1] IN ('cases', 'audit_photos', 'reports') AND array_length(parts, 1) >= 2 THEN
    candidate := parts[2];
  ELSE
    candidate := parts[1];
  END IF;

  IF candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN candidate::uuid;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.hairaudit_storage_object_case_id(text) IS
  'Extract case UUID from case-files bucket object keys (cases/, audit_photos/, legacy root).';

-- ---------------------------------------------------------------------------
-- CASES — participant / auditor SELECT only
-- ---------------------------------------------------------------------------

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cases_select_participant ON public.cases;
CREATE POLICY cases_select_participant ON public.cases
  FOR SELECT
  TO authenticated
  USING (public.hairaudit_user_can_access_case(id));

-- ---------------------------------------------------------------------------
-- UPLOADS — participant / auditor SELECT only (writes via service-role API)
-- ---------------------------------------------------------------------------

ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uploads_select_via_case ON public.uploads;
CREATE POLICY uploads_select_via_case ON public.uploads
  FOR SELECT
  TO authenticated
  USING (public.hairaudit_user_can_access_case(case_id));

-- ---------------------------------------------------------------------------
-- REPORTS — participant / auditor SELECT only (writes via service-role API)
-- ---------------------------------------------------------------------------

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_select_via_case ON public.reports;
CREATE POLICY reports_select_via_case ON public.reports
  FOR SELECT
  TO authenticated
  USING (public.hairaudit_user_can_access_case(case_id));

-- ---------------------------------------------------------------------------
-- AUDIT_PHOTOS — auditor read (participant policies already exist)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS audit_photos_select_auditor ON public.audit_photos;
CREATE POLICY audit_photos_select_auditor ON public.audit_photos
  FOR SELECT
  TO authenticated
  USING (public.hairaudit_current_user_is_auditor());

-- ---------------------------------------------------------------------------
-- Intelligence / shadow snapshots — service role only (defense in depth)
-- ---------------------------------------------------------------------------

ALTER TABLE public.hairaudit_intelligence_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_auditos_shadow_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hairaudit_intelligence_snapshots FROM anon, authenticated;
REVOKE ALL ON TABLE public.hairaudit_auditos_shadow_snapshots FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- STORAGE (case-files bucket) — authenticated read for own case namespace only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS case_files_select_participant ON storage.objects;
CREATE POLICY case_files_select_participant ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'case-files'
    AND public.hairaudit_storage_object_case_id(name) IS NOT NULL
    AND public.hairaudit_user_can_access_case(public.hairaudit_storage_object_case_id(name))
  );

-- Writes to case-files remain server-side (service role). No authenticated INSERT/UPDATE/DELETE policies.
