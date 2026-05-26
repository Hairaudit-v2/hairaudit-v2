-- Optional contact/metadata fields for auditor bulk intake flows (professional records only).

ALTER TABLE doctor_profiles
  ADD COLUMN IF NOT EXISTS intake_phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS bulk_intake_notes TEXT NULL;

ALTER TABLE clinic_profiles
  ADD COLUMN IF NOT EXISTS clinic_phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS clinic_website TEXT NULL,
  ADD COLUMN IF NOT EXISTS bulk_intake_notes TEXT NULL;

COMMENT ON COLUMN doctor_profiles.intake_phone IS 'Optional phone captured during HairAudit bulk intake (not uniqueness-enforced).';
COMMENT ON COLUMN doctor_profiles.bulk_intake_notes IS 'Auditor-facing notes captured during HairAudit bulk case intake.';
COMMENT ON COLUMN clinic_profiles.clinic_phone IS 'Optional clinic phone captured during HairAudit bulk intake.';
COMMENT ON COLUMN clinic_profiles.clinic_website IS 'Optional clinic website URL (normalized server-side where possible).';
COMMENT ON COLUMN clinic_profiles.bulk_intake_notes IS 'Auditor-facing notes captured during HairAudit bulk case intake.';
