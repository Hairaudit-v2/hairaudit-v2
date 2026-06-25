-- HA-AUDITOR-COMMS-1: auditor patient information request email audit trail.

CREATE TABLE IF NOT EXISTS patient_info_request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  auditor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN (
    'more_photos_needed',
    'procedure_details_needed',
    'medication_history_needed',
    'clinic_or_surgery_details_needed',
    'other'
  )),
  message_sent TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'failed')),
  error_message TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_info_request_log_case_sent
  ON patient_info_request_log(case_id, sent_at DESC);

ALTER TABLE patient_info_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_info_request_log_service_role" ON patient_info_request_log
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
