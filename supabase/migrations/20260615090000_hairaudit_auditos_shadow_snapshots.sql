-- Stage 4C — additive persistence for AuditOS shadow snapshots (read-side / internal tooling).
-- Legacy `reports.summary` remains authoritative; this table is diagnostic only.

CREATE TABLE IF NOT EXISTS public.hairaudit_auditos_shadow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  report_id UUID NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  report_version INTEGER NULL,
  snapshot_kind TEXT NOT NULL
    CHECK (snapshot_kind IN ('audit_completed', 'report_generated', 'manual_debug')),
  adapter_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_scoring JSONB NULL,
  evidence_manifest JSONB NULL,
  normalized_report JSONB NULL,
  structural_diff JSONB NULL,
  warnings TEXT[] NOT NULL DEFAULT '{}',
  source_event_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hairaudit_auditos_shadow_snapshots_automated_requires_report
    CHECK (
      (snapshot_kind IN ('audit_completed', 'report_generated') AND report_id IS NOT NULL AND report_version IS NOT NULL)
      OR snapshot_kind = 'manual_debug'
    )
);

CREATE INDEX IF NOT EXISTS idx_hairaudit_auditos_shadow_case_created
  ON public.hairaudit_auditos_shadow_snapshots (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_auditos_shadow_report_id
  ON public.hairaudit_auditos_shadow_snapshots (report_id)
  WHERE report_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hairaudit_auditos_shadow_kind
  ON public.hairaudit_auditos_shadow_snapshots (snapshot_kind);

CREATE INDEX IF NOT EXISTS idx_hairaudit_auditos_shadow_source_event
  ON public.hairaudit_auditos_shadow_snapshots (source_event_name)
  WHERE source_event_name IS NOT NULL;

-- Idempotent upserts for automated pipeline kinds (one row per case/report/version/kind).
CREATE UNIQUE INDEX IF NOT EXISTS uq_hairaudit_auditos_shadow_automated_dedupe
  ON public.hairaudit_auditos_shadow_snapshots (case_id, report_id, report_version, snapshot_kind)
  WHERE snapshot_kind IN ('audit_completed', 'report_generated');

COMMENT ON TABLE public.hairaudit_auditos_shadow_snapshots IS
  'AuditOS shadow adapter output (Stage 4C). Not authoritative; no patient-facing reads.';

-- updated_at (reuse global trigger if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_hairaudit_auditos_shadow_snapshots_updated_at
      ON public.hairaudit_auditos_shadow_snapshots;
    CREATE TRIGGER trg_hairaudit_auditos_shadow_snapshots_updated_at
      BEFORE UPDATE ON public.hairaudit_auditos_shadow_snapshots
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

ALTER TABLE public.hairaudit_auditos_shadow_snapshots ENABLE ROW LEVEL SECURITY;

-- Writes and reads use Supabase service role from server code only (no patient/public access).
CREATE POLICY "hairaudit_auditos_shadow_snapshots_service_role"
  ON public.hairaudit_auditos_shadow_snapshots
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.hairaudit_auditos_shadow_snapshots TO service_role;
