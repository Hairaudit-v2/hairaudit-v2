-- Internal audit trail for auditor corrections to patient photo uploads (category, display name, exclude/restore).
-- Written via service role from Next.js API; optional RLS can be added later per environment.

CREATE TABLE IF NOT EXISTS upload_audit_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  case_id UUID NOT NULL,
  upload_id UUID NOT NULL REFERENCES uploads (id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('reassign', 'rename', 'exclude', 'restore')),
  old_category TEXT,
  new_category TEXT,
  old_display_name TEXT,
  new_display_name TEXT,
  excluded_after BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_upload_audit_corrections_case_created
  ON upload_audit_corrections (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_upload_audit_corrections_upload_created
  ON upload_audit_corrections (upload_id, created_at DESC);

COMMENT ON TABLE upload_audit_corrections IS 'Auditor/admin history for patient upload category renames, display filename edits, and audit exclusion toggles.';
