-- HA-SECURITY-1B: Satellite table RLS hardening (community + HLI longevity).
-- Shared Supabase project hosts multiple product surfaces. HairAudit community APIs
-- and HLI longevity flows write via service_role server routes only.
-- Enables RLS + revokes anon/authenticated table access; service_role bypasses RLS.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'community_cases',
    'community_case_ratings',
    'hli_longevity_profiles',
    'hli_longevity_intakes',
    'hli_longevity_questionnaires',
    'hli_longevity_documents',
    'hli_longevity_blood_requests',
    'hli_longevity_audit_events',
    'hli_entitlement_ledger',
    'hli_membership_included_zoom_consumptions'
  ]
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tbl);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.community_cases IS
  'Rate My Hair Transplant community cases. RLS enabled; DML via service_role API routes (/api/community-cases). No direct anon/authenticated PostgREST access.';

COMMENT ON TABLE public.community_case_ratings IS
  'Community case ratings. RLS enabled; writes via service_role API (/api/community-cases/rate). No direct anon/authenticated PostgREST access.';

COMMENT ON TABLE public.hli_longevity_profiles IS
  'HLI longevity member profiles. RLS enabled; service_role only until HLI client auth policies are added (profile_id scoped).';

COMMENT ON TABLE public.hli_longevity_intakes IS
  'HLI longevity intake records. RLS enabled; service_role only until HLI client auth policies are added.';

COMMENT ON TABLE public.hli_longevity_questionnaires IS
  'HLI longevity questionnaire responses. RLS enabled; service_role only until HLI client auth policies are added.';

COMMENT ON TABLE public.hli_longevity_documents IS
  'HLI longevity documents metadata. RLS enabled; service_role only until HLI client auth policies are added.';

COMMENT ON TABLE public.hli_longevity_blood_requests IS
  'HLI blood test request workflow. RLS enabled; service_role only until HLI client auth policies are added.';

COMMENT ON TABLE public.hli_longevity_audit_events IS
  'HLI longevity audit trail events. RLS enabled; service_role only.';

COMMENT ON TABLE public.hli_entitlement_ledger IS
  'HLI entitlement and payment ledger. RLS enabled; service_role only.';

COMMENT ON TABLE public.hli_membership_included_zoom_consumptions IS
  'HLI membership Zoom session consumption. RLS enabled; service_role only.';
