-- HA-PRE-SURGERY-INTELLIGENCE-2D — Controlled ImagingOS activation columns + audit events.
-- Additive / idempotent. Does not drop data. Distinct from HA-PROJECTION-1A–1G.

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS stale_at TIMESTAMPTZ NULL;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS stale_reasons TEXT[] NULL;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS shadow_mode BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS quality_cohort_category TEXT NULL;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS patient_consent_id UUID NULL;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS case_level_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.hairaudit_pre_surgery_projection_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  projection_id UUID NOT NULL REFERENCES public.hairaudit_pre_surgery_projections(id) ON DELETE CASCADE,
  patient_user_id UUID NULL,
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  statements_acknowledged TEXT[] NOT NULL,
  all_statements_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  approval_date_shown TIMESTAMPTZ NOT NULL,
  graft_plan_version_shown INTEGER NOT NULL,
  graft_plan_id_shown UUID NOT NULL,
  schema_version TEXT NOT NULL DEFAULT 'ha-pre-surgery-projection-consent-v1',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ha_psi_projection_consents_case
  ON public.hairaudit_pre_surgery_projection_consents (case_id);

CREATE INDEX IF NOT EXISTS idx_ha_psi_projections_stale
  ON public.hairaudit_pre_surgery_projections (case_id)
  WHERE stale_at IS NOT NULL;

ALTER TABLE public.hairaudit_pre_surgery_projection_consents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hairaudit_pre_surgery_projection_consents FROM anon, authenticated;
GRANT ALL ON TABLE public.hairaudit_pre_surgery_projection_consents TO service_role;

-- Expand audit event types for 2D
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
    'projection_preflight_rejected',
    'projection_activation_denied',
    'projection_provider_request_sent',
    'projection_provider_accepted',
    'projection_generated',
    'projection_timeout',
    'projection_provider_failure',
    'projection_output_safety_failure',
    'projection_output_validation_failed',
    'projection_clinician_review_opened',
    'projection_rejected',
    'projection_approved',
    'projection_regeneration_requested',
    'projection_patient_sharing_enabled',
    'projection_patient_sharing_revoked',
    'projection_patient_consent_recorded',
    'projection_marked_stale',
    'projection_superseded',
    'projection_shadow_review_recorded',
    'report_released'
  ));

COMMENT ON TABLE public.hairaudit_pre_surgery_projections IS
  'HA-PRE-SURGERY-INTELLIGENCE-2D illustrative planning projections with controlled ImagingOS activation. Distinct from hairaudit_projection_snapshots (1D). Keep provider=stub until allowlisted 2D pilot.';

COMMENT ON TABLE public.hairaudit_pre_surgery_projection_consents IS
  'Patient consent records for illustrative projection sharing (2D).';
