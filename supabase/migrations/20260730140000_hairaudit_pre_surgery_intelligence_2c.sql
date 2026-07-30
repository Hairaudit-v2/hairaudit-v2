-- HA-PRE-SURGERY-INTELLIGENCE-2C — Expand projection lifecycle + audit events.
-- Additive / idempotent. Does not touch HA-PROJECTION-1A–1G tables.

-- Expand projection status check
ALTER TABLE public.hairaudit_pre_surgery_projections
  DROP CONSTRAINT IF EXISTS hairaudit_pre_surgery_projections_status_check;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD CONSTRAINT hairaudit_pre_surgery_projections_status_check
  CHECK (status IN (
    'draft_request',
    'pending',
    'validation_failed',
    'queued',
    'generating',
    'generated',
    'clinician_review',
    'approved',
    'rejected',
    'superseded',
    'failed',
    'expired'
  ));

-- Optional operational columns (payload remains source of truth for rich fields)
ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS provider_id TEXT NULL;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS provider_request_id TEXT NULL;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS provider_response_id TEXT NULL;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT NULL;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS projection_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS patient_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS regenerates_from_projection_id UUID NULL
    REFERENCES public.hairaudit_pre_surgery_projections(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ha_pre_surgery_projections_idempotency
  ON public.hairaudit_pre_surgery_projections (case_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Expand audit event types
ALTER TABLE public.hairaudit_pre_surgery_audit_events
  DROP CONSTRAINT IF EXISTS hairaudit_pre_surgery_audit_events_event_type_check;

ALTER TABLE public.hairaudit_pre_surgery_audit_events
  ADD CONSTRAINT hairaudit_pre_surgery_audit_events_event_type_check
  CHECK (event_type IN (
    'ai_analysis_created',
    'image_role_corrected',
    'observation_confirmed',
    'observation_corrected',
    'annotation_added',
    'annotation_deleted',
    'graft_plan_edited',
    'graft_plan_approved',
    'projection_requested',
    'projection_validation_rejected',
    'projection_provider_request_sent',
    'projection_provider_accepted',
    'projection_generated',
    'projection_timeout',
    'projection_provider_failure',
    'projection_output_safety_failure',
    'projection_clinician_review_opened',
    'projection_rejected',
    'projection_approved',
    'projection_regeneration_requested',
    'projection_patient_sharing_enabled',
    'projection_patient_sharing_revoked',
    'projection_superseded',
    'report_released'
  ));

COMMENT ON TABLE public.hairaudit_pre_surgery_projections IS
  'HA-PRE-SURGERY-INTELLIGENCE-2C illustrative planning projections with ImagingOS lifecycle. Distinct from hairaudit_projection_snapshots (1D).';
