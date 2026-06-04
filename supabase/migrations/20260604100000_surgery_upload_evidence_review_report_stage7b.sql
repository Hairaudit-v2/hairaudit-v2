-- HairAudit Mobile Surgery Upload — Stage 7B (Evidence Review Report)
-- Non-AI, auditor-triggered PDF report for surgery-upload evidence. This migration
-- is intentionally isolated from cases.status, cases.submitted_at, and the legacy
-- /api/submit + case/submitted Inngest audit pipeline.
--
-- Adds:
--   * reports.report_kind — discriminates forensic AI reports from surgery evidence PDFs.
--   * surgery_upload_details.evidence_report_* — pipeline state + pointer to reports row.
--   * surgery_upload_evidence_events event types for report request/completion/failure.

-- ---------------------------------------------------------------------------
-- 1) reports.report_kind (nullable = legacy / forensic pipeline reports)
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS report_kind TEXT NULL;

COMMENT ON COLUMN public.reports.report_kind IS
  'Null = legacy forensic AI audit report. surgery_upload_evidence_review_v1 = Stage 7B non-AI surgery evidence review PDF. UI and loaders must not treat non-null kinds as the primary forensic "latest report" without an explicit branch.';

CREATE INDEX IF NOT EXISTS idx_reports_case_report_kind
  ON public.reports(case_id, report_kind)
  WHERE report_kind IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Pipeline columns on surgery_upload_details (separate from intake triage)
-- ---------------------------------------------------------------------------
ALTER TABLE public.surgery_upload_details
  ADD COLUMN IF NOT EXISTS evidence_report_pipeline_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (evidence_report_pipeline_status IN (
      'not_started', 'queued', 'running', 'succeeded', 'failed', 'cancelled'
    )),
  ADD COLUMN IF NOT EXISTS evidence_report_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidence_report_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_report_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidence_report_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidence_report_error TEXT,
  ADD COLUMN IF NOT EXISTS evidence_report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_surgery_upload_details_evidence_report_pipeline
  ON public.surgery_upload_details(evidence_report_pipeline_status);

COMMENT ON COLUMN public.surgery_upload_details.evidence_report_pipeline_status IS
  'Stage 7B: async evidence-review PDF pipeline (not_started|queued|running|succeeded|failed|cancelled). Independent of cases.status and audit intake triage.';

COMMENT ON COLUMN public.surgery_upload_details.evidence_report_id IS
  'Stage 7B: FK to reports.id for the latest generated surgery evidence review PDF (report_kind = surgery_upload_evidence_review_v1).';

-- ---------------------------------------------------------------------------
-- 3) Evidence timeline event types (append-only audit log)
-- ---------------------------------------------------------------------------
ALTER TABLE public.surgery_upload_evidence_events
  DROP CONSTRAINT IF EXISTS surgery_upload_evidence_events_event_type_check;

ALTER TABLE public.surgery_upload_evidence_events
  ADD CONSTRAINT surgery_upload_evidence_events_event_type_check
  CHECK (event_type IN (
    'evidence_review_status_changed',
    'slot_review_updated',
    'additional_evidence_uploaded',
    'evidence_resubmitted',
    'audit_handoff',
    'audit_intake_created',
    'audit_intake_updated',
    'audit_intake_status_changed',
    'surgery-upload/report-requested',
    'surgery-upload/report-completed',
    'surgery-upload/report-failed'
  ));

COMMENT ON TABLE public.surgery_upload_evidence_events IS
  'Evidence-review + intake + Stage 7B report lifecycle history. Does NOT use case/submitted and does not trigger the forensic audit engine.';
