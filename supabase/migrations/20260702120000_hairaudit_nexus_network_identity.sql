-- HA-NEXUS-1: HairAudit network identity linkage (FI OS / IIOHR provisioning receiver).
-- RLS: service_role DML only on Nexus tables. Signed webhook routes use admin client.

CREATE TABLE IF NOT EXISTS public.hairaudit_nexus_external_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_professional_id text NOT NULL,
  source_system text NOT NULL DEFAULT 'iiohr',
  source_external_id text,
  email text NOT NULL,
  full_name text,
  professional_role text NOT NULL,
  training_status text,
  certification_level text,
  doctor_profile_id uuid REFERENCES public.doctor_profiles (id) ON DELETE SET NULL,
  nexus_created boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hairaudit_nexus_external_professionals_global_id_unique UNIQUE (global_professional_id),
  CONSTRAINT hairaudit_nexus_external_professionals_global_id_nonempty CHECK (char_length(trim(global_professional_id)) > 0),
  CONSTRAINT hairaudit_nexus_external_professionals_email_nonempty CHECK (char_length(trim(email)) > 0),
  CONSTRAINT hairaudit_nexus_external_professionals_role_nonempty CHECK (char_length(trim(professional_role)) > 0)
);

COMMENT ON TABLE public.hairaudit_nexus_external_professionals IS
  'Nexus: network professionals provisioned into HairAudit (global_professional_id is cross-system key).';

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_external_professionals_global_id
  ON public.hairaudit_nexus_external_professionals (global_professional_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_external_professionals_doctor_profile_id
  ON public.hairaudit_nexus_external_professionals (doctor_profile_id);

CREATE TABLE IF NOT EXISTS public.hairaudit_nexus_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_professional_id text NOT NULL,
  doctor_profile_id uuid REFERENCES public.doctor_profiles (id) ON DELETE SET NULL,
  approval_status text NOT NULL DEFAULT 'pending',
  provision_status text NOT NULL DEFAULT 'provisioned',
  revoked_at timestamptz,
  suspended_at timestamptz,
  nexus_created boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hairaudit_nexus_memberships_global_id_unique UNIQUE (global_professional_id),
  CONSTRAINT hairaudit_nexus_memberships_global_id_nonempty CHECK (char_length(trim(global_professional_id)) > 0),
  CONSTRAINT hairaudit_nexus_memberships_approval_status_nonempty CHECK (char_length(trim(approval_status)) > 0),
  CONSTRAINT hairaudit_nexus_memberships_provision_status_nonempty CHECK (char_length(trim(provision_status)) > 0)
);

COMMENT ON TABLE public.hairaudit_nexus_memberships IS
  'Nexus: HairAudit network membership and approval lifecycle for a provisioned professional.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_memberships_global_id
  ON public.hairaudit_nexus_memberships (global_professional_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_memberships_doctor_profile_id
  ON public.hairaudit_nexus_memberships (doctor_profile_id);

CREATE TABLE IF NOT EXISTS public.hairaudit_nexus_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_professional_id text NOT NULL,
  entitlement_key text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  nexus_created boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hairaudit_nexus_entitlements_global_id_nonempty CHECK (char_length(trim(global_professional_id)) > 0),
  CONSTRAINT hairaudit_nexus_entitlements_key_nonempty CHECK (char_length(trim(entitlement_key)) > 0)
);

COMMENT ON TABLE public.hairaudit_nexus_entitlements IS
  'Nexus: entitlement keys granted to a provisioned professional (idempotent per key).';

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_entitlements_global_id
  ON public.hairaudit_nexus_entitlements (global_professional_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hairaudit_nexus_entitlements_active_unique
  ON public.hairaudit_nexus_entitlements (global_professional_id, entitlement_key)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS public.hairaudit_nexus_provisioning_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_professional_id text NOT NULL,
  action_type text NOT NULL,
  payload jsonb,
  before_state jsonb,
  after_state jsonb,
  result text NOT NULL,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hairaudit_nexus_provisioning_audit_global_id_nonempty CHECK (char_length(trim(global_professional_id)) > 0),
  CONSTRAINT hairaudit_nexus_provisioning_audit_action_type_nonempty CHECK (char_length(trim(action_type)) > 0),
  CONSTRAINT hairaudit_nexus_provisioning_audit_result_nonempty CHECK (char_length(trim(result)) > 0)
);

COMMENT ON TABLE public.hairaudit_nexus_provisioning_audit IS
  'Nexus: HairAudit provisioning/rollback audit trail.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_provisioning_audit_global_id
  ON public.hairaudit_nexus_provisioning_audit (global_professional_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_nexus_provisioning_audit_created_at
  ON public.hairaudit_nexus_provisioning_audit (created_at DESC);

-- Durable network anchor on doctor_profiles (may already exist from prior migration)
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_profiles_external_provider_id_unique
  ON public.doctor_profiles (external_provider_id)
  WHERE external_provider_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.hairaudit_nexus_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hairaudit_nexus_external_professionals_set_updated_at ON public.hairaudit_nexus_external_professionals;
CREATE TRIGGER trg_hairaudit_nexus_external_professionals_set_updated_at
  BEFORE UPDATE ON public.hairaudit_nexus_external_professionals
  FOR EACH ROW EXECUTE PROCEDURE public.hairaudit_nexus_set_updated_at();

DROP TRIGGER IF EXISTS trg_hairaudit_nexus_memberships_set_updated_at ON public.hairaudit_nexus_memberships;
CREATE TRIGGER trg_hairaudit_nexus_memberships_set_updated_at
  BEFORE UPDATE ON public.hairaudit_nexus_memberships
  FOR EACH ROW EXECUTE PROCEDURE public.hairaudit_nexus_set_updated_at();

DROP TRIGGER IF EXISTS trg_hairaudit_nexus_entitlements_set_updated_at ON public.hairaudit_nexus_entitlements;
CREATE TRIGGER trg_hairaudit_nexus_entitlements_set_updated_at
  BEFORE UPDATE ON public.hairaudit_nexus_entitlements
  FOR EACH ROW EXECUTE PROCEDURE public.hairaudit_nexus_set_updated_at();

ALTER TABLE public.hairaudit_nexus_external_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_nexus_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_nexus_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_nexus_provisioning_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.hairaudit_nexus_external_professionals FROM public;
REVOKE ALL ON public.hairaudit_nexus_memberships FROM public;
REVOKE ALL ON public.hairaudit_nexus_entitlements FROM public;
REVOKE ALL ON public.hairaudit_nexus_provisioning_audit FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hairaudit_nexus_external_professionals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hairaudit_nexus_memberships TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hairaudit_nexus_entitlements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hairaudit_nexus_provisioning_audit TO service_role;
