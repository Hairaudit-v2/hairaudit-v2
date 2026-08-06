-- HA-PRE-SURGERY-PROJECTION-REPORT-1A
-- Auditor projection corrections + report inclusion audit events.
-- Does not mutate hairaudit_pre_surgery_projections immutable snapshot rows.
-- Distinct from hairaudit_projection_snapshots (HA-PROJECTION-1D).

CREATE TABLE IF NOT EXISTS public.hairaudit_pre_surgery_projection_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  projection_snapshot_id UUID NOT NULL
    REFERENCES public.hairaudit_pre_surgery_projections(id) ON DELETE RESTRICT,
  projection_version INTEGER NOT NULL DEFAULT 1,
  schema_version TEXT NOT NULL DEFAULT 'ha-pre-surgery-projection-correction-v1',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'adjusted', 'resolved', 'withdrawn')),
  correction_codes TEXT[] NOT NULL DEFAULT '{}',
  clinical_note TEXT NOT NULL,
  zone_refs TEXT[] NOT NULL DEFAULT '{}',
  geometry_type TEXT NULL
    CHECK (geometry_type IS NULL OR geometry_type IN ('point', 'polyline', 'polygon')),
  coordinates JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_mode TEXT NULL
    CHECK (
      suggested_mode IS NULL
      OR suggested_mode IN ('conservative', 'planned', 'optimistic_within_approved_range')
    ),
  supersedes_correction_id UUID NULL
    REFERENCES public.hairaudit_pre_surgery_projection_corrections(id) ON DELETE SET NULL,
  learning_signal_id UUID NULL,
  learning_signal JSONB NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NULL,
  updated_at TIMESTAMPTZ NULL
);

COMMENT ON TABLE public.hairaudit_pre_surgery_projection_corrections IS
  'HA-PRE-SURGERY-PROJECTION-REPORT-1A auditor corrections against immutable illustrative projection snapshots. Internal-only; never patient-facing by default.';

CREATE INDEX IF NOT EXISTS idx_ha_pre_surgery_proj_corr_case
  ON public.hairaudit_pre_surgery_projection_corrections (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ha_pre_surgery_proj_corr_snapshot
  ON public.hairaudit_pre_surgery_projection_corrections (projection_snapshot_id, created_at DESC);

ALTER TABLE public.hairaudit_pre_surgery_projection_corrections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hairaudit_pre_surgery_projection_corrections FROM anon, authenticated;
GRANT ALL ON TABLE public.hairaudit_pre_surgery_projection_corrections TO service_role;

-- Expand audit event types for report inclusion + corrections
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
    'projection_included_in_report',
    'projection_omitted_from_report',
    'projection_correction_recorded',
    'projection_correction_adjusted',
    'projection_learning_signal_emitted',
    'report_released'
  ));
