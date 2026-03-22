-- Allow auditor reruns logged with "corrected patient photos" reason.

ALTER TABLE audit_rerun_log DROP CONSTRAINT IF EXISTS audit_rerun_log_reason_check;

ALTER TABLE audit_rerun_log ADD CONSTRAINT audit_rerun_log_reason_check CHECK (reason IN (
  'new_uploads',
  'new_doctor_data',
  'failed_previous_run',
  'updated_model_or_prompt',
  'auditor_review_request',
  'data_inconsistency',
  'corrected_patient_photos'
));
