-- HA-PROJECTION-1F — Immutable projected vs observed comparison snapshots.
-- Additive, service-role only. Links frozen 1D projections to frozen 1E observations.
-- Does not alter existing patient/report flows or rewrite 1D/1E snapshots.

CREATE TABLE IF NOT EXISTS public.hairaudit_projection_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_snapshot_id UUID NOT NULL
    REFERENCES public.hairaudit_projection_snapshots(id) ON DELETE RESTRICT,
  observation_snapshot_id UUID NOT NULL
    REFERENCES public.hairaudit_projection_observations(id) ON DELETE RESTRICT,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL,

  stage TEXT NOT NULL
    CHECK (stage IN ('month_3', 'month_6', 'month_9', 'month_12')),

  comparison_status TEXT NOT NULL DEFAULT 'active'
    CHECK (comparison_status IN ('active', 'superseded')),

  comparison_schema_version TEXT NOT NULL,
  projection_schema_version TEXT NOT NULL,
  observation_schema_version TEXT NOT NULL,
  comparison_checksum TEXT NOT NULL,

  comparison_payload JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NULL,

  supersedes_comparison_id UUID NULL
    REFERENCES public.hairaudit_projection_comparisons(id) ON DELETE RESTRICT,
  superseded_by_comparison_id UUID NULL
    REFERENCES public.hairaudit_projection_comparisons(id) ON DELETE RESTRICT,
  supersession_reason_code TEXT NULL
    CHECK (
      supersession_reason_code IS NULL
      OR supersession_reason_code IN (
        'observation_correction',
        'comparison_rule_revision',
        'manual_clinical_correction'
      )
    )
);

COMMENT ON TABLE public.hairaudit_projection_comparisons IS
  'HA-PROJECTION-1F immutable projected vs observed comparison snapshots. Corrections and rule revisions supersede rather than rewrite.';

COMMENT ON COLUMN public.hairaudit_projection_comparisons.projection_snapshot_id IS
  'Frozen HA-PROJECTION-1D projection identity.';

COMMENT ON COLUMN public.hairaudit_projection_comparisons.observation_snapshot_id IS
  'Frozen HA-PROJECTION-1E observation identity. Must already belong to projection_snapshot_id.';

COMMENT ON COLUMN public.hairaudit_projection_comparisons.case_id IS
  'HairAudit procedure key (cases.id).';

COMMENT ON COLUMN public.hairaudit_projection_comparisons.patient_id IS
  'Denormalized ownership subject at comparison creation.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_comparisons_projection
  ON public.hairaudit_projection_comparisons (projection_snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_comparisons_observation
  ON public.hairaudit_projection_comparisons (observation_snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_comparisons_case
  ON public.hairaudit_projection_comparisons (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_comparisons_patient
  ON public.hairaudit_projection_comparisons (patient_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_comparisons_stage
  ON public.hairaudit_projection_comparisons (projection_snapshot_id, stage, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_comparisons_current
  ON public.hairaudit_projection_comparisons (projection_snapshot_id, observation_snapshot_id, created_at DESC)
  WHERE comparison_status = 'active';

-- Idempotent reuse: same projection + observation + content checksum.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hairaudit_projection_comparisons_idempotent
  ON public.hairaudit_projection_comparisons (
    projection_snapshot_id,
    observation_snapshot_id,
    comparison_checksum
  );

-- Append-only bounded audit events (identifiers/versions/checksums only; no PHI bodies).
CREATE TABLE IF NOT EXISTS public.hairaudit_projection_comparison_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id UUID NULL
    REFERENCES public.hairaudit_projection_comparisons(id) ON DELETE SET NULL,
  projection_snapshot_id UUID NULL
    REFERENCES public.hairaudit_projection_snapshots(id) ON DELETE SET NULL,
  observation_snapshot_id UUID NULL
    REFERENCES public.hairaudit_projection_observations(id) ON DELETE SET NULL,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  patient_id UUID NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'comparison_created',
      'comparison_reused',
      'comparison_superseded',
      'comparison_lineage_rejected',
      'comparison_ownership_rejected',
      'comparison_invalid_stage',
      'comparison_unsafe_rejected',
      'comparison_read_denied'
    )),
  actor_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.hairaudit_projection_comparison_events IS
  'HA-PROJECTION-1F bounded audit events for comparison snapshot lifecycle. No PHI comparison bodies.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_comparison_events_case
  ON public.hairaudit_projection_comparison_events (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_comparison_events_comparison
  ON public.hairaudit_projection_comparison_events (comparison_id, created_at DESC)
  WHERE comparison_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_comparison_events_projection
  ON public.hairaudit_projection_comparison_events (projection_snapshot_id, created_at DESC)
  WHERE projection_snapshot_id IS NOT NULL;

ALTER TABLE public.hairaudit_projection_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_projection_comparison_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hairaudit_projection_comparisons_service_role"
  ON public.hairaudit_projection_comparisons
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "hairaudit_projection_comparison_events_service_role"
  ON public.hairaudit_projection_comparison_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Explicit deny-by-default for PostgREST roles (service_role granted below).
REVOKE ALL ON public.hairaudit_projection_comparisons FROM anon, authenticated;
REVOKE ALL ON public.hairaudit_projection_comparison_events FROM anon, authenticated;

GRANT ALL ON public.hairaudit_projection_comparisons TO service_role;
GRANT ALL ON public.hairaudit_projection_comparison_events TO service_role;
