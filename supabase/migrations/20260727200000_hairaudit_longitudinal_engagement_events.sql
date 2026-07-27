-- FI-OUTCOME-INTELLIGENCE-1D — Longitudinal engagement / reminder events.
-- Channel-neutral decision persistence. Delivery adapters live elsewhere.
-- Service-role only. Independent of FI outcome cohort governance.

CREATE TABLE IF NOT EXISTS public.hairaudit_longitudinal_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_snapshot_id UUID NOT NULL
    REFERENCES public.hairaudit_projection_snapshots(id) ON DELETE RESTRICT,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL,
  stage TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  policy_version TEXT NOT NULL DEFAULT 'fi-outcome-engagement-v1',
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decision_at TIMESTAMPTZ NOT NULL,
  eligible_after TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  suppressed_at TIMESTAMPTZ NULL,
  suppression_code TEXT NULL,
  channel TEXT NULL,
  delivery_provider_ref TEXT NULL,
  message_key TEXT NOT NULL,
  message_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_fingerprint TEXT NOT NULL,
  milestone_status_at_decision TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_href TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hairaudit_longitudinal_engagement_events_stage_chk
    CHECK (stage IN ('month_3', 'month_6', 'month_9', 'month_12')),
  CONSTRAINT hairaudit_longitudinal_engagement_events_type_chk
    CHECK (event_type IN (
      'upcoming_window',
      'capture_due',
      'evidence_incomplete',
      'ready_for_review',
      'late_capture_recovery',
      'review_available'
    )),
  CONSTRAINT hairaudit_longitudinal_engagement_events_status_chk
    CHECK (status IN ('pending', 'delivered', 'suppressed', 'cancelled', 'failed')),
  CONSTRAINT hairaudit_longitudinal_engagement_events_policy_chk
    CHECK (policy_version IN ('fi-outcome-engagement-v1'))
);

COMMENT ON TABLE public.hairaudit_longitudinal_engagement_events IS
  'FI-OUTCOME-INTELLIGENCE-1D channel-neutral longitudinal reminder decisions. No free-text message bodies; message_key + variables only.';

COMMENT ON COLUMN public.hairaudit_longitudinal_engagement_events.dedupe_key IS
  'Deterministic idempotency key: projection + stage + eventType + policy + stateFingerprint.';

COMMENT ON COLUMN public.hairaudit_longitudinal_engagement_events.delivery_provider_ref IS
  'Internal delivery adapter reference — never expose to patient DTOs.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_hairaudit_longitudinal_engagement_events_dedupe
  ON public.hairaudit_longitudinal_engagement_events (dedupe_key);

CREATE INDEX IF NOT EXISTS idx_hairaudit_longitudinal_engagement_events_patient_decision
  ON public.hairaudit_longitudinal_engagement_events (patient_id, decision_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_longitudinal_engagement_events_projection_stage
  ON public.hairaudit_longitudinal_engagement_events (projection_snapshot_id, stage, decision_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_longitudinal_engagement_events_status
  ON public.hairaudit_longitudinal_engagement_events (status, decision_at ASC);

ALTER TABLE public.hairaudit_longitudinal_engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hairaudit_longitudinal_engagement_events_service_role"
  ON public.hairaudit_longitudinal_engagement_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.hairaudit_longitudinal_engagement_events TO service_role;

-- Explicitly no grants to anon / authenticated for direct table access.
REVOKE ALL ON public.hairaudit_longitudinal_engagement_events FROM anon;
REVOKE ALL ON public.hairaudit_longitudinal_engagement_events FROM authenticated;
