-- Auditor dashboard lifecycle and classification fields for cases.

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS audit_type TEXT NOT NULL DEFAULT 'patient'
  CHECK (audit_type IN ('patient', 'doctor', 'clinic'));

-- Backfill audit_type from linked role columns when available.
UPDATE cases
SET audit_type = CASE
  WHEN clinic_id IS NOT NULL THEN 'clinic'
  WHEN doctor_id IS NOT NULL THEN 'doctor'
  ELSE 'patient'
END
WHERE audit_type IS NULL
   OR audit_type NOT IN ('patient', 'doctor', 'clinic');

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS assigned_auditor_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS auditor_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auditor_last_edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archived_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_cases_audit_type ON cases(audit_type);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_auditor_id ON cases(assigned_auditor_id);
CREATE INDEX IF NOT EXISTS idx_cases_archived_at ON cases(archived_at);
CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases(deleted_at);
