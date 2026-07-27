-- HA-PROJECTION-1E — Immutable longitudinal observed outcome snapshots.
-- Additive, service-role only. Attaches to hairaudit_projection_snapshots (1D).
-- Does not alter existing patient/report flows or rewrite 1D snapshots.

CREATE TABLE IF NOT EXISTS public.hairaudit_projection_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_snapshot_id UUID NOT NULL
    REFERENCES public.hairaudit_projection_snapshots(id) ON DELETE RESTRICT,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL,

  stage TEXT NOT NULL
    CHECK (stage IN ('month_3', 'month_6', 'month_9', 'month_12')),
  observed_at TIMESTAMPTZ NOT NULL,

  observation_status TEXT NOT NULL DEFAULT 'active'
    CHECK (observation_status IN ('active', 'superseded')),

  observation_schema_version TEXT NOT NULL,
  observation_lineage_version TEXT NOT NULL,
  observation_checksum TEXT NOT NULL,

  observation_payload JSONB NOT NULL,

  source_report_id UUID NULL REFERENCES public.reports(id) ON DELETE SET NULL,
  source_audit_id TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NULL,

  supersedes_observation_id UUID NULL
    REFERENCES public.hairaudit_projection_observations(id) ON DELETE RESTRICT,
  superseded_by_observation_id UUID NULL
    REFERENCES public.hairaudit_projection_observations(id) ON DELETE RESTRICT,
  supersession_reason_code TEXT NULL
    CHECK (
      supersession_reason_code IS NULL
      OR supersession_reason_code IN (
        'source_correction',
        'late_followup_data',
        'observation_rule_revision',
        'manual_clinical_correction'
      )
    )
);

COMMENT ON TABLE public.hairaudit_projection_observations IS
  'HA-PROJECTION-1E immutable longitudinal observed outcome snapshots. Attach to frozen projection_snapshot_id; corrections supersede rather than rewrite.';

COMMENT ON COLUMN public.hairaudit_projection_observations.projection_snapshot_id IS
  'Frozen HA-PROJECTION-1D projection identity. Historical observations remain attached when a newer projection supersedes.';

COMMENT ON COLUMN public.hairaudit_projection_observations.case_id IS
  'HairAudit procedure key (cases.id).';

COMMENT ON COLUMN public.hairaudit_projection_observations.patient_id IS
  'Denormalized ownership subject at observation creation.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_observations_projection
  ON public.hairaudit_projection_observations (projection_snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_observations_case
  ON public.hairaudit_projection_observations (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_observations_patient
  ON public.hairaudit_projection_observations (patient_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_observations_stage
  ON public.hairaudit_projection_observations (projection_snapshot_id, stage, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_observations_current
  ON public.hairaudit_projection_observations (projection_snapshot_id, stage, created_at DESC)
  WHERE observation_status = 'active';

-- Idempotent reuse: same projection + stage + content checksum.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hairaudit_projection_observations_idempotent
  ON public.hairaudit_projection_observations (
    projection_snapshot_id,
    stage,
    observation_checksum
  );

-- Append-only bounded audit events (identifiers/versions/checksums only; no PHI bodies).
CREATE TABLE IF NOT EXISTS public.hairaudit_projection_observation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NULL
    REFERENCES public.hairaudit_projection_observations(id) ON DELETE SET NULL,
  projection_snapshot_id UUID NULL
    REFERENCES public.hairaudit_projection_snapshots(id) ON DELETE SET NULL,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  patient_id UUID NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'observation_snapshot_created',
      'observation_snapshot_reused',
      'observation_snapshot_superseded',
      'observation_ownership_rejected',
      'observation_invalid_stage',
      'observation_invalid_evidence',
      'observation_read_denied'
    )),
  actor_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.hairaudit_projection_observation_events IS
  'HA-PROJECTION-1E bounded audit events for observation snapshot lifecycle. No PHI observation bodies.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_observation_events_case
  ON public.hairaudit_projection_observation_events (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_observation_events_observation
  ON public.hairaudit_projection_observation_events (observation_id, created_at DESC)
  WHERE observation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_observation_events_projection
  ON public.hairaudit_projection_observation_events (projection_snapshot_id, created_at DESC)
  WHERE projection_snapshot_id IS NOT NULL;

ALTER TABLE public.hairaudit_projection_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_projection_observation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hairaudit_projection_observations_service_role"
  ON public.hairaudit_projection_observations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "hairaudit_projection_observation_events_service_role"
  ON public.hairaudit_projection_observation_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Explicit deny-by-default for PostgREST roles (service_role granted below).
REVOKE ALL ON public.hairaudit_projection_observations FROM anon, authenticated;
REVOKE ALL ON public.hairaudit_projection_observation_events FROM anon, authenticated;

GRANT ALL ON public.hairaudit_projection_observations TO service_role;
GRANT ALL ON public.hairaudit_projection_observation_events TO service_role;
