-- Add a dedicated flag for test cases created by scripts
-- Allows easy filtering + cleanup without touching real data.

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cases_is_test
  ON cases(is_test)
  WHERE is_test = TRUE;

