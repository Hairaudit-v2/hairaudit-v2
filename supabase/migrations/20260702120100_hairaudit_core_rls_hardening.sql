-- HA-NEXUS-1: Core forensic table RLS hardening (cases, reports, uploads, audit_photos).
-- Service role bypasses RLS for trusted server workflows (Inngest, admin routes).

CREATE OR REPLACE FUNCTION public.hairaudit_current_user_is_auditor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'auditor'
  );
$$;

CREATE OR REPLACE FUNCTION public.hairaudit_user_can_access_case(p_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
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
  'Mirrors app-layer canAccessCase for authenticated JWT clients. Auditors included.';

-- CASES
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cases_select_participant ON public.cases;
CREATE POLICY cases_select_participant ON public.cases
  FOR SELECT
  USING (public.hairaudit_user_can_access_case(id));

DROP POLICY IF EXISTS cases_insert_owner ON public.cases;
CREATE POLICY cases_insert_owner ON public.cases
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR patient_id = auth.uid()
      OR doctor_id = auth.uid()
      OR clinic_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cases_update_participant ON public.cases;
CREATE POLICY cases_update_participant ON public.cases
  FOR UPDATE
  USING (public.hairaudit_user_can_access_case(id))
  WITH CHECK (public.hairaudit_user_can_access_case(id));

-- REPORTS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_select_via_case ON public.reports;
CREATE POLICY reports_select_via_case ON public.reports
  FOR SELECT
  USING (public.hairaudit_user_can_access_case(case_id));

-- UPLOADS
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uploads_select_via_case ON public.uploads;
CREATE POLICY uploads_select_via_case ON public.uploads
  FOR SELECT
  USING (public.hairaudit_user_can_access_case(case_id));

DROP POLICY IF EXISTS uploads_insert_via_case ON public.uploads;
CREATE POLICY uploads_insert_via_case ON public.uploads
  FOR INSERT
  WITH CHECK (public.hairaudit_user_can_access_case(case_id));

DROP POLICY IF EXISTS uploads_delete_via_case ON public.uploads;
CREATE POLICY uploads_delete_via_case ON public.uploads
  FOR DELETE
  USING (public.hairaudit_user_can_access_case(case_id));

-- AUDIT_PHOTOS — add auditor read; replace narrow participant-only select if present
DROP POLICY IF EXISTS audit_photos_select_via_case ON public.audit_photos;
CREATE POLICY audit_photos_select_via_case ON public.audit_photos
  FOR SELECT
  USING (public.hairaudit_user_can_access_case(case_id));

DROP POLICY IF EXISTS "audit_photos_select_via_case" ON public.audit_photos;

DROP POLICY IF EXISTS audit_photos_insert_via_case ON public.audit_photos;
CREATE POLICY audit_photos_insert_via_case ON public.audit_photos
  FOR INSERT
  WITH CHECK (public.hairaudit_user_can_access_case(case_id));
