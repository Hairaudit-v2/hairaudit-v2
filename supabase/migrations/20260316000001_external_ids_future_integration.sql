-- Optional nullable columns for future canonical ID mapping (Follicle Intelligence / Hair Longevity Institute).
-- See docs/FUTURE-INTEGRATION-ARCHITECTURE.md. No FKs to external systems; not required for any existing flow.

ALTER TABLE cases ADD COLUMN IF NOT EXISTS external_case_id TEXT NULL;
COMMENT ON COLUMN cases.external_case_id IS 'Optional global_case_id or external system reference; set only when integration is active.';

ALTER TABLE reports ADD COLUMN IF NOT EXISTS external_document_id TEXT NULL;
COMMENT ON COLUMN reports.external_document_id IS 'Optional global_document_id for report PDF when integration is active.';

ALTER TABLE clinic_profiles ADD COLUMN IF NOT EXISTS external_clinic_id TEXT NULL;
COMMENT ON COLUMN clinic_profiles.external_clinic_id IS 'Optional global_clinic_id for correlation with FI/HLI when integration is active.';

ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS external_provider_id TEXT NULL;
COMMENT ON COLUMN doctor_profiles.external_provider_id IS 'Optional global_provider_id for correlation with FI/HLI when integration is active.';
