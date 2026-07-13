-- HA-PROD-CLAIM-ACCOUNT-INCIDENT-1A
-- Root cause (reproduced 2026-07-14): admin.updateUserById on anonymous → email
-- hits auth.users unique partial constraint users_email_partial_key (SQLSTATE 23505)
-- when the email is already registered. GoTrue/JS surfaces that as:
--   code: unexpected_failure, message: Error updating user
-- so /api/audit/claim-account returned HTTP 500 instead of email_exists.
--
-- This migration:
--  1) Adds a service_role-only email-in-use probe (auth.users is not in Data API)
--  2) Hardens handle_beta_profile for INSERT + UPDATE (null email → populated)
--  3) Restores supabase_auth_admin EXECUTE after HA-SECURITY-1 bulk REVOKE
--  4) Clears diagnostic probe email on the incident uid (case/uploads preserved)

-- ---------------------------------------------------------------------------
-- 1) Email conflict probe for claim-account pre-check
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hairaudit_auth_email_in_use(
  p_email text,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.email IS NOT NULL
      AND lower(u.email) = lower(trim(p_email))
      AND (p_exclude_user_id IS NULL OR u.id <> p_exclude_user_id)
  );
$$;

COMMENT ON FUNCTION public.hairaudit_auth_email_in_use(text, uuid) IS
  'HA-PROD-CLAIM-ACCOUNT-INCIDENT-1A: true when auth.users already holds this email (optional exclude uid). service_role only.';

REVOKE ALL ON FUNCTION public.hairaudit_auth_email_in_use(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hairaudit_auth_email_in_use(text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Profile sync trigger — INSERT (anon null email) + UPDATE (email claim)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_beta_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_role TEXT;
  resolved_name TEXT;
BEGIN
  -- Skip no-op updates that do not change identity fields we sync.
  IF TG_OP = 'UPDATE'
     AND NEW.email IS NOT DISTINCT FROM OLD.email
     AND NEW.raw_user_meta_data IS NOT DISTINCT FROM OLD.raw_user_meta_data THEN
    RETURN NEW;
  END IF;

  resolved_role := CASE
    WHEN NEW.email = 'auditor@hairaudit.com' THEN 'auditor'
    WHEN LOWER(COALESCE(NEW.raw_user_meta_data->>'role', '')) IN ('patient', 'doctor', 'clinic', 'auditor')
      THEN LOWER(NEW.raw_user_meta_data->>'role')
    ELSE 'patient'
  END;

  resolved_name := NULLIF(
    TRIM(
      COALESCE(
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        ''
      )
    ),
    ''
  );

  INSERT INTO public.profiles (id, email, name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    resolved_name,
    resolved_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    role = CASE
      WHEN public.profiles.role IN ('auditor', 'clinic', 'doctor') THEN public.profiles.role
      WHEN EXCLUDED.role = 'auditor' THEN 'auditor'
      ELSE EXCLUDED.role
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_beta_profile() IS
  'Sync public.profiles on auth.users INSERT and email/metadata UPDATE. SECURITY DEFINER; UPSERT preserves uid.';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_beta_profile();

DROP TRIGGER IF EXISTS on_auth_user_updated_profile ON auth.users;
CREATE TRIGGER on_auth_user_updated_profile
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_beta_profile();

-- Auth role must be able to EXECUTE trigger functions (PG15+ / HA-SECURITY-1 revoke).
REVOKE ALL ON FUNCTION public.handle_beta_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_beta_profile()
  TO postgres, supabase_auth_admin, service_role, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Incident recovery — clear diagnostic probe email only; preserve case/uploads
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  incident_uid constant uuid := 'd7698f54-5e0e-4ce4-9355-3910ece3ede1';
BEGIN
  -- Clear only the diagnostic @hairaudit.test probe identity/email from incident triage.
  -- Case b7ea67d0-2e72-470a-b682-939eb3653caf and uploads remain intact (same uid).
  DELETE FROM auth.identities
  WHERE user_id = incident_uid
    AND provider = 'email'
    AND COALESCE(identity_data->>'email', '') LIKE '%@hairaudit.test';

  UPDATE auth.users
  SET
    email = NULL,
    is_anonymous = true,
    updated_at = NOW()
  WHERE id = incident_uid
    AND COALESCE(email, '') LIKE '%@hairaudit.test';

  UPDATE public.profiles
  SET email = NULL, updated_at = NOW()
  WHERE id = incident_uid
    AND COALESCE(email, '') LIKE '%@hairaudit.test';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'HA-PROD-CLAIM-ACCOUNT-INCIDENT-1A recovery skipped: %', SQLERRM;
END $$;
