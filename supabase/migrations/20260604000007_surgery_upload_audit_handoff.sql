-- HairAudit Mobile Surgery Upload Portal — Stage 6B (Controlled Audit Pipeline Handoff)
-- Adds an explicit, auditor-only "Send to Audit Pipeline" handoff marker to
-- submitted mobile surgery uploads whose evidence has been reviewed and marked
-- ready_for_audit.
--
-- Design / safety notes:
--  * This is ADDITIVE and does NOT trigger the audit pipeline. Stage 6B is a
--    controlled MARKER (Option C): the existing /api/submit + Inngest pipeline is
--    not safe to call directly for surgery uploads (it forbids auditors, validates
--    patient/doctor/clinic photo categories, and depends on audit_type semantics
--    surgery uploads do not have). Stage 6C will connect this marker to the engine.
--  * The handoff is SEPARATE from surgery_upload_details.status (draft/submitted),
--    evidence_review_status (Stage 5), and cases.status (the real audit pipeline).
--  * Becoming evidence_review_status = ready_for_audit NEVER auto-triggers handoff.
--    The auditor must explicitly call the send-to-audit API.
--  * clinic_profile_id is NEVER an access grant — access flows through
--    surgery_upload_case_access() (Stage 1) exactly as before.
--  * No RLS changes, no data rewrites, no generated columns.

-- ---------------------------------------------------------------------------
-- 1) Audit handoff tracking on surgery_upload_details
-- ---------------------------------------------------------------------------
ALTER TABLE public.surgery_upload_details
  ADD COLUMN IF NOT EXISTS audit_handoff_status TEXT NOT NULL DEFAULT 'not_sent'
    CHECK (audit_handoff_status IN ('not_sent', 'sending', 'sent', 'failed')),
  ADD COLUMN IF NOT EXISTS audit_handoff_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audit_handoff_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audit_handoff_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audit_handoff_completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audit_handoff_error TEXT,
  ADD COLUMN IF NOT EXISTS audit_handoff_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_surgery_upload_details_audit_handoff_status
  ON public.surgery_upload_details(audit_handoff_status, created_at DESC);

COMMENT ON COLUMN public.surgery_upload_details.audit_handoff_status IS
  'Stage 6B controlled audit-pipeline handoff marker: not_sent | sending | sent | failed. Separate from status, evidence_review_status, and cases.status. Reaching ready_for_audit does NOT auto-trigger handoff — an auditor must explicitly call /api/surgery-upload/cases/{id}/send-to-audit. Marker mode (Option C): does NOT run the audit engine; Stage 6C will connect it.';

-- ---------------------------------------------------------------------------
-- 2) Allow the Stage 6B handoff event type in the evidence event history
-- ---------------------------------------------------------------------------
-- Stage 5/6A constrained event_type to a fixed allow-list. Extend it (rather than
-- relax it) so the handoff event can be recorded in the existing timeline.
ALTER TABLE public.surgery_upload_evidence_events
  DROP CONSTRAINT IF EXISTS surgery_upload_evidence_events_event_type_check;

ALTER TABLE public.surgery_upload_evidence_events
  ADD CONSTRAINT surgery_upload_evidence_events_event_type_check
  CHECK (event_type IN (
    'evidence_review_status_changed',
    'slot_review_updated',
    'additional_evidence_uploaded',
    'evidence_resubmitted',
    'audit_handoff'
  ));
