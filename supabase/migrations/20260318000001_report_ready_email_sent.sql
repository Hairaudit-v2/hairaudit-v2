-- Idempotency for "report ready" patient notification: only send once per report.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_ready_email_sent_at TIMESTAMPTZ NULL;
COMMENT ON COLUMN reports.report_ready_email_sent_at IS 'When the patient was emailed that this report is ready; used to avoid duplicate notifications.';
