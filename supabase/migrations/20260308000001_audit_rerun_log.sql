-- Audit rerun trail: who triggered what, when, and why.
-- Ensures all auditor reruns are logged and auditable.

CREATE TABLE IF NOT EXISTS audit_rerun_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'regenerate_ai_audit',
    'regenerate_graft_integrity',
    'rebuild_pdf',
    'full_reaudit'
  )),
  triggered_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  triggered_role TEXT NOT NULL DEFAULT 'auditor' CHECK (triggered_role IN ('auditor', 'admin')),
  reason TEXT NOT NULL CHECK (reason IN (
    'new_uploads',
    'new_doctor_data',
    'failed_previous_run',
    'updated_model_or_prompt',
    'auditor_review_request',
    'data_inconsistency'
  )),
  notes TEXT NULL,
  source_report_version INT NULL,
  target_report_version INT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_rerun_log_case_id ON audit_rerun_log(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_rerun_log_created_at ON audit_rerun_log(created_at DESC);

ALTER TABLE audit_rerun_log ENABLE ROW LEVEL SECURITY;

-- Only auditors and service role can read/write
CREATE POLICY "audit_rerun_log_auditor_select" ON audit_rerun_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'auditor'
    )
  );

CREATE POLICY "audit_rerun_log_auditor_insert" ON audit_rerun_log
  FOR INSERT WITH CHECK (
    auth.uid() = triggered_by
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'auditor')
  );

CREATE POLICY "audit_rerun_log_service_role" ON audit_rerun_log
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
