-- HA-AUTH-HANDOFF-FIX: single-use hashed tokens to transfer anon-owned intake
-- drafts to an existing registered patient after sign-in. Service-role DML only.
-- Plaintext tokens are never stored.

CREATE TABLE IF NOT EXISTS public.hairaudit_intake_case_handoff_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  from_owner_id uuid NOT NULL,
  intended_email_snapshot text NOT NULL,
  pathway_snapshot text NOT NULL,
  return_path text NOT NULL,
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  revoked_at timestamptz,
  consumed_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hairaudit_intake_case_handoff_tokens_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT hairaudit_intake_case_handoff_tokens_token_hash_nonempty CHECK (char_length(trim(token_hash)) > 0),
  CONSTRAINT hairaudit_intake_case_handoff_tokens_email_nonempty CHECK (char_length(trim(intended_email_snapshot)) > 0),
  CONSTRAINT hairaudit_intake_case_handoff_tokens_pathway_nonempty CHECK (char_length(trim(pathway_snapshot)) > 0),
  CONSTRAINT hairaudit_intake_case_handoff_tokens_return_path_internal CHECK (
    return_path LIKE '/%' AND return_path NOT LIKE '//%' AND position(':' in return_path) = 0
  )
);

COMMENT ON TABLE public.hairaudit_intake_case_handoff_tokens IS
  'HA-AUTH-HANDOFF-FIX: single-use hashed tokens for existing-account intake case claim after sign-in.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_intake_case_handoff_tokens_case_id
  ON public.hairaudit_intake_case_handoff_tokens (case_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_intake_case_handoff_tokens_from_owner
  ON public.hairaudit_intake_case_handoff_tokens (from_owner_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hairaudit_intake_case_handoff_tokens_active_per_case
  ON public.hairaudit_intake_case_handoff_tokens (case_id)
  WHERE claimed_at IS NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.hairaudit_intake_case_ownership_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  from_user_id uuid,
  to_user_id uuid,
  action text NOT NULL,
  actor_user_id uuid,
  reason text,
  pathway_snapshot text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hairaudit_intake_case_ownership_audit_action_nonempty CHECK (char_length(trim(action)) > 0)
);

COMMENT ON TABLE public.hairaudit_intake_case_ownership_audit IS
  'HA-AUTH-HANDOFF-FIX: audit trail for intake case ownership transfers and handoff outcomes.';

CREATE INDEX IF NOT EXISTS idx_hairaudit_intake_case_ownership_audit_case_id
  ON public.hairaudit_intake_case_ownership_audit (case_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_intake_case_ownership_audit_created_at
  ON public.hairaudit_intake_case_ownership_audit (created_at DESC);

-- Reuse nexus updated_at helper when present; otherwise no-op trigger omitted.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'hairaudit_nexus_set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_hairaudit_intake_case_handoff_tokens_set_updated_at
      ON public.hairaudit_intake_case_handoff_tokens;
    CREATE TRIGGER trg_hairaudit_intake_case_handoff_tokens_set_updated_at
      BEFORE UPDATE ON public.hairaudit_intake_case_handoff_tokens
      FOR EACH ROW EXECUTE PROCEDURE public.hairaudit_nexus_set_updated_at();
  END IF;
END $$;

ALTER TABLE public.hairaudit_intake_case_handoff_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_intake_case_ownership_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.hairaudit_intake_case_handoff_tokens FROM public;
REVOKE ALL ON public.hairaudit_intake_case_ownership_audit FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hairaudit_intake_case_handoff_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hairaudit_intake_case_ownership_audit TO service_role;
