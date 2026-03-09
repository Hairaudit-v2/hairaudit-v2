-- Public clinic profile pages: slug, location, visibility
-- Only rows with profile_visible = true and clinic_slug set are shown on public /clinics/[slug]

ALTER TABLE clinic_profiles
  ADD COLUMN IF NOT EXISTS clinic_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS profile_visible BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_profiles_clinic_slug ON clinic_profiles(clinic_slug) WHERE clinic_slug IS NOT NULL;
COMMENT ON COLUMN clinic_profiles.clinic_slug IS 'URL-safe unique identifier for public profile page (e.g. /clinics/my-clinic).';
COMMENT ON COLUMN clinic_profiles.profile_visible IS 'When true and clinic_slug is set, profile is shown on public /clinics/[slug] page.';
