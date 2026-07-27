-- HA-PROJECTION-1D — Immutable surgery-day projection snapshots with lineage.
-- Additive, service-role only. Does not alter existing patient/report flows.
-- HairAudit identity is case-centric: case_id is the procedure key; patient_id
-- is denormalized from cases for ownership checks at the application layer.

CREATE TABLE IF NOT EXISTS public.hairaudit_projection_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL,
  source_report_id UUID NULL REFERENCES public.reports(id) ON DELETE SET NULL,
  source_assessment_id TEXT NULL,

  projection_type TEXT NOT NULL
    CHECK (projection_type IN (
      'surgery_day_projection',
      'surgery_day_projection_with_baseline'
    )),
  projection_status TEXT NOT NULL DEFAULT 'active'
    CHECK (projection_status IN ('active', 'superseded')),

  reconstruction_version TEXT NOT NULL,
  projection_engine_version TEXT NOT NULL,
  snapshot_schema_version TEXT NOT NULL,
  report_template_version INTEGER NOT NULL DEFAULT 1,

  reconstruction_input_checksum TEXT NOT NULL,
  projection_input_checksum TEXT NOT NULL,
  projection_output_checksum TEXT NOT NULL,

  reconstruction_snapshot JSONB NOT NULL,
  projection_snapshot JSONB NOT NULL,
  confidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NULL,

  supersedes_projection_id UUID NULL
    REFERENCES public.hairaudit_projection_snapshots(id) ON DELETE RESTRICT,
  superseded_by_projection_id UUID NULL
    REFERENCES public.hairaudit_projection_snapshots(id) ON DELETE RESTRICT,
  lineage_root_id UUID NOT NULL,
  supersession_reason_code TEXT NULL
    CHECK (
      supersession_reason_code IS NULL
      OR supersession_reason_code IN (
        'source_correction',
        'late_surgery_data',
        'projection_rule_revision',
        'manual_clinical_correction'
      )
    ),

  CONSTRAINT hairaudit_projection_snapshots_lineage_root_chk
    CHECK (lineage_root_id IS NOT NULL)
);

COMMENT ON TABLE public.hairaudit_projection_snapshots IS
  'HA-PROJECTION-1D immutable surgery-day projection snapshots. Historical rows are never rewritten; corrections create new rows with supersession lineage.';

COMMENT ON COLUMN public.hairaudit_projection_snapshots.case_id IS
  'HairAudit procedure key (cases.id). No separate procedures table.';

COMMENT ON COLUMN public.hairaudit_projection_snapshots.patient_id IS
  'Denormalized cases.patient_id / ownership subject at snapshot creation.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_snapshots_case_created
  ON public.hairaudit_projection_snapshots (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_snapshots_patient
  ON public.hairaudit_projection_snapshots (patient_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_snapshots_lineage
  ON public.hairaudit_projection_snapshots (lineage_root_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_snapshots_current
  ON public.hairaudit_projection_snapshots (case_id, projection_type, created_at DESC)
  WHERE projection_status = 'active';

-- Idempotent reuse: same case + type + all semantic versions + content checksums.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hairaudit_projection_snapshots_idempotent
  ON public.hairaudit_projection_snapshots (
    case_id,
    projection_type,
    reconstruction_version,
    projection_engine_version,
    snapshot_schema_version,
    reconstruction_input_checksum,
    projection_output_checksum
  );

-- Append-only bounded audit events (identifiers/versions/checksums only; no PHI bodies).
CREATE TABLE IF NOT EXISTS public.hairaudit_projection_snapshot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_id UUID NULL
    REFERENCES public.hairaudit_projection_snapshots(id) ON DELETE SET NULL,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  patient_id UUID NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'projection_snapshot_created',
      'projection_snapshot_reused',
      'projection_snapshot_superseded',
      'projection_snapshot_read',
      'projection_snapshot_read_denied',
      'projection_snapshot_integrity_failed'
    )),
  actor_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.hairaudit_projection_snapshot_events IS
  'HA-PROJECTION-1D bounded audit events for projection snapshot lifecycle. No PHI snapshot bodies.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_snapshot_events_case
  ON public.hairaudit_projection_snapshot_events (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_projection_snapshot_events_projection
  ON public.hairaudit_projection_snapshot_events (projection_id, created_at DESC)
  WHERE projection_id IS NOT NULL;

ALTER TABLE public.hairaudit_projection_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_projection_snapshot_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hairaudit_projection_snapshots_service_role"
  ON public.hairaudit_projection_snapshots
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "hairaudit_projection_snapshot_events_service_role"
  ON public.hairaudit_projection_snapshot_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.hairaudit_projection_snapshots TO service_role;
GRANT ALL ON public.hairaudit_projection_snapshot_events TO service_role;
