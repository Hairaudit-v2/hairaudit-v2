-- HairAudit Mobile Surgery Upload Portal — Stage 2.2 (Clinic Linkage Hardening)
-- Adds a reliable, nullable clinic_profiles(id) reference to surgery_upload_details so
-- filtering, reporting, defaults, dashboards, and future analytics stop relying on the
-- free-text clinic_name field. clinic_name is INTENTIONALLY kept as a human-readable
-- snapshot for historical accuracy.
--
-- Design notes:
--  * clinic_profile_id is NULLABLE on purpose. Historical uploads, unlinked doctor
--    uploads, and auditor uploads without a selected clinic must remain valid.
--  * ON DELETE SET NULL: removing a clinic profile must never delete surgery evidence;
--    we simply drop the linkage and keep the clinic_name snapshot.
--  * This column is for linkage/reporting/defaults ONLY. It does NOT grant case access.
--    Case access continues to flow through surgery_upload_case_access()/canAccessCase().

-- ---------------------------------------------------------------------------
-- 1) Column + FK + index
-- ---------------------------------------------------------------------------
ALTER TABLE public.surgery_upload_details
  ADD COLUMN IF NOT EXISTS clinic_profile_id UUID
    REFERENCES public.clinic_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_surgery_upload_details_clinic_profile
  ON public.surgery_upload_details(clinic_profile_id);

COMMENT ON COLUMN public.surgery_upload_details.clinic_profile_id IS
  'Stage 2.2: nullable FK to clinic_profiles(id) for reliable clinic linkage (filtering/reporting/defaults). clinic_name is kept as a historical snapshot. Linkage does NOT grant case access.';

-- ---------------------------------------------------------------------------
-- 2) Safe backfill (confident, unambiguous only — leave NULL when uncertain)
-- ---------------------------------------------------------------------------
-- Backfill order is most-reliable-first. Identity-based links use UNIQUE
-- linked_user_id columns, so each match is guaranteed unambiguous.

-- 2a) Uploader is the clinic owner (clinic_profiles.linked_user_id = uploader).
UPDATE public.surgery_upload_details sud
SET clinic_profile_id = cp.id
FROM public.clinic_profiles cp
WHERE sud.clinic_profile_id IS NULL
  AND sud.created_by IS NOT NULL
  AND cp.linked_user_id = sud.created_by;

-- 2b) Uploader is a doctor linked to a clinic
--     (doctor_profiles.linked_user_id = uploader AND clinic_profile_id present).
UPDATE public.surgery_upload_details sud
SET clinic_profile_id = dp.clinic_profile_id
FROM public.doctor_profiles dp
WHERE sud.clinic_profile_id IS NULL
  AND sud.created_by IS NOT NULL
  AND dp.linked_user_id = sud.created_by
  AND dp.clinic_profile_id IS NOT NULL;

-- 2c) Exact clinic_name snapshot matches exactly ONE clinic profile.
--     Strict equality only (no fuzzy/trim-insensitive matching); ambiguous names
--     (more than one profile) are skipped entirely.
UPDATE public.surgery_upload_details sud
SET clinic_profile_id = m.id
FROM (
  -- COUNT(*) = 1 guarantees a single row per group, so array_agg(id))[1] is the
  -- only id. (Postgres has no MIN(uuid); this avoids needing a cast.)
  SELECT clinic_name, (array_agg(id))[1] AS id
  FROM public.clinic_profiles
  WHERE clinic_name IS NOT NULL
    AND TRIM(clinic_name) <> ''
  GROUP BY clinic_name
  HAVING COUNT(*) = 1
) m
WHERE sud.clinic_profile_id IS NULL
  AND sud.clinic_name IS NOT NULL
  AND TRIM(sud.clinic_name) <> ''
  AND sud.clinic_name = m.clinic_name;
