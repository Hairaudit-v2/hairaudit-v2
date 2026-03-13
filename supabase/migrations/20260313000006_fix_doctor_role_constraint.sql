-- Repair doctor_profiles clinic_role constraint to allow 'doctor' default role

DO $$
BEGIN
  -- If doctor_profiles or clinic_role is not present yet, safely skip.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'doctor_profiles'
      AND column_name = 'clinic_role'
  ) THEN
    UPDATE doctor_profiles
    SET clinic_role = 'doctor'
    WHERE clinic_role IS NULL
       OR clinic_role NOT IN ('owner', 'admin', 'doctor', 'lead_surgeon', 'surgeon', 'assistant', 'coordinator', 'other');

    ALTER TABLE doctor_profiles
      DROP CONSTRAINT IF EXISTS doctor_profiles_clinic_role_check;

    ALTER TABLE doctor_profiles
      ADD CONSTRAINT doctor_profiles_clinic_role_check
      CHECK (clinic_role IN ('owner', 'admin', 'doctor', 'lead_surgeon', 'surgeon', 'assistant', 'coordinator', 'other'));

    ALTER TABLE doctor_profiles
      ALTER COLUMN clinic_role SET DEFAULT 'doctor';
  END IF;
END $$;
