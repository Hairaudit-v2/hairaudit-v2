-- FI-OUTCOME-INTELLIGENCE-1C — Prospective longitudinal capture plan identity.
-- Minimal persistence: projection anchor + policy versions + procedure date.
-- Milestone status is derived at read time (not stored).
-- Service-role only. Independent of FI outcome cohort governance.

CREATE TABLE IF NOT EXISTS public.hairaudit_longitudinal_capture_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_snapshot_id UUID NOT NULL
    REFERENCES public.hairaudit_projection_snapshots(id) ON DELETE RESTRICT,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL,
  procedure_date DATE NOT NULL,
  capture_policy_version TEXT NOT NULL DEFAULT 'fi-outcome-capture-plan-v1',
  capture_protocol_version TEXT NOT NULL DEFAULT 'fi-outcome-capture-protocol-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hairaudit_longitudinal_capture_plans_policy_chk
    CHECK (capture_policy_version IN ('fi-outcome-capture-plan-v1')),
  CONSTRAINT hairaudit_longitudinal_capture_plans_protocol_chk
    CHECK (capture_protocol_version IN ('fi-outcome-capture-protocol-v1'))
);

COMMENT ON TABLE public.hairaudit_longitudinal_capture_plans IS
  'FI-OUTCOME-INTELLIGENCE-1C prospective capture plan identity. Milestone state is derived; anchored to frozen projection_snapshot_id.';

COMMENT ON COLUMN public.hairaudit_longitudinal_capture_plans.projection_snapshot_id IS
  'Longitudinal anchor — one plan identity per frozen HA-PROJECTION-1D snapshot + policy versions.';

COMMENT ON COLUMN public.hairaudit_longitudinal_capture_plans.procedure_date IS
  'Canonical procedure date frozen onto the plan for calendar-month milestone targets.';

-- Idempotent: same projection + policy + protocol → one row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hairaudit_longitudinal_capture_plans_idempotent
  ON public.hairaudit_longitudinal_capture_plans (
    projection_snapshot_id,
    capture_policy_version,
    capture_protocol_version
  );

CREATE INDEX IF NOT EXISTS idx_hairaudit_longitudinal_capture_plans_case
  ON public.hairaudit_longitudinal_capture_plans (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_longitudinal_capture_plans_patient
  ON public.hairaudit_longitudinal_capture_plans (patient_id);

ALTER TABLE public.hairaudit_longitudinal_capture_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hairaudit_longitudinal_capture_plans_service_role"
  ON public.hairaudit_longitudinal_capture_plans
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.hairaudit_longitudinal_capture_plans TO service_role;
