-- =============================================================================
-- HairAudit Phase 0B — RLS DRAFT (DO NOT APPLY TO PRODUCTION)
-- =============================================================================
--
-- Status: REFERENCE ONLY — validate against live schema before any migration.
--
-- Prerequisites before applying:
--   1. Baseline CREATE TABLE for cases, reports, uploads committed or dumped
--      (Phase 1A documents inferred columns; see docs/hairaudit-v2-phase-1a-schema-foundation.md)
--   2. Generated Supabase types refreshed (npm run gen:supabase-types against staging)
--   3. Staging regression: patient submit, uploads, signed URLs, PDF, Inngest
--   3. Confirm no browser/anon client reads core tables without filters
--   4. Set CONTRIBUTION_TOKEN_SECRET / REPORT_RENDER_TOKEN in all envs
--
-- Service role bypass: Supabase service_role JWT bypasses RLS automatically.
-- All Inngest workers and Next.js admin routes continue using service role.
--
-- Token caveats:
--   - Contribution portal uses token hash lookup via service role (no auth.uid())
--   - Report HTML/PDF uses signed render tokens at app layer (not Postgres RLS)
--   - Playwright print routes authenticate via REPORT_RENDER_TOKEN HMAC
--
-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 1B PREREQUISITE — DO NOT APPLY UNTIL COMPLETE
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠️  The following Phase 1B checklist must be COMPLETE before applying this RLS draft:
--
--   □ 1. Verified baseline DDL for cases, reports, uploads exists in repo
--        Location: supabase/migrations/YYYYMMDDHHMMSS_hairaudit_core_forensic_baseline.sql
--        OR docs/sql/hairaudit-core-forensic-baseline.sql (if awaiting migration)
--        Guide: docs/hairaudit-v2-phase-1b-baseline-schema-capture.md
--
--   □ 2. Generated Supabase types committed
--        Location: src/lib/supabase/database.types.ts
--        Command: npm run gen:supabase-types
--        Verify: npm run test:schema-phase1a (passes with generated types)
--
--   □ 3. Staging regression test passed
--        Full pipeline: create case → upload photos → submit → PDF generated
--        Test: npm run test:schema-phase1a && npm run test:security-phase0 && npm run test:security-phase0b
--
--   □ 4. Type bridge verified
--        Import: src/lib/hairaudit/generatedTypeBridge.ts
--        Status: Bridge usingGeneratedTypes should become true after generation
--
--   □ 5. Placeholder migration reviewed
--        File: docs/sql/hairaudit-core-forensic-baseline-placeholder.sql
--        Contains: Verified CREATE TABLE statements (not just comments)
--
--   □ 6. rollback plan documented
--        Location: docs/hairaudit-v2-phase-1b-baseline-schema-capture.md § Rollback Plan
--
-- DO NOT UNCOMMENT/ENABLE RLS POLICIES BELOW UNTIL ALL PHASE 1B CHECKBOXES ARE CHECKED.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER — review search_path in production)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- CASES (baseline DDL not in repo — verify columns before apply)
-- ---------------------------------------------------------------------------

-- ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS cases_select_participant ON public.cases;
-- CREATE POLICY cases_select_participant ON public.cases
--   FOR SELECT
--   USING (public.hairaudit_user_can_access_case(id));

-- DROP POLICY IF EXISTS cases_insert_owner ON public.cases;
-- CREATE POLICY cases_insert_owner ON public.cases
--   FOR INSERT
--   WITH CHECK (
--     auth.uid() IS NOT NULL
--     AND (
--       user_id = auth.uid()
--       OR patient_id = auth.uid()
--       OR doctor_id = auth.uid()
--       OR clinic_id = auth.uid()
--     )
--   );

-- DROP POLICY IF EXISTS cases_update_participant ON public.cases;
-- CREATE POLICY cases_update_participant ON public.cases
--   FOR UPDATE
--   USING (public.hairaudit_user_can_access_case(id))
--   WITH CHECK (public.hairaudit_user_can_access_case(id));

-- No DELETE policy for authenticated users — soft-delete via service role API only.

-- ---------------------------------------------------------------------------
-- REPORTS
-- ---------------------------------------------------------------------------

-- ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS reports_select_via_case ON public.reports;
-- CREATE POLICY reports_select_via_case ON public.reports
--   FOR SELECT
--   USING (public.hairaudit_user_can_access_case(case_id));

-- Writes (insert/update) reserved for service role (Inngest, submit pipeline):
-- No authenticated INSERT/UPDATE policies — app uses createSupabaseAdminClient().

-- ---------------------------------------------------------------------------
-- UPLOADS
-- ---------------------------------------------------------------------------

-- ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS uploads_select_via_case ON public.uploads;
-- CREATE POLICY uploads_select_via_case ON public.uploads
--   FOR SELECT
--   USING (public.hairaudit_user_can_access_case(case_id));

-- DROP POLICY IF EXISTS uploads_insert_via_case ON public.uploads;
-- CREATE POLICY uploads_insert_via_case ON public.uploads
--   FOR INSERT
--   WITH CHECK (public.hairaudit_user_can_access_case(case_id));

-- DROP POLICY IF EXISTS uploads_delete_via_case ON public.uploads;
-- CREATE POLICY uploads_delete_via_case ON public.uploads
--   FOR DELETE
--   USING (public.hairaudit_user_can_access_case(case_id));

-- NOTE: upload-panel.tsx direct browser INSERT would start working under RLS
-- if user is case participant — but still bypasses server validation.
-- Remove upload-panel before enabling uploads INSERT policy, or restrict to API-only writes.

-- ---------------------------------------------------------------------------
-- UPLOAD_AUDIT_CORRECTIONS (auditor trail — currently no RLS)
-- ---------------------------------------------------------------------------

-- ALTER TABLE public.upload_audit_corrections ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS upload_audit_corrections_select_auditor ON public.upload_audit_corrections;
-- CREATE POLICY upload_audit_corrections_select_auditor ON public.upload_audit_corrections
--   FOR SELECT
--   USING (public.hairaudit_current_user_is_auditor());

-- INSERT/UPDATE: service role only (auditor API routes)

-- ---------------------------------------------------------------------------
-- COMMUNITY (public feature — product decision required)
-- ---------------------------------------------------------------------------

-- Option A: Keep API-only (service role) — add edge rate limiting, no RLS change
-- Option B: Enable RLS with published-only SELECT

-- ALTER TABLE public.community_cases ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS community_cases_select_published ON public.community_cases;
-- CREATE POLICY community_cases_select_published ON public.community_cases
--   FOR SELECT
--   USING (is_published = true);

-- INSERT: service role only (POST /api/community-cases) until auth model decided

-- ALTER TABLE public.community_case_ratings ENABLE ROW LEVEL SECURITY;
-- No anon INSERT — ratings via service role API only

-- ---------------------------------------------------------------------------
-- AUDIT_PHOTOS — extend existing policies (already has RLS)
-- ---------------------------------------------------------------------------

-- Consider adding auditor SELECT (currently missing):
-- DROP POLICY IF EXISTS audit_photos_select_auditor ON public.audit_photos;
-- CREATE POLICY audit_photos_select_auditor ON public.audit_photos
--   FOR SELECT
--   USING (public.hairaudit_current_user_is_auditor());

-- ---------------------------------------------------------------------------
-- STORAGE (case-files bucket) — not table RLS; document separately
-- ---------------------------------------------------------------------------
-- App gates storage via:
--   - POST /api/uploads/* (validated multipart)
--   - GET /api/uploads/signed-url (auth + case access + path gate)
--   - GET /api/reports/signed-url (auth + case access)
-- Storage bucket policies should deny anon list; allow authenticated
-- read only via signed URLs generated server-side.

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- ALTER TABLE public.cases DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.uploads DISABLE ROW LEVEL SECURITY;
-- (drop policies as needed)
