-- Auditor operations dashboard analytics functions (live mode).
-- These functions provide KPI, trend, pipeline, backlog, and operational table data.

CREATE OR REPLACE FUNCTION public.auditor_dashboard_range_start(p_range TEXT DEFAULT '7d')
RETURNS TIMESTAMPTZ
LANGUAGE SQL
STABLE
AS $$
  SELECT CASE
    WHEN p_range = 'today' THEN date_trunc('day', now())
    WHEN p_range = '30d' THEN now() - interval '30 days'
    WHEN p_range = '90d' THEN now() - interval '90 days'
    ELSE now() - interval '7 days'
  END;
$$;

CREATE OR REPLACE FUNCTION public.auditor_dashboard_kpis(p_range TEXT DEFAULT '7d')
RETURNS TABLE (
  new_audits_today BIGINT,
  total_open_audits BIGINT,
  completed_today BIGINT,
  manual_review_queue BIGINT,
  overdue_audits BIGINT,
  average_turnaround_hours NUMERIC,
  low_confidence_cases BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  WITH latest_report AS (
    SELECT DISTINCT ON (r.case_id)
      r.case_id,
      r.auditor_review_status
    FROM reports r
    ORDER BY r.case_id, r.created_at DESC
  ),
  latest_gii AS (
    SELECT DISTINCT ON (g.case_id)
      g.case_id,
      g.confidence,
      g.auditor_status
    FROM graft_integrity_estimates g
    ORDER BY g.case_id, g.created_at DESC
  )
  SELECT
    (
      SELECT count(*)
      FROM cases c
      WHERE c.deleted_at IS NULL
        AND c.created_at >= date_trunc('day', now())
    ) AS new_audits_today,
    (
      SELECT count(*)
      FROM cases c
      WHERE c.deleted_at IS NULL
        AND c.archived_at IS NULL
        AND coalesce(c.status, '') <> 'complete'
    ) AS total_open_audits,
    (
      SELECT count(*)
      FROM cases c
      WHERE c.deleted_at IS NULL
        AND coalesce(c.status, '') = 'complete'
        AND coalesce(c.updated_at, c.created_at) >= date_trunc('day', now())
    ) AS completed_today,
    (
      SELECT count(*)
      FROM cases c
      LEFT JOIN latest_report lr ON lr.case_id = c.id
      LEFT JOIN latest_gii lg ON lg.case_id = c.id
      WHERE c.deleted_at IS NULL
        AND c.archived_at IS NULL
        AND coalesce(c.status, '') <> 'complete'
        AND (
          coalesce(c.status, '') = 'audit_failed'
          OR coalesce(lr.auditor_review_status, '') IN ('available', 'in_review')
          OR coalesce(lg.auditor_status, '') IN ('pending', 'needs_more_evidence')
        )
    ) AS manual_review_queue,
    (
      SELECT count(*)
      FROM cases c
      WHERE c.deleted_at IS NULL
        AND c.archived_at IS NULL
        AND coalesce(c.status, '') <> 'complete'
        AND coalesce(c.auditor_last_edited_at, c.updated_at, c.submitted_at, c.created_at) < now() - interval '72 hours'
    ) AS overdue_audits,
    (
      SELECT round(
        coalesce(
          avg(extract(epoch FROM (coalesce(c.updated_at, c.created_at) - coalesce(c.submitted_at, c.created_at))) / 3600.0),
          0
        )::numeric,
        1
      )
      FROM cases c
      WHERE c.deleted_at IS NULL
        AND coalesce(c.status, '') = 'complete'
        AND coalesce(c.updated_at, c.created_at) >= public.auditor_dashboard_range_start(p_range)
    ) AS average_turnaround_hours,
    (
      SELECT count(*)
      FROM cases c
      LEFT JOIN latest_gii lg ON lg.case_id = c.id
      WHERE c.deleted_at IS NULL
        AND c.archived_at IS NULL
        AND coalesce(c.status, '') <> 'complete'
        AND lg.confidence < 0.65
    ) AS low_confidence_cases;
$$;

CREATE OR REPLACE FUNCTION public.auditor_dashboard_volume_series(p_range TEXT DEFAULT '7d')
RETURNS TABLE (
  bucket_date DATE,
  bucket_label TEXT,
  new_audits INT,
  completed_audits INT,
  total_volume INT
)
LANGUAGE SQL
STABLE
AS $$
  WITH bounds AS (
    SELECT public.auditor_dashboard_range_start(p_range)::date AS start_date, now()::date AS end_date
  ),
  days AS (
    SELECT generate_series(
      (SELECT start_date FROM bounds),
      (SELECT end_date FROM bounds),
      interval '1 day'
    )::date AS bucket_date
  )
  SELECT
    d.bucket_date,
    to_char(d.bucket_date, 'Mon DD') AS bucket_label,
    (
      SELECT count(*)::int
      FROM cases c
      WHERE c.deleted_at IS NULL
        AND c.created_at::date = d.bucket_date
    ) AS new_audits,
    (
      SELECT count(*)::int
      FROM cases c
      WHERE c.deleted_at IS NULL
        AND coalesce(c.status, '') = 'complete'
        AND coalesce(c.updated_at, c.created_at)::date = d.bucket_date
    ) AS completed_audits,
    (
      SELECT count(*)::int
      FROM cases c
      WHERE c.deleted_at IS NULL
        AND c.created_at::date <= d.bucket_date
    ) AS total_volume
  FROM days d
  ORDER BY d.bucket_date ASC;
$$;

CREATE OR REPLACE FUNCTION public.auditor_dashboard_status_breakdown(p_range TEXT DEFAULT '7d')
RETURNS TABLE (
  submitted BIGINT,
  processing BIGINT,
  in_review BIGINT,
  complete BIGINT,
  audit_failed BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  WITH latest_report AS (
    SELECT DISTINCT ON (r.case_id)
      r.case_id,
      r.auditor_review_status
    FROM reports r
    ORDER BY r.case_id, r.created_at DESC
  ),
  latest_gii AS (
    SELECT DISTINCT ON (g.case_id)
      g.case_id,
      g.auditor_status
    FROM graft_integrity_estimates g
    ORDER BY g.case_id, g.created_at DESC
  ),
  classified AS (
    SELECT
      CASE
        WHEN coalesce(c.status, '') = 'complete' THEN 'complete'
        WHEN coalesce(c.status, '') = 'audit_failed' THEN 'audit_failed'
        WHEN coalesce(lr.auditor_review_status, '') = 'in_review'
          OR coalesce(lg.auditor_status, '') IN ('pending', 'needs_more_evidence') THEN 'in_review'
        WHEN coalesce(c.status, '') = 'submitted' THEN 'submitted'
        ELSE 'processing'
      END AS pipeline_status
    FROM cases c
    LEFT JOIN latest_report lr ON lr.case_id = c.id
    LEFT JOIN latest_gii lg ON lg.case_id = c.id
    WHERE c.deleted_at IS NULL
      AND c.archived_at IS NULL
      AND c.created_at >= public.auditor_dashboard_range_start(p_range)
  )
  SELECT
    count(*) FILTER (WHERE pipeline_status = 'submitted') AS submitted,
    count(*) FILTER (WHERE pipeline_status = 'processing') AS processing,
    count(*) FILTER (WHERE pipeline_status = 'in_review') AS in_review,
    count(*) FILTER (WHERE pipeline_status = 'complete') AS complete,
    count(*) FILTER (WHERE pipeline_status = 'audit_failed') AS audit_failed
  FROM classified;
$$;

CREATE OR REPLACE FUNCTION public.auditor_dashboard_priority_breakdown(p_range TEXT DEFAULT '7d')
RETURNS TABLE (
  overdue BIGINT,
  low_confidence BIGINT,
  evidence_poor BIGINT,
  manual_review BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  WITH latest_report AS (
    SELECT DISTINCT ON (r.case_id)
      r.case_id,
      r.auditor_review_status
    FROM reports r
    ORDER BY r.case_id, r.created_at DESC
  ),
  latest_evidence AS (
    SELECT DISTINCT ON (e.case_id)
      e.case_id,
      e.status,
      e.quality_score,
      e.missing_categories
    FROM case_evidence_manifests e
    ORDER BY e.case_id, e.created_at DESC
  ),
  latest_gii AS (
    SELECT DISTINCT ON (g.case_id)
      g.case_id,
      g.confidence,
      g.auditor_status
    FROM graft_integrity_estimates g
    ORDER BY g.case_id, g.created_at DESC
  ),
  base AS (
    SELECT
      c.id,
      (
        c.deleted_at IS NULL
        AND c.archived_at IS NULL
        AND c.created_at >= public.auditor_dashboard_range_start(p_range)
        AND coalesce(c.status, '') <> 'complete'
      ) AS is_open_case,
      coalesce(c.auditor_last_edited_at, c.updated_at, c.submitted_at, c.created_at) < now() - interval '72 hours' AS is_overdue,
      coalesce(lg.confidence, 1) < 0.65 AS is_low_confidence,
      (
        coalesce(le.status, '') = 'failed'
        OR coalesce(le.quality_score, 100) < 60
        OR coalesce(array_length(le.missing_categories, 1), 0) > 0
      ) AS is_evidence_poor,
      (
        coalesce(c.status, '') = 'audit_failed'
        OR coalesce(lr.auditor_review_status, '') IN ('available', 'in_review')
        OR coalesce(lg.auditor_status, '') IN ('pending', 'needs_more_evidence')
      ) AS is_manual_review
    FROM cases c
    LEFT JOIN latest_report lr ON lr.case_id = c.id
    LEFT JOIN latest_evidence le ON le.case_id = c.id
    LEFT JOIN latest_gii lg ON lg.case_id = c.id
  )
  SELECT
    count(*) FILTER (WHERE is_open_case AND is_overdue) AS overdue,
    count(*) FILTER (WHERE is_open_case AND is_low_confidence) AS low_confidence,
    count(*) FILTER (WHERE is_open_case AND is_evidence_poor) AS evidence_poor,
    count(*) FILTER (WHERE is_open_case AND is_manual_review) AS manual_review
  FROM base;
$$;

CREATE OR REPLACE FUNCTION public.auditor_dashboard_recent_operational_audits(p_range TEXT DEFAULT '7d')
RETURNS TABLE (
  category TEXT,
  id UUID,
  title TEXT,
  audit_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  confidence NUMERIC,
  evidence_score NUMERIC,
  reason TEXT
)
LANGUAGE SQL
STABLE
AS $$
  WITH latest_report AS (
    SELECT DISTINCT ON (r.case_id)
      r.case_id,
      r.auditor_review_status
    FROM reports r
    ORDER BY r.case_id, r.created_at DESC
  ),
  latest_evidence AS (
    SELECT DISTINCT ON (e.case_id)
      e.case_id,
      e.status,
      e.quality_score,
      e.missing_categories
    FROM case_evidence_manifests e
    ORDER BY e.case_id, e.created_at DESC
  ),
  latest_gii AS (
    SELECT DISTINCT ON (g.case_id)
      g.case_id,
      g.confidence,
      g.auditor_status
    FROM graft_integrity_estimates g
    ORDER BY g.case_id, g.created_at DESC
  ),
  base AS (
    SELECT
      c.id,
      coalesce(nullif(trim(c.title), ''), 'Untitled audit') AS title,
      coalesce(c.audit_type, CASE WHEN c.clinic_id IS NOT NULL THEN 'clinic' WHEN c.doctor_id IS NOT NULL THEN 'doctor' ELSE 'patient' END) AS audit_type,
      coalesce(c.status, 'submitted') AS status,
      c.created_at,
      coalesce(c.updated_at, c.created_at) AS updated_at,
      lg.confidence,
      le.quality_score AS evidence_score,
      (
        coalesce(c.status, '') = 'audit_failed'
        OR coalesce(c.auditor_last_edited_at, c.updated_at, c.submitted_at, c.created_at) < now() - interval '72 hours'
      ) AS is_stuck_or_failed,
      (
        coalesce(c.status, '') = 'audit_failed'
        OR coalesce(lr.auditor_review_status, '') IN ('available', 'in_review')
        OR coalesce(lg.auditor_status, '') IN ('pending', 'needs_more_evidence')
      ) AS needs_manual_input
    FROM cases c
    LEFT JOIN latest_report lr ON lr.case_id = c.id
    LEFT JOIN latest_evidence le ON le.case_id = c.id
    LEFT JOIN latest_gii lg ON lg.case_id = c.id
    WHERE c.deleted_at IS NULL
      AND c.archived_at IS NULL
      AND c.created_at >= public.auditor_dashboard_range_start(p_range)
  ),
  recent AS (
    SELECT
      'recent'::TEXT AS category,
      b.id,
      b.title,
      b.audit_type,
      b.status,
      b.created_at,
      b.updated_at,
      b.confidence,
      b.evidence_score,
      NULL::TEXT AS reason
    FROM base b
    ORDER BY b.created_at DESC
    LIMIT 12
  ),
  manual_input AS (
    SELECT
      'manual_input'::TEXT AS category,
      b.id,
      b.title,
      b.audit_type,
      b.status,
      b.created_at,
      b.updated_at,
      b.confidence,
      b.evidence_score,
      'Manual reviewer confirmation required'::TEXT AS reason
    FROM base b
    WHERE b.needs_manual_input
    ORDER BY b.updated_at DESC
    LIMIT 12
  ),
  stuck_failed AS (
    SELECT
      'stuck_failed'::TEXT AS category,
      b.id,
      b.title,
      b.audit_type,
      b.status,
      b.created_at,
      b.updated_at,
      b.confidence,
      b.evidence_score,
      'No progress in 72h or failed case status'::TEXT AS reason
    FROM base b
    WHERE b.is_stuck_or_failed
    ORDER BY b.updated_at DESC
    LIMIT 12
  )
  SELECT * FROM recent
  UNION ALL
  SELECT * FROM manual_input
  UNION ALL
  SELECT * FROM stuck_failed;
$$;

GRANT EXECUTE ON FUNCTION public.auditor_dashboard_range_start(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auditor_dashboard_kpis(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auditor_dashboard_volume_series(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auditor_dashboard_status_breakdown(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auditor_dashboard_priority_breakdown(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auditor_dashboard_recent_operational_audits(TEXT) TO authenticated, service_role;
