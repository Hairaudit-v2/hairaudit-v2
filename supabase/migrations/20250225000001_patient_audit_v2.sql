-- Patient Audit v2: structured storage for streamlined patient form
-- Backward compatible: legacy records keep using summary.patient_answers
-- New submissions store in patient_audit_v2 with version=2

ALTER TABLE reports ADD COLUMN IF NOT EXISTS patient_audit_version INT DEFAULT 1;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS patient_audit_v2 JSONB NOT NULL DEFAULT '{}';

-- Default 1 for existing rows (legacy); new inserts will set 2
COMMENT ON COLUMN reports.patient_audit_version IS '1=legacy patient_answers in summary, 2=patient_audit_v2 jsonb';
COMMENT ON COLUMN reports.patient_audit_v2 IS 'Patient audit v2 answers (streamlined form) when patient_audit_version=2';
