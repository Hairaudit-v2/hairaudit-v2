-- Doctor / Clinic contribution request system + transparency program foundation

CREATE TABLE IF NOT EXISTS clinic_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linked_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  clinic_name TEXT NOT NULL,
  clinic_email TEXT,
  participation_status TEXT NOT NULL DEFAULT 'not_started' CHECK (participation_status IN ('not_started', 'invited', 'active', 'high_transparency')),
  transparency_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  performance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  current_award_tier TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (current_award_tier IN ('VERIFIED', 'SILVER', 'GOLD', 'PLATINUM')),
  audited_case_count INT NOT NULL DEFAULT 0,
  contributed_case_count INT NOT NULL DEFAULT 0,
  benchmark_eligible_count INT NOT NULL DEFAULT 0,
  average_forensic_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  documentation_integrity_average NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_profiles_linked_user_id ON clinic_profiles(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_clinic_profiles_email ON clinic_profiles(LOWER(clinic_email));

CREATE TABLE IF NOT EXISTS doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linked_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  doctor_name TEXT NOT NULL,
  doctor_email TEXT,
  clinic_profile_id UUID REFERENCES clinic_profiles(id) ON DELETE SET NULL,
  participation_status TEXT NOT NULL DEFAULT 'not_started' CHECK (participation_status IN ('not_started', 'invited', 'active', 'high_transparency')),
  transparency_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  performance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  current_award_tier TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (current_award_tier IN ('VERIFIED', 'SILVER', 'GOLD', 'PLATINUM')),
  audited_case_count INT NOT NULL DEFAULT 0,
  contributed_case_count INT NOT NULL DEFAULT 0,
  benchmark_eligible_count INT NOT NULL DEFAULT 0,
  average_forensic_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  documentation_integrity_average NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_linked_user_id ON doctor_profiles(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_email ON doctor_profiles(LOWER(doctor_email));
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_clinic_profile_id ON doctor_profiles(clinic_profile_id);

CREATE TABLE IF NOT EXISTS case_contribution_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  requested_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clinic_profile_id UUID REFERENCES clinic_profiles(id) ON DELETE SET NULL,
  doctor_profile_id UUID REFERENCES doctor_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'clinic_request_pending' CHECK (
    status IN (
      'clinic_request_pending',
      'clinic_request_sent',
      'clinic_viewed_request',
      'doctor_contribution_started',
      'doctor_contribution_received',
      'benchmark_recalculated',
      'benchmark_eligible'
    )
  ),
  patient_consent BOOLEAN NOT NULL DEFAULT FALSE,
  secure_token_hash TEXT NOT NULL,
  secure_token_expires_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  contribution_started_at TIMESTAMPTZ,
  contribution_received_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  clinic_name_snapshot TEXT,
  doctor_name_snapshot TEXT,
  clinic_email_snapshot TEXT,
  doctor_email_snapshot TEXT,
  recipient_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  request_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  contribution_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  contribution_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  reminder_count INT NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_contrib_case_id ON case_contribution_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_case_contrib_status ON case_contribution_requests(status);
CREATE INDEX IF NOT EXISTS idx_case_contrib_token_hash ON case_contribution_requests(secure_token_hash);
CREATE INDEX IF NOT EXISTS idx_case_contrib_clinic ON case_contribution_requests(clinic_profile_id);
CREATE INDEX IF NOT EXISTS idx_case_contrib_doctor ON case_contribution_requests(doctor_profile_id);

CREATE TABLE IF NOT EXISTS clinic_award_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_profile_id UUID NOT NULL REFERENCES clinic_profiles(id) ON DELETE CASCADE,
  award_tier TEXT NOT NULL CHECK (award_tier IN ('VERIFIED', 'SILVER', 'GOLD', 'PLATINUM')),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_award_history_profile ON clinic_award_history(clinic_profile_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS doctor_award_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_profile_id UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  award_tier TEXT NOT NULL CHECK (award_tier IN ('VERIFIED', 'SILVER', 'GOLD', 'PLATINUM')),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_award_history_profile ON doctor_award_history(doctor_profile_id, awarded_at DESC);

ALTER TABLE clinic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_contribution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_award_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_award_history ENABLE ROW LEVEL SECURITY;

-- Read policies for linked profile owners; writes are done server-side via service role.
DROP POLICY IF EXISTS "clinic_profiles_select_owner" ON clinic_profiles;
CREATE POLICY "clinic_profiles_select_owner" ON clinic_profiles
  FOR SELECT USING (linked_user_id = auth.uid());

DROP POLICY IF EXISTS "doctor_profiles_select_owner" ON doctor_profiles;
CREATE POLICY "doctor_profiles_select_owner" ON doctor_profiles
  FOR SELECT USING (linked_user_id = auth.uid());

DROP POLICY IF EXISTS "case_contribution_requests_select_case_members" ON case_contribution_requests;
CREATE POLICY "case_contribution_requests_select_case_members" ON case_contribution_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM cases c
      WHERE c.id = case_contribution_requests.case_id
        AND (
          c.user_id = auth.uid()
          OR c.patient_id = auth.uid()
          OR c.doctor_id = auth.uid()
          OR c.clinic_id = auth.uid()
        )
    )
  );
