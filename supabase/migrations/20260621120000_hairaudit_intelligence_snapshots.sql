-- HA-INTELLIGENCE-7 — historical intelligence snapshot persistence.
-- Stores advisory clinical-intelligence metadata per report/case so future
-- phases can compare progression over time. Diagnostic / professional only:
-- never patient-readable, never authoritative over `reports.summary`.

CREATE TABLE IF NOT EXISTS public.hairaudit_intelligence_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  report_id UUID NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  report_version INTEGER NULL,
  engine_version TEXT NOT NULL,
  -- Advisory bands for fast progression querying (not patient-facing).
  overall_severity TEXT NOT NULL,
  overall_confidence TEXT NOT NULL,
  classifier_source TEXT NULL,
  execution_mode TEXT NULL,
  -- Per-engine raw metadata bundle (classification, fields, severity, confidence,
  -- clinicianNotes, suggestedNextStep). PII-free; image storage paths excluded.
  engine_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Snapshot of the calm patient observations rendered at generation time, for
  -- progression comparison and audit of what the patient saw.
  patient_observations JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_event_name TEXT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hairaudit_intelligence_snapshots_case_generated
  ON public.hairaudit_intelligence_snapshots (case_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_intelligence_snapshots_report_id
  ON public.hairaudit_intelligence_snapshots (report_id)
  WHERE report_id IS NOT NULL;

-- One snapshot row per case/report/version/engine_version for idempotent upserts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hairaudit_intelligence_snapshots_dedupe
  ON public.hairaudit_intelligence_snapshots (case_id, report_id, report_version, engine_version)
  WHERE report_id IS NOT NULL AND report_version IS NOT NULL;

COMMENT ON TABLE public.hairaudit_intelligence_snapshots IS
  'HA-INTELLIGENCE-7 historical intelligence metadata. Not authoritative; no patient-facing reads.';

-- updated_at (reuse global trigger if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_hairaudit_intelligence_snapshots_updated_at
      ON public.hairaudit_intelligence_snapshots;
    CREATE TRIGGER trg_hairaudit_intelligence_snapshots_updated_at
      BEFORE UPDATE ON public.hairaudit_intelligence_snapshots
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

ALTER TABLE public.hairaudit_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

-- Writes and reads use Supabase service role from server code only.
CREATE POLICY "hairaudit_intelligence_snapshots_service_role"
  ON public.hairaudit_intelligence_snapshots
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.hairaudit_intelligence_snapshots TO service_role;
