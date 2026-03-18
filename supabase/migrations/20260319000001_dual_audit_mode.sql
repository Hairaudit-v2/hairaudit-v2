-- Dual audit mode: Internal Audit (private, not ranked) vs Verified Public Audit (visible, contributes to rankings).
-- Additive only: new column on cases; no changes to existing submission logic.

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS audit_mode TEXT NOT NULL DEFAULT 'internal'
  CHECK (audit_mode IN ('internal', 'public'));

COMMENT ON COLUMN cases.audit_mode IS 'internal = private Internal Audit; public = Verified Public Audit (visible, ranked).';

-- Backfill from existing visibility_scope so current behavior is preserved
UPDATE cases
SET audit_mode = CASE
  WHEN visibility_scope = 'public' THEN 'public'
  ELSE 'internal'
END
WHERE audit_mode IS NULL OR audit_mode NOT IN ('internal', 'public');

CREATE INDEX IF NOT EXISTS idx_cases_audit_mode ON cases(audit_mode);
