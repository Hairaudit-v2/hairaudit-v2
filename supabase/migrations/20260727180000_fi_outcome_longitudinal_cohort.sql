-- FI-OUTCOME-INTELLIGENCE-1A — De-identified longitudinal cohort foundation.
-- Additive analytics table. Does not alter HA-PROJECTION 1D/1E/1F source tables.
-- Service-role only. No PHI / raw patient or case identifiers.

CREATE TABLE IF NOT EXISTS public.fi_outcome_longitudinal_cohort (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cohort_subject_key TEXT NOT NULL,
  cohort_procedure_key TEXT NOT NULL,
  cohort_partition_key TEXT NOT NULL,

  projection_snapshot_checksum TEXT NOT NULL,
  observation_snapshot_checksum TEXT NOT NULL,
  comparison_snapshot_checksum TEXT NOT NULL,

  projection_schema_version TEXT NOT NULL,
  observation_schema_version TEXT NOT NULL,
  comparison_schema_version TEXT NOT NULL,
  cohort_schema_version TEXT NOT NULL DEFAULT 'fi-outcome-cohort-v1',

  followup_stage TEXT NOT NULL
    CHECK (followup_stage IN ('month_3', 'month_6', 'month_9', 'month_12')),

  comparison_status TEXT NOT NULL
    CHECK (comparison_status IN (
      'consistent',
      'partially_consistent',
      'divergent',
      'not_yet_assessable',
      'insufficient_evidence'
    )),

  projection_domain TEXT NOT NULL
    CHECK (projection_domain IN (
      'frontal_framing',
      'density_distribution',
      'transition_characteristics',
      'native_hair_dependency',
      'untreated_or_lower_treatment_areas'
    )),

  projection_confidence_band TEXT NOT NULL
    CHECK (projection_confidence_band IN ('low', 'moderate', 'high')),
  observation_confidence_band TEXT NOT NULL
    CHECK (observation_confidence_band IN ('low', 'moderate', 'high')),
  comparison_confidence_band TEXT NOT NULL
    CHECK (comparison_confidence_band IN ('low', 'moderate', 'high')),

  assessment_mode TEXT NOT NULL
    CHECK (assessment_mode IN (
      'surgery_day_only',
      'baseline_plus_surgery_day',
      'unknown'
    )),
  baseline_available BOOLEAN NOT NULL DEFAULT false,

  procedure_type_normalized TEXT NOT NULL
    CHECK (procedure_type_normalized IN (
      'fue', 'fut', 'combo', 'other', 'unknown'
    )),
  graft_count_band TEXT NOT NULL
    CHECK (graft_count_band IN (
      'under_1500', '1500_2499', '2500_3499', '3500_4499', '4500_plus', 'unknown'
    )),
  hairs_per_graft_band TEXT NOT NULL
    CHECK (hairs_per_graft_band IN (
      'under_1_8', '1_8_to_2_1', '2_1_to_2_4', 'over_2_4', 'unknown'
    )),
  punch_size_band TEXT NOT NULL
    CHECK (punch_size_band IN (
      'under_0_8', '0_8_to_0_89', '0_9_to_0_99', '1_0_plus', 'unknown'
    )),

  treated_hairline BOOLEAN NOT NULL DEFAULT false,
  treated_temples BOOLEAN NOT NULL DEFAULT false,
  treated_frontal BOOLEAN NOT NULL DEFAULT false,
  treated_forelock BOOLEAN NOT NULL DEFAULT false,
  treated_mid_scalp BOOLEAN NOT NULL DEFAULT false,
  treated_crown BOOLEAN NOT NULL DEFAULT false,

  donor_evidence_available BOOLEAN NOT NULL DEFAULT false,
  evidence_completeness_band TEXT NOT NULL
    CHECK (evidence_completeness_band IN ('low', 'moderate', 'high')),

  is_current_source_lineage BOOLEAN NOT NULL DEFAULT true,
  row_checksum TEXT NOT NULL,

  source_generated_at TIMESTAMPTZ NULL,
  source_superseded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.fi_outcome_longitudinal_cohort IS
  'FI-OUTCOME-INTELLIGENCE-1A de-identified longitudinal cohort rows derived from frozen HA-PROJECTION 1D/1E/1F. Analytics-safe only; no PHI.';

COMMENT ON COLUMN public.fi_outcome_longitudinal_cohort.cohort_subject_key IS
  'HMAC-SHA256 pseudonymous subject key (fi-outcome-patient-v1). Never raw patient_id.';

COMMENT ON COLUMN public.fi_outcome_longitudinal_cohort.cohort_procedure_key IS
  'HMAC-SHA256 pseudonymous procedure key (fi-outcome-procedure-v1). Never raw case_id.';

COMMENT ON COLUMN public.fi_outcome_longitudinal_cohort.cohort_partition_key IS
  'HMAC partition key for deployment-local isolation. No raw tenant/clinic identity.';

COMMENT ON COLUMN public.fi_outcome_longitudinal_cohort.is_current_source_lineage IS
  'True when source 1F comparison is the current active lineage for this procedure/domain.';

-- Idempotency: procedure + source checksums + domain + schema version
CREATE UNIQUE INDEX IF NOT EXISTS uq_fi_outcome_longitudinal_cohort_idempotent
  ON public.fi_outcome_longitudinal_cohort (
    cohort_procedure_key,
    projection_snapshot_checksum,
    observation_snapshot_checksum,
    comparison_snapshot_checksum,
    projection_domain,
    cohort_schema_version
  );

CREATE INDEX IF NOT EXISTS idx_fi_outcome_cohort_current_stage_domain
  ON public.fi_outcome_longitudinal_cohort (
    followup_stage,
    projection_domain,
    comparison_status
  )
  WHERE is_current_source_lineage = true;

CREATE INDEX IF NOT EXISTS idx_fi_outcome_cohort_procedure_current
  ON public.fi_outcome_longitudinal_cohort (cohort_procedure_key)
  WHERE is_current_source_lineage = true;

CREATE INDEX IF NOT EXISTS idx_fi_outcome_cohort_partition
  ON public.fi_outcome_longitudinal_cohort (cohort_partition_key, created_at DESC);

-- Bounded audit events (pseudonymous keys only — no raw patient/case IDs)
CREATE TABLE IF NOT EXISTS public.fi_outcome_cohort_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_row_id UUID NULL
    REFERENCES public.fi_outcome_longitudinal_cohort(id) ON DELETE SET NULL,
  cohort_procedure_key TEXT NULL,
  cohort_subject_key TEXT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'cohort_materialization_created',
      'cohort_materialization_reused',
      'cohort_source_lineage_superseded',
      'cohort_backfill_batch_completed',
      'cohort_deidentification_rejected',
      'cohort_governance_gate_blocked',
      'cohort_missing_secret_blocked',
      'cohort_feature_disabled',
      'cohort_lineage_rejected'
    )),
  actor_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.fi_outcome_cohort_events IS
  'FI-OUTCOME-INTELLIGENCE-1A bounded cohort audit events. Pseudonymous keys only; no PHI.';

CREATE INDEX IF NOT EXISTS idx_fi_outcome_cohort_events_procedure
  ON public.fi_outcome_cohort_events (cohort_procedure_key, created_at DESC)
  WHERE cohort_procedure_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fi_outcome_cohort_events_type
  ON public.fi_outcome_cohort_events (event_type, created_at DESC);

ALTER TABLE public.fi_outcome_longitudinal_cohort ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fi_outcome_cohort_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fi_outcome_longitudinal_cohort_service_role"
  ON public.fi_outcome_longitudinal_cohort
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "fi_outcome_cohort_events_service_role"
  ON public.fi_outcome_cohort_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.fi_outcome_longitudinal_cohort FROM anon, authenticated;
REVOKE ALL ON public.fi_outcome_cohort_events FROM anon, authenticated;

GRANT ALL ON public.fi_outcome_longitudinal_cohort TO service_role;
GRANT ALL ON public.fi_outcome_cohort_events TO service_role;
