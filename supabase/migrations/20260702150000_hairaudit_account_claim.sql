-- HA-NEXUS-2: Secure account claim tokens for network-provisioned doctor shells.
-- RLS: service_role DML only. Plaintext tokens are never stored.

CREATE TABLE IF NOT EXISTS public.hairaudit_account_claim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  global_professional_id text NOT NULL,
  doctor_profile_id uuid NOT NULL REFERENCES public.doctor_profiles (id) ON DELETE CASCADE,
  external_professional_id text,
  intended_email_snapshot text NOT NULL,
  role_snapshot text NOT NULL DEFAULT 'doctor',
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  revoked_at timestamptz,
  created_by_system text NOT NULL DEFAULT 'nexus',
  created_by_user_id uuid,
  consumed_by_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hairaudit_account_claim_tokens_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT hairaudit_account_claim_tokens_token_hash_nonempty CHECK (char_length(trim(token_hash)) > 0),
  CONSTRAINT hairaudit_account_claim_tokens_global_id_nonempty CHECK (char_length(trim(global_professional_id)) > 0),
  CONSTRAINT hairaudit_account_claim_tokens_email_nonempty CHECK (char_length(trim(intended_email_snapshot)) > 0),
  CONSTRAINT hairaudit_account_claim_tokens_role_nonempty CHECK (char_length(trim(role_snapshot)) > 0)
);

COMMENT ON TABLE public.hairaudit_account_claim_tokens IS
  'Nexus: single-use hashed tokens for network doctors to claim inactive doctor shells.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_account_claim_tokens_doctor_profile_id
  ON public.hairaudit_account_claim_tokens (doctor_profile_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_account_claim_tokens_global_professional_id
  ON public.hairaudit_account_claim_tokens (global_professional_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hairaudit_account_claim_tokens_active_per_doctor
  ON public.hairaudit_account_claim_tokens (doctor_profile_id)
  WHERE claimed_at IS NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.hairaudit_account_link_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_profile_id uuid REFERENCES public.doctor_profiles (id) ON DELETE SET NULL,
  global_professional_id text,
  linked_user_id uuid,
  action text NOT NULL,
  actor_type text NOT NULL,
  actor_user_id uuid,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hairaudit_account_link_audit_action_nonempty CHECK (char_length(trim(action)) > 0),
  CONSTRAINT hairaudit_account_link_audit_actor_type_nonempty CHECK (char_length(trim(actor_type)) > 0)
);

COMMENT ON TABLE public.hairaudit_account_link_audit IS
  'Nexus: audit trail for account claim token lifecycle and linking outcomes.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_account_link_audit_doctor_profile_id
  ON public.hairaudit_account_link_audit (doctor_profile_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_account_link_audit_global_professional_id
  ON public.hairaudit_account_link_audit (global_professional_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_account_link_audit_created_at
  ON public.hairaudit_account_link_audit (created_at DESC);

DROP TRIGGER IF EXISTS trg_hairaudit_account_claim_tokens_set_updated_at ON public.hairaudit_account_claim_tokens;
CREATE TRIGGER trg_hairaudit_account_claim_tokens_set_updated_at
  BEFORE UPDATE ON public.hairaudit_account_claim_tokens
  FOR EACH ROW EXECUTE PROCEDURE public.hairaudit_nexus_set_updated_at();

ALTER TABLE public.hairaudit_account_claim_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_account_link_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.hairaudit_account_claim_tokens FROM public;
REVOKE ALL ON public.hairaudit_account_link_audit FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hairaudit_account_claim_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hairaudit_account_link_audit TO service_role;
