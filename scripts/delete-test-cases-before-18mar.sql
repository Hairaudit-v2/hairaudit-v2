-- =============================================================================
-- Delete test audits (cases) submitted before 18 March
-- Run in Supabase SQL Editor (Dashboard → SQL Editor). Use service role / full access.
-- =============================================================================
-- Step 1: DRY RUN – run this first to see how many rows would be affected
-- =============================================================================
/*
WITH cutoff AS (SELECT '2025-03-18 00:00:00+00'::timestamptz AS t),
     old_cases AS (
       SELECT id FROM cases
       WHERE (submitted_at IS NOT NULL AND submitted_at < (SELECT t FROM cutoff))
          OR (submitted_at IS NULL AND created_at < (SELECT t FROM cutoff))
     )
SELECT
  (SELECT count(*) FROM old_cases) AS cases,
  (SELECT count(*) FROM reports r WHERE r.case_id IN (SELECT id FROM old_cases)) AS reports,
  (SELECT count(*) FROM audit_score_overrides o WHERE o.case_id IN (SELECT id FROM old_cases)) AS overrides,
  (SELECT count(*) FROM audit_section_feedback f WHERE f.case_id IN (SELECT id FROM old_cases)) AS section_feedback,
  (SELECT count(*) FROM audit_score_override_history h WHERE h.case_id IN (SELECT id FROM old_cases)) AS override_history;
*/

-- =============================================================================
-- Step 2: ACTUAL DELETION – run after verifying dry-run counts
-- =============================================================================
-- Uses cutoff 2025-03-18 00:00:00 UTC. Change the date below if you need a different cutoff.

DO $$
DECLARE
  cutoff timestamptz := '2025-03-18 00:00:00+00';
  deleted_history int;
  deleted_overrides int;
  deleted_feedback int;
  deleted_reports int;
  deleted_cases int;
BEGIN
  -- Delete override history for old cases
  WITH old_cases AS (
    SELECT id FROM cases
    WHERE (submitted_at IS NOT NULL AND submitted_at < cutoff)
       OR (submitted_at IS NULL AND created_at < cutoff)
  )
  DELETE FROM audit_score_override_history
  WHERE case_id IN (SELECT id FROM old_cases);
  GET DIAGNOSTICS deleted_history = ROW_COUNT;

  -- Delete auditor overrides for reports belonging to old cases
  WITH old_cases AS (
    SELECT id FROM cases
    WHERE (submitted_at IS NOT NULL AND submitted_at < cutoff)
       OR (submitted_at IS NULL AND created_at < cutoff)
  )
  DELETE FROM audit_score_overrides
  WHERE case_id IN (SELECT id FROM old_cases);
  GET DIAGNOSTICS deleted_overrides = ROW_COUNT;

  -- Delete section feedback for those cases
  WITH old_cases AS (
    SELECT id FROM cases
    WHERE (submitted_at IS NOT NULL AND submitted_at < cutoff)
       OR (submitted_at IS NULL AND created_at < cutoff)
  )
  DELETE FROM audit_section_feedback
  WHERE case_id IN (SELECT id FROM old_cases);
  GET DIAGNOSTICS deleted_feedback = ROW_COUNT;

  -- Delete reports for old cases
  WITH old_cases AS (
    SELECT id FROM cases
    WHERE (submitted_at IS NOT NULL AND submitted_at < cutoff)
       OR (submitted_at IS NULL AND created_at < cutoff)
  )
  DELETE FROM reports
  WHERE case_id IN (SELECT id FROM old_cases);
  GET DIAGNOSTICS deleted_reports = ROW_COUNT;

  -- Delete cases (CASCADE will remove: case_evidence_manifests, graft_integrity_estimates,
  -- case_contribution_requests, audit_rerun_log, audit_photos, clinic_case_workspaces, etc.)
  DELETE FROM cases
  WHERE (submitted_at IS NOT NULL AND submitted_at < cutoff)
     OR (submitted_at IS NULL AND created_at < cutoff);
  GET DIAGNOSTICS deleted_cases = ROW_COUNT;

  RAISE NOTICE 'Deleted: % override_history, % overrides, % section_feedback, % reports, % cases',
    deleted_history, deleted_overrides, deleted_feedback, deleted_reports, deleted_cases;
END $$;
