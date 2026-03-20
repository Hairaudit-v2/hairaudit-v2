-- Manual follow-up reminder sends initiated from clinic case review (Stage 10B).
-- No scheduling; clinic/coordinator only via RLS. Additive.

CREATE TABLE IF NOT EXISTS followup_reminder_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL CHECK (milestone IN (
    'day1', 'week1', 'month3', 'month6', 'month9', 'month12'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('email')),
  recipient TEXT NOT NULL,
  subject TEXT NULL,
  body TEXT NOT NULL,
  sent_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'manual_draft_send' CHECK (source = 'manual_draft_send'),
  draft_schema_version TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'failed')),
  error_message TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_followup_reminder_send_log_case_sent
  ON followup_reminder_send_log(case_id, sent_at DESC);

ALTER TABLE followup_reminder_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followup_reminder_send_log_clinic_select" ON followup_reminder_send_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = followup_reminder_send_log.case_id
        AND c.clinic_id = auth.uid()
    )
  );

CREATE POLICY "followup_reminder_send_log_clinic_insert" ON followup_reminder_send_log
  FOR INSERT WITH CHECK (
    auth.uid() = sent_by_user_id
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = followup_reminder_send_log.case_id
        AND c.clinic_id = auth.uid()
    )
  );

CREATE POLICY "followup_reminder_send_log_service_role" ON followup_reminder_send_log
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
