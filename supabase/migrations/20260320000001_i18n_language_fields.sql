-- i18n foundation: user UI preference + clinic default (for future clinic/admin UIs)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en';

COMMENT ON COLUMN profiles.preferred_language IS 'BCP-47 style UI locale (e.g. en, es). Default en.';

ALTER TABLE clinic_profiles
  ADD COLUMN IF NOT EXISTS default_language TEXT NOT NULL DEFAULT 'en';

COMMENT ON COLUMN clinic_profiles.default_language IS 'Default UI/report locale for clinic-scoped experiences; foundation only.';
