-- Phase 3C — FI image-intelligence worker job persistence (dry-run results, idempotency).
-- Background worker writes via Supabase service role only; no patient-facing reads.

CREATE TABLE IF NOT EXISTS public.fi_image_intelligence_processed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  case_id UUID NOT NULL,
  upload_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'hairaudit',
  status TEXT NOT NULL
    CHECK (status IN ('processing', 'completed', 'failed')),
  result JSONB NULL,
  error_message TEXT NULL,
  processed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fi_image_intelligence_processed_jobs_case_id
  ON public.fi_image_intelligence_processed_jobs (case_id);

CREATE INDEX IF NOT EXISTS idx_fi_image_intelligence_processed_jobs_upload_id
  ON public.fi_image_intelligence_processed_jobs (upload_id);

CREATE INDEX IF NOT EXISTS idx_fi_image_intelligence_processed_jobs_status
  ON public.fi_image_intelligence_processed_jobs (status);

COMMENT ON TABLE public.fi_image_intelligence_processed_jobs IS
  'FI image-intelligence worker idempotency and dry-run/classification results (Phase 3C). Service-role writes only.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_fi_image_intelligence_processed_jobs_updated_at
      ON public.fi_image_intelligence_processed_jobs;
    CREATE TRIGGER trg_fi_image_intelligence_processed_jobs_updated_at
      BEFORE UPDATE ON public.fi_image_intelligence_processed_jobs
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

ALTER TABLE public.fi_image_intelligence_processed_jobs ENABLE ROW LEVEL SECURITY;

-- Writes and reads use Supabase service role from background workers only.
CREATE POLICY "fi_image_intelligence_processed_jobs_service_role"
  ON public.fi_image_intelligence_processed_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.fi_image_intelligence_processed_jobs TO service_role;
