-- Profiles: stores user role (patient, doctor, clinic, auditor)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'clinic', 'auditor')),
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Note: Auditor full access is enforced in app logic using service role where needed

-- Add doctor_id, clinic_id, patient_id to cases (for role-based case ownership)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES auth.users(id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES auth.users(id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES auth.users(id);

-- Profile creation is done by the app via POST /api/profiles (uses service role, bypasses RLS).
-- No trigger on auth.users - avoids RLS blocking during signup.
