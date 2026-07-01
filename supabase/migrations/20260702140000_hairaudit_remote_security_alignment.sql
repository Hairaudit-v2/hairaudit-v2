-- HA-SECURITY-1: Remote Supabase security alignment
-- Closes advisor gaps without weakening participant / auditor / service_role access:
--  * upload_audit_corrections: enable RLS (auditor SELECT; writes service-role only)
--  * SECURITY DEFINER helpers: revoke anon/public EXECUTE (RPC hardening)
--  * doctor_case_audit_runtime: security_invoker so underlying RLS applies
--  * Legacy {public} policies on core forensic tables -> authenticated role only

-- ---------------------------------------------------------------------------
-- 1) upload_audit_corrections — auditor read trail; server API writes via service role
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.upload_audit_corrections') IS NOT NULL THEN
    ALTER TABLE public.upload_audit_corrections ENABLE ROW LEVEL SECURITY;

    REVOKE ALL ON TABLE public.upload_audit_corrections FROM anon;
    GRANT SELECT ON TABLE public.upload_audit_corrections TO authenticated;
    GRANT ALL ON TABLE public.upload_audit_corrections TO service_role;

    DROP POLICY IF EXISTS upload_audit_corrections_select_auditor ON public.upload_audit_corrections;
    CREATE POLICY upload_audit_corrections_select_auditor ON public.upload_audit_corrections
      FOR SELECT
      TO authenticated
      USING (public.hairaudit_current_user_is_auditor());

    COMMENT ON TABLE public.upload_audit_corrections IS
      'Auditor/admin history for patient upload corrections. SELECT: auditors via RLS; INSERT/UPDATE/DELETE: service_role API routes only.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) SECURITY DEFINER functions — block anon/public PostgREST RPC; keep RLS callers
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.hairaudit_current_user_is_auditor() IS
  'RLS helper: true when profiles.role = auditor. EXECUTE: authenticated + service_role only (no anon RPC).';

COMMENT ON FUNCTION public.hairaudit_user_can_access_case(uuid) IS
  'RLS helper: case participant or auditor. EXECUTE: authenticated + service_role only (no anon RPC).';

COMMENT ON FUNCTION public.surgery_upload_case_access(uuid) IS
  'Surgery upload RLS helper: case participant or auditor. EXECUTE: authenticated + service_role only (no anon RPC).';

COMMENT ON FUNCTION public.surgery_upload_is_auditor() IS
  'Surgery upload RLS helper: auditor predicate. EXECUTE: authenticated + service_role only (no anon RPC).';

-- ---------------------------------------------------------------------------
-- 3) doctor_case_audit_runtime — use invoker RLS on underlying doctor_cases
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.doctor_case_audit_runtime') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.doctor_case_audit_runtime SET (security_invoker = true)';
    COMMENT ON VIEW public.doctor_case_audit_runtime IS
      'Doctor portal audit runtime (security_invoker=true): querying user must pass doctor_cases RLS.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Core forensic tables — restrict legacy {public} policies to authenticated
--    (anon cannot satisfy auth.uid() checks; removes anonymous-access advisor noise)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('cases', 'uploads', 'reports', 'audit_photos')
      AND roles @> ARRAY['public']::name[]
      AND array_length(roles, 1) = 1
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.%I TO authenticated',
      pol.policyname,
      pol.tablename
    );
  END LOOP;
END $$;
