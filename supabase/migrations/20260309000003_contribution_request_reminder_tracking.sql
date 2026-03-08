-- Contribution request lifecycle + reminder tracking fields

ALTER TABLE case_contribution_requests
  ADD COLUMN IF NOT EXISTS reminder_1_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_2_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS secure_contribution_path TEXT;

-- Keep existing data safe while extending lifecycle statuses.
ALTER TABLE case_contribution_requests
  DROP CONSTRAINT IF EXISTS case_contribution_requests_status_check;

ALTER TABLE case_contribution_requests
  ADD CONSTRAINT case_contribution_requests_status_check CHECK (
    status IN (
      'clinic_request_pending',
      'clinic_request_sent',
      'clinic_viewed_request',
      'doctor_contribution_started',
      'doctor_contribution_received',
      'benchmark_recalculated',
      'benchmark_eligible',
      'request_closed',
      'request_expired'
    )
  );
