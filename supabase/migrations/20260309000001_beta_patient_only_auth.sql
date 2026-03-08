-- Beta auth hardening: patient-first profiles with auditor exception.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE profiles
SET role = 'patient'
WHERE role IS NULL OR role NOT IN ('patient', 'auditor');

ALTER TABLE profiles
  ALTER COLUMN role SET DEFAULT 'patient',
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'auditor'));

UPDATE profiles p
SET
  email = COALESCE(p.email, u.email),
  name = COALESCE(
    p.name,
    NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), '')
  )
FROM auth.users u
WHERE p.id = u.id;

CREATE OR REPLACE FUNCTION public.handle_beta_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), ''),
    CASE WHEN NEW.email = 'auditor@hairaudit.com' THEN 'auditor' ELSE 'patient' END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    role = CASE
      WHEN public.profiles.role = 'auditor' OR EXCLUDED.email = 'auditor@hairaudit.com' THEN 'auditor'
      ELSE 'patient'
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_beta_profile();
