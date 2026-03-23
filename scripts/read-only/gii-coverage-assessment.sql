-- Graft Integrity (GII) coverage assessment — READ ONLY
-- Run in Supabase SQL Editor (or psql). No writes, no schema changes.
--
-- Definitions (align with src/lib/inngest/functions.ts pickClaimedGrafts + runGraftIntegrityEstimate):
-- - Eligible case: operational case row, not soft-deleted.
-- - GII covered: at least one row in graft_integrity_estimates for that case_id.
-- - Latest report: highest reports.version per case_id (matches Inngest GII loader).
-- - patient_answers present: summary JSON has a JSON object at key 'patient_answers'.
-- - claimed graft signal: any of the JSON paths used by pickClaimedGrafts parses as a positive integer.
--   (GII can still run with NULL claimed grafts; this flags "stronger" backfill candidates.)

-- ---------------------------------------------------------------------------
-- 0) Optional: tighten "historical" to submitted+ (uncomment if you exclude drafts)
-- ---------------------------------------------------------------------------
-- Eligible cases are defined in the CTE below as deleted_at IS NULL only.

WITH eligible AS (
  SELECT c.id AS case_id
  FROM cases c
  WHERE c.deleted_at IS NULL
    -- AND c.status <> 'draft'  -- optional: exclude drafts
),
latest_report AS (
  SELECT DISTINCT ON (r.case_id)
    r.case_id,
    r.version,
    r.summary
  FROM reports r
  INNER JOIN eligible e ON e.case_id = r.case_id
  ORDER BY r.case_id, r.version DESC
),
gii_cases AS (
  SELECT DISTINCT g.case_id
  FROM graft_integrity_estimates g
  INNER JOIN eligible e ON e.case_id = g.case_id
),
lr AS (
  SELECT
    e.case_id,
    lr.version AS report_version,
    lr.summary,
    jsonb_typeof(lr.summary -> 'patient_answers') = 'object'
      AND (lr.summary -> 'patient_answers') IS NOT NULL
      AND (lr.summary -> 'patient_answers') <> 'null'::jsonb AS has_patient_answers_obj,
    (
      (trim(both '"' FROM (lr.summary #>> '{patient_answers,graft_number_received}'))) ~ '^[0-9]+$'
      OR (trim(both '"' FROM (lr.summary #>> '{patient_answers,grafts_claimed_total}'))) ~ '^[0-9]+$'
      OR (trim(both '"' FROM (lr.summary #>> '{patient_answers,enhanced_patient_answers,procedure_execution,grafts_claimed_total}'))) ~ '^[0-9]+$'
      OR (trim(both '"' FROM (lr.summary #>> '{patient_answers,procedure_execution,grafts_claimed_total}'))) ~ '^[0-9]+$'
    ) AS has_claimed_graft_signal
  FROM eligible e
  LEFT JOIN latest_report lr ON lr.case_id = e.case_id
)
SELECT
  (SELECT count(*) FROM eligible) AS total_eligible_cases,
  (SELECT count(*) FROM gii_cases) AS cases_with_any_gii_row,
  (SELECT count(*) FROM eligible e WHERE NOT EXISTS (SELECT 1 FROM gii_cases g WHERE g.case_id = e.case_id)) AS cases_missing_gii,
  (SELECT count(*) FROM lr WHERE lr.summary IS NOT NULL) AS eligible_with_latest_report,
  (SELECT count(*) FROM lr WHERE lr.has_patient_answers_obj) AS eligible_latest_report_has_patient_answers,
  (SELECT count(*) FROM lr WHERE lr.has_claimed_graft_signal) AS eligible_latest_report_has_claimed_graft_signal,
  (
    SELECT count(*)
    FROM eligible e
    INNER JOIN lr ON lr.case_id = e.case_id
    WHERE NOT EXISTS (SELECT 1 FROM gii_cases g WHERE g.case_id = e.case_id)
      AND lr.summary IS NOT NULL
      AND lr.has_patient_answers_obj
  ) AS missing_gii_but_has_patient_answers,
  (
    SELECT count(*)
    FROM eligible e
    INNER JOIN lr ON lr.case_id = e.case_id
    WHERE NOT EXISTS (SELECT 1 FROM gii_cases g WHERE g.case_id = e.case_id)
      AND lr.has_claimed_graft_signal
  ) AS missing_gii_but_has_claimed_graft_signal,
  (
    SELECT count(*)
    FROM eligible e
    WHERE NOT EXISTS (SELECT 1 FROM gii_cases g WHERE g.case_id = e.case_id)
      AND (
        NOT EXISTS (SELECT 1 FROM latest_report lr2 WHERE lr2.case_id = e.case_id)
        OR NOT COALESCE((SELECT lr3.has_patient_answers_obj FROM lr lr3 WHERE lr3.case_id = e.case_id), false)
      )
  ) AS missing_gii_and_missing_patient_answers_support;

-- ---------------------------------------------------------------------------
-- Drill-down: sample case_ids missing GII (cap 50) for manual review
-- ---------------------------------------------------------------------------
-- WITH ... same CTEs as above, then:
-- SELECT e.case_id
-- FROM eligible e
-- WHERE NOT EXISTS (SELECT 1 FROM graft_integrity_estimates g WHERE g.case_id = e.case_id)
-- ORDER BY e.case_id
-- LIMIT 50;
