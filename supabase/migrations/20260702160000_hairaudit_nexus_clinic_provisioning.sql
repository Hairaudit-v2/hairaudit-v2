-- HA-NEXUS-3: Network clinic provisioning + secure clinic claim tokens.
-- RLS: service_role DML only. Plaintext claim tokens are never stored.

CREATE TABLE IF NOT EXISTS public.hairaudit_nexus_external_clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_clinic_id text NOT NULL,
  source_system text NOT NULL DEFAULT 'iiohr',
  source_external_id text,
  fi_tenant_id text,
  fi_clinic_id text,
  clinic_name text NOT NULL,
  primary_contact_email text NOT NULL,
  primary_contact_name text,
  country text,
  region text,
  clinic_profile_id uuid REFERENCES public.clinic_profiles (id) ON DELETE SET NULL,
  claimed_by_user_id uuid,
  nexus_created boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hairaudit_nexus_external_clinics_global_id_unique UNIQUE (global_clinic_id),
  CONSTRAINT hairaudit_nexus_external_clinics_global_id_nonempty CHECK (char_length(trim(global_clinic_id)) > 0),
  CONSTRAINT hairaudit_nexus_external_clinics_name_nonempty CHECK (char_length(trim(clinic_name)) > 0),
  CONSTRAINT hairaudit_nexus_external_clinics_email_nonempty CHECK (char_length(trim(primary_contact_email)) > 0)
);

COMMENT ON TABLE public.hairaudit_nexus_external_clinics IS
  'Nexus: network clinics provisioned into HairAudit (global_clinic_id is cross-system key).';

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_external_clinics_global_id
  ON public.hairaudit_nexus_external_clinics (global_clinic_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_external_clinics_clinic_profile_id
  ON public.hairaudit_nexus_external_clinics (clinic_profile_id);

CREATE TABLE IF NOT EXISTS public.hairaudit_nexus_clinic_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_clinic_id text NOT NULL,
  clinic_profile_id uuid REFERENCES public.clinic_profiles (id) ON DELETE SET NULL,
  approval_status text NOT NULL DEFAULT 'pending',
  provision_status text NOT NULL DEFAULT 'active',
  revoked_at timestamptz,
  suspended_at timestamptz,
  nexus_created boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hairaudit_nexus_clinic_memberships_global_id_unique UNIQUE (global_clinic_id),
  CONSTRAINT hairaudit_nexus_clinic_memberships_global_id_nonempty CHECK (char_length(trim(global_clinic_id)) > 0),
  CONSTRAINT hairaudit_nexus_clinic_memberships_approval_status_nonempty CHECK (char_length(trim(approval_status)) > 0),
  CONSTRAINT hairaudit_nexus_clinic_memberships_provision_status_nonempty CHECK (char_length(trim(provision_status)) > 0)
);

COMMENT ON TABLE public.hairaudit_nexus_clinic_memberships IS
  'Nexus: HairAudit network membership and approval lifecycle for a provisioned clinic.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_clinic_memberships_global_id
  ON public.hairaudit_nexus_clinic_memberships (global_clinic_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_clinic_memberships_clinic_profile_id
  ON public.hairaudit_nexus_clinic_memberships (clinic_profile_id);

CREATE TABLE IF NOT EXISTS public.hairaudit_nexus_clinic_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_clinic_id text NOT NULL,
  entitlement_key text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  nexus_created boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hairaudit_nexus_clinic_entitlements_global_id_nonempty CHECK (char_length(trim(global_clinic_id)) > 0),
  CONSTRAINT hairaudit_nexus_clinic_entitlements_key_nonempty CHECK (char_length(trim(entitlement_key)) > 0)
);

COMMENT ON TABLE public.hairaudit_nexus_clinic_entitlements IS
  'Nexus: entitlement keys granted to a provisioned clinic (idempotent per key).';

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_clinic_entitlements_global_id
  ON public.hairaudit_nexus_clinic_entitlements (global_clinic_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hairaudit_nexus_clinic_entitlements_active_unique
  ON public.hairaudit_nexus_clinic_entitlements (global_clinic_id, entitlement_key)
  WHERE active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_profiles_external_clinic_id_unique
  ON public.clinic_profiles (external_clinic_id)
  WHERE external_clinic_id IS NOT NULL;

-- Extend generic account claim tokens for doctor | clinic subjects.
ALTER TABLE public.hairaudit_account_claim_tokens
  ADD COLUMN IF NOT EXISTS claim_subject_type text NOT NULL DEFAULT 'doctor',
  ADD COLUMN IF NOT EXISTS clinic_profile_id uuid REFERENCES public.clinic_profiles (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS global_clinic_id text;

ALTER TABLE public.hairaudit_account_claim_tokens
  ALTER COLUMN doctor_profile_id DROP NOT NULL,
  ALTER COLUMN global_professional_id DROP NOT NULL;

ALTER TABLE public.hairaudit_account_claim_tokens
  DROP CONSTRAINT IF EXISTS hairaudit_account_claim_tokens_subject_check;

ALTER TABLE public.hairaudit_account_claim_tokens
  ADD CONSTRAINT hairaudit_account_claim_tokens_subject_check CHECK (
    (
      claim_subject_type = 'doctor'
      AND doctor_profile_id IS NOT NULL
      AND global_professional_id IS NOT NULL
      AND char_length(trim(global_professional_id)) > 0
    )
    OR (
      claim_subject_type = 'clinic'
      AND clinic_profile_id IS NOT NULL
      AND global_clinic_id IS NOT NULL
      AND char_length(trim(global_clinic_id)) > 0
    )
  );

DROP INDEX IF EXISTS idx_hairaudit_account_claim_tokens_active_per_doctor;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hairaudit_account_claim_tokens_active_per_doctor
  ON public.hairaudit_account_claim_tokens (doctor_profile_id)
  WHERE claim_subject_type = 'doctor' AND claimed_at IS NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hairaudit_account_claim_tokens_active_per_clinic
  ON public.hairaudit_account_claim_tokens (clinic_profile_id)
  WHERE claim_subject_type = 'clinic' AND claimed_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hairaudit_account_claim_tokens_clinic_profile_id
  ON public.hairaudit_account_claim_tokens (clinic_profile_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_account_claim_tokens_global_clinic_id
  ON public.hairaudit_account_claim_tokens (global_clinic_id);

ALTER TABLE public.hairaudit_account_link_audit
  ADD COLUMN IF NOT EXISTS clinic_profile_id uuid REFERENCES public.clinic_profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS global_clinic_id text;

CREATE INDEX IF NOT EXISTS idx_hairaudit_account_link_audit_clinic_profile_id
  ON public.hairaudit_account_link_audit (clinic_profile_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_account_link_audit_global_clinic_id
  ON public.hairaudit_account_link_audit (global_clinic_id);

ALTER TABLE public.hairaudit_nexus_provisioning_audit
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'doctor',
  ADD COLUMN IF NOT EXISTS global_clinic_id text;

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_provisioning_audit_global_clinic_id
  ON public.hairaudit_nexus_provisioning_audit (global_clinic_id);

DROP TRIGGER IF EXISTS trg_hairaudit_nexus_external_clinics_set_updated_at ON public.hairaudit_nexus_external_clinics;
CREATE TRIGGER trg_hairaudit_nexus_external_clinics_set_updated_at
  BEFORE UPDATE ON public.hairaudit_nexus_external_clinics
  FOR EACH ROW EXECUTE PROCEDURE public.hairaudit_nexus_set_updated_at();

DROP TRIGGER IF EXISTS trg_hairaudit_nexus_clinic_memberships_set_updated_at ON public.hairaudit_nexus_clinic_memberships;
CREATE TRIGGER trg_hairaudit_nexus_clinic_memberships_set_updated_at
  BEFORE UPDATE ON public.hairaudit_nexus_clinic_memberships
  FOR EACH ROW EXECUTE PROCEDURE public.hairaudit_nexus_set_updated_at();

DROP TRIGGER IF EXISTS trg_hairaudit_nexus_clinic_entitlements_set_updated_at ON public.hairaudit_nexus_clinic_entitlements;
CREATE TRIGGER trg_hairaudit_nexus_clinic_entitlements_set_updated_at
  BEFORE UPDATE ON public.hairaudit_nexus_clinic_entitlements
  FOR EACH ROW EXECUTE PROCEDURE public.hairaudit_nexus_set_updated_at();

ALTER TABLE public.hairaudit_nexus_external_clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_nexus_clinic_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_nexus_clinic_entitlements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.hairaudit_nexus_external_clinics FROM public;
REVOKE ALL ON public.hairaudit_nexus_clinic_memberships FROM public;
REVOKE ALL ON public.hairaudit_nexus_clinic_entitlements FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hairaudit_nexus_external_clinics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hairaudit_nexus_clinic_memberships TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hairaudit_nexus_clinic_entitlements TO service_role;
