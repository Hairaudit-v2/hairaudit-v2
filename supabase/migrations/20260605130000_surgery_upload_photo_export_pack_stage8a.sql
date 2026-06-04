-- HairAudit Mobile Surgery Upload — Stage 8A (Case Photo Export Pack)
-- Dedicated export audit log + evidence timeline event types for ZIP downloads.
--
-- Does NOT trigger reports, Inngest, /api/submit, or cases.status changes.

-- ---------------------------------------------------------------------------
-- 1) surgery_upload_photo_exports (compliance / accountability)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.surgery_upload_photo_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  export_scope TEXT NOT NULL DEFAULT 'all',
  slot_key TEXT,
  photo_count INTEGER NOT NULL DEFAULT 0,
  zip_filename TEXT,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_surgery_upload_photo_exports_case
  ON public.surgery_upload_photo_exports(case_id, created_at DESC);

COMMENT ON TABLE public.surgery_upload_photo_exports IS
  'Stage 8A: audit log for surgery_photo ZIP exports. Inserts are service-role/API only; SELECT for auditors or clinic/doctor case owners (patients excluded).';

ALTER TABLE public.surgery_upload_photo_exports ENABLE ROW LEVEL SECURITY;

-- Patients must not read export logs; clinic/doctor access via case linkage only.
DROP POLICY IF EXISTS surgery_photo_exports_select ON public.surgery_upload_photo_exports;
CREATE POLICY surgery_photo_exports_select ON public.surgery_upload_photo_exports
  FOR SELECT USING (
    public.surgery_upload_is_auditor()
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND (c.doctor_id = auth.uid() OR c.clinic_id = auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE for authenticated users — service role bypasses RLS.

-- ---------------------------------------------------------------------------
-- 2) Evidence timeline: export events
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
    'surgery-upload/report-failed',
    'photo_export_created',
    'photo_export_failed'
  ));

COMMENT ON TABLE public.surgery_upload_evidence_events IS
  'Evidence-review + intake + Stage 7B report + Stage 8A photo-export lifecycle history. Does NOT use case/submitted and does not trigger the forensic audit engine.';
