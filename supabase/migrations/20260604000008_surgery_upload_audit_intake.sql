-- HairAudit Mobile Surgery Upload Portal — Stage 6C (Audit Intake Queue)
-- Adds a dedicated, auditor/admin-only intake queue that sits BETWEEN the mobile
-- evidence-review workflow (Stage 5/6A) and the future report-generation pipeline
-- (Stage 7). Stage 6B records a controlled handoff marker; Stage 6C turns that
-- marker into a managed queue record an auditor can triage.
--
-- Design / safety notes:
--  * This is ADDITIVE and still does NOT trigger the audit engine. Creating an
--    intake record does NOT call /api/submit, does NOT send any Inngest event,
--    does NOT generate a report, and does NOT mutate cases.status. Stage 7 will
--    connect intake records to real report generation.
--  * One intake record per case (UNIQUE(case_id)). Retry/recreate history lives in
--    surgery_upload_evidence_events, not in duplicate intake rows.
--  * Auditors/admins manage intake records. Case participants (clinic/doctor) may
--    READ the intake status for cases they can already access, but can NEVER write.
--    Patients are excluded by case access.
--  * clinic_profile_id is NEVER an access grant — read access flows through
--    surgery_upload_case_access() (Stage 1). An intake record never widens evidence
--    access. Writes are gated by surgery_upload_is_auditor() (Stage 5).
--  * No changes to existing RLS on other tables, no data rewrites, no generated
--    columns.

-- ---------------------------------------------------------------------------
-- 1) Audit intake queue table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.surgery_upload_audit_intake (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  -- Optional link to the 1:1 surgery detail row; case_id alone is sufficient.
  surgery_upload_details_id UUID REFERENCES public.surgery_upload_details(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  error_message TEXT,
  intake_notes TEXT,
  reviewer_notes TEXT,

  source TEXT NOT NULL DEFAULT 'mobile_surgery_upload',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- One intake record per case for Stage 6C. Recreate/retry history is kept in
  -- surgery_upload_evidence_events; the single row is mutated in place.
  UNIQUE (case_id)
);

CREATE INDEX IF NOT EXISTS idx_surgery_upload_audit_intake_status
  ON public.surgery_upload_audit_intake(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_surgery_upload_audit_intake_priority
  ON public.surgery_upload_audit_intake(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_surgery_upload_audit_intake_assigned_to
  ON public.surgery_upload_audit_intake(assigned_to, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_surgery_upload_audit_intake_case
  ON public.surgery_upload_audit_intake(case_id);

-- Keep updated_at fresh on edits (reuses the Stage 1 trigger function).
DROP TRIGGER IF EXISTS trg_surgery_upload_audit_intake_updated_at
  ON public.surgery_upload_audit_intake;
CREATE TRIGGER trg_surgery_upload_audit_intake_updated_at
  BEFORE UPDATE ON public.surgery_upload_audit_intake
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_surgery_upload_details_updated_at();

ALTER TABLE public.surgery_upload_audit_intake ENABLE ROW LEVEL SECURITY;

-- Read: any case participant (clinic/doctor) or auditor for cases they can access.
-- This NEVER grants evidence access on its own — it mirrors the same case-access
-- predicate used everywhere else in the portal.
CREATE POLICY surgery_audit_intake_select ON public.surgery_upload_audit_intake
  FOR SELECT USING (public.surgery_upload_case_access(case_id));

-- Write: auditors/admins only. Clinic/doctor/patient users can NEVER create, change,
-- or delete intake records. Production writes go through service-role API routes
-- (which bypass RLS); these policies are the safe net for direct access.
CREATE POLICY surgery_audit_intake_insert ON public.surgery_upload_audit_intake
  FOR INSERT WITH CHECK (public.surgery_upload_is_auditor());

CREATE POLICY surgery_audit_intake_update ON public.surgery_upload_audit_intake
  FOR UPDATE USING (public.surgery_upload_is_auditor())
  WITH CHECK (public.surgery_upload_is_auditor());

CREATE POLICY surgery_audit_intake_delete ON public.surgery_upload_audit_intake
  FOR DELETE USING (public.surgery_upload_is_auditor());

COMMENT ON TABLE public.surgery_upload_audit_intake IS
  'Stage 6C audit intake queue for mobile surgery uploads. One row per case (UNIQUE case_id). Auditor/admin-managed; case participants read-only. Does NOT trigger the audit engine, Inngest, report generation, or any cases.status change — it is a controlled middle layer before Stage 7.';
COMMENT ON COLUMN public.surgery_upload_audit_intake.status IS
  'pending | processing | completed | failed | cancelled. Workflow-only; processing/completed do NOT generate a report in Stage 6C.';
COMMENT ON COLUMN public.surgery_upload_audit_intake.metadata IS
  'Sanitized snapshot of useful values at handoff time (evidence_review_status, audit_handoff_status, required-evidence completion summary, clinic_profile_id, clinic_name, surgeon, procedure_type, surgery_date). Reporting/context only.';

-- ---------------------------------------------------------------------------
-- 2) Allow Stage 6C intake event types in the evidence event history
-- ---------------------------------------------------------------------------
-- Extend (rather than relax) the event_type allow-list so intake lifecycle events
-- can live in the existing evidence timeline.
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
    'audit_intake_status_changed'
  ));
