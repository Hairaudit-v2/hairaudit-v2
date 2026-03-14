-- Auditor rerun tracking fields for operational visibility.
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS rerun_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_rerun_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_rerun_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processing_log JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_cases_last_rerun_at ON cases(last_rerun_at DESC);
