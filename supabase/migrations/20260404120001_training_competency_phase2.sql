-- Phase 2: step states, repeatability, observations, weekly reviews, readiness outcomes, qualitative ladders.
-- Additive only.

-- ---------------------------------------------------------------------------
-- Step repeatability configuration (per-step rules)
-- ---------------------------------------------------------------------------
ALTER TABLE public.training_competency_steps
  ADD COLUMN IF NOT EXISTS min_signed_observations INT,
  ADD COLUMN IF NOT EXISTS min_distinct_cases INT,
  ADD COLUMN IF NOT EXISTS requires_trainer_observation BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS repeatability_rule_json JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.training_competency_steps.min_signed_observations IS 'Trainer-signed observations required before target sign-off (NULL = app default)';
COMMENT ON COLUMN public.training_competency_steps.min_distinct_cases IS 'Distinct training_case_id observations required (NULL = app default)';
COMMENT ON COLUMN public.training_competency_steps.requires_trainer_observation IS 'If true, observations count only when trainer_observed';
COMMENT ON COLUMN public.training_competency_steps.repeatability_rule_json IS 'Optional extra rules; interpreted by app, not enforced in SQL';

ALTER TABLE public.training_competency_achievements
  ADD COLUMN IF NOT EXISTS single_session_override BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.training_competency_achievements.single_session_override IS 'Trainer explicit override when repeatability mins not met (targets only)';

-- Target steps: stronger repeatability defaults
-- Targets: require multi-session repeatability by default. Non-target NULLs mean no observation rows required (legacy flow).
UPDATE public.training_competency_steps s
SET
  min_signed_observations = COALESCE(s.min_signed_observations, 2),
  min_distinct_cases = COALESCE(s.min_distinct_cases, 2),
  requires_trainer_observation = TRUE
WHERE s.is_target = TRUE;

-- ---------------------------------------------------------------------------
-- Trainer-driven step state (non-signed-off workflow flags + sync when signed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_competency_step_states (
  training_doctor_id UUID NOT NULL REFERENCES public.training_doctors(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.training_competency_steps(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN (
      'not_started',
      'in_progress',
      'threshold_reached',
      'awaiting_signoff',
      'signed_off',
      'needs_repeat',
      'regressed',
      'waived_optional'
    )),
  achievement_id UUID REFERENCES public.training_competency_achievements(id) ON DELETE SET NULL,
  trainer_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (training_doctor_id, step_id)
);

CREATE INDEX IF NOT EXISTS training_competency_step_states_step_idx ON public.training_competency_step_states(step_id);

COMMENT ON TABLE public.training_competency_step_states IS 'Trainer workflow flags; signed_off mirrors achievements; other statuses are trainer-controlled or app-derived sync';

-- ---------------------------------------------------------------------------
-- Signed observations counting toward repeatability (trainer is source of truth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_competency_step_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_doctor_id UUID NOT NULL REFERENCES public.training_doctors(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.training_competency_steps(id) ON DELETE CASCADE,
  training_case_id UUID REFERENCES public.training_cases(id) ON DELETE SET NULL,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  threshold_met BOOLEAN NOT NULL DEFAULT TRUE,
  trainer_observed BOOLEAN NOT NULL DEFAULT FALSE,
  checklist_json JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_competency_step_observations_doctor_step_idx
  ON public.training_competency_step_observations(training_doctor_id, step_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Final readiness outcome (extends timestamp / by)
-- ---------------------------------------------------------------------------
ALTER TABLE public.training_doctors
  ADD COLUMN IF NOT EXISTS competency_final_readiness_status TEXT
    CHECK (
      competency_final_readiness_status IS NULL
      OR competency_final_readiness_status IN (
        'ready',
        'ready_with_limitations',
        'extended_training_required',
        'not_ready'
      )
    ),
  ADD COLUMN IF NOT EXISTS competency_final_readiness_notes TEXT,
  ADD COLUMN IF NOT EXISTS competency_restrictions_json JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.training_doctors.competency_final_readiness_status IS 'Structured surgical readiness outcome';
COMMENT ON COLUMN public.training_doctors.competency_final_readiness_notes IS 'Trainer rationale for readiness decision';
COMMENT ON COLUMN public.training_doctors.competency_restrictions_json IS 'Limitations, supervision rules, expiry, etc.';

-- ---------------------------------------------------------------------------
-- Weekly trainer reviews (1–4 aligned with competency wave)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_competency_weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_doctor_id UUID NOT NULL REFERENCES public.training_doctors(id) ON DELETE CASCADE,
  week_number INT NOT NULL CHECK (week_number >= 1 AND week_number <= 52),
  review_start_date DATE NOT NULL,
  review_end_date DATE NOT NULL,
  strengths TEXT,
  focus_areas TEXT,
  risks_or_concerns TEXT,
  recommended_next_targets TEXT,
  reviewed_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (training_doctor_id, week_number, review_start_date)
);

CREATE INDEX IF NOT EXISTS training_competency_weekly_reviews_doctor_idx
  ON public.training_competency_weekly_reviews(training_doctor_id, week_number);

DROP TRIGGER IF EXISTS trg_training_competency_weekly_reviews_updated_at ON public.training_competency_weekly_reviews;
CREATE TRIGGER trg_training_competency_weekly_reviews_updated_at
  BEFORE UPDATE ON public.training_competency_weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Backfill step states from existing achievements
-- ---------------------------------------------------------------------------
INSERT INTO public.training_competency_step_states (
  training_doctor_id,
  step_id,
  status,
  achievement_id,
  updated_by,
  updated_at
)
SELECT
  a.training_doctor_id,
  a.step_id,
  'signed_off',
  a.id,
  a.signed_off_by,
  a.achieved_at
FROM public.training_competency_achievements a
ON CONFLICT (training_doctor_id, step_id) DO UPDATE SET
  status = 'signed_off',
  achievement_id = EXCLUDED.achievement_id,
  updated_by = EXCLUDED.updated_by,
  updated_at = EXCLUDED.updated_at;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.training_competency_step_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_competency_step_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_competency_weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_competency_step_states_select ON public.training_competency_step_states
  FOR SELECT USING (
    public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_competency_step_states_insert ON public.training_competency_step_states
  FOR INSERT WITH CHECK (
    public.academy_has_staff_access(auth.uid())
    AND public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
    AND updated_by = auth.uid()
  );

CREATE POLICY training_competency_step_states_update ON public.training_competency_step_states
  FOR UPDATE USING (
    public.academy_has_staff_access(auth.uid())
    AND public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_competency_step_states_delete ON public.training_competency_step_states
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

CREATE POLICY training_competency_step_observations_select ON public.training_competency_step_observations
  FOR SELECT USING (
    public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_competency_step_observations_insert ON public.training_competency_step_observations
  FOR INSERT WITH CHECK (
    public.academy_has_staff_access(auth.uid())
    AND recorded_by = auth.uid()
    AND public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_competency_step_observations_delete ON public.training_competency_step_observations
  FOR DELETE USING (
    public.academy_has_staff_access(auth.uid())
    AND public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_competency_weekly_reviews_select ON public.training_competency_weekly_reviews
  FOR SELECT USING (
    public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_competency_weekly_reviews_insert ON public.training_competency_weekly_reviews
  FOR INSERT WITH CHECK (
    public.academy_has_staff_access(auth.uid())
    AND reviewed_by = auth.uid()
    AND public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_competency_weekly_reviews_update ON public.training_competency_weekly_reviews
  FOR UPDATE USING (
    public.academy_has_staff_access(auth.uid())
    AND public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_competency_weekly_reviews_delete ON public.training_competency_weekly_reviews
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

-- ---------------------------------------------------------------------------
-- Qualitative / hybrid ladders (seed)
-- ---------------------------------------------------------------------------
INSERT INTO public.training_competency_ladders (key, title, description, sort_order)
VALUES
  (
    'transection_control',
    'Transection control',
    'Hybrid numeric and checklist criteria for transection discipline.',
    70
  ),
  (
    'donor_management',
    'Donor management',
    'Donor zone planning, depth control, and conservation judgment.',
    80
  ),
  (
    'graft_handling_quality',
    'Graft handling quality',
    'Hydration, sorting, out-of-body time, and tray discipline.',
    90
  ),
  (
    'implantation_angle_control',
    'Implantation angle & direction',
    'Recipient site angle, direction, and density consistency.',
    100
  ),
  (
    'workflow_readiness',
    'Workflow & patient safety readiness',
    'Team communication, timeouts, ergonomics, and complication awareness.',
    110
  )
ON CONFLICT (key) DO NOTHING;

-- Transection: numeric + checklist hybrid
INSERT INTO public.training_competency_steps (
  ladder_id, step_index, label, short_label, is_target, is_optional,
  criteria_json, min_signed_observations, min_distinct_cases, requires_trainer_observation, repeatability_rule_json
)
SELECT l.id, v.step_index, v.label, v.short_label, v.is_target, v.is_optional, v.criteria_json::jsonb,
  v.min_obs, v.min_cases, v.req_obs, '{}'::jsonb
FROM public.training_competency_ladders l
CROSS JOIN (
  VALUES
    (
      0,
      'Developing — transection monitored',
      'Developing',
      false,
      false,
      '{"assessment_type":"hybrid","metric_key":"transection_rate","max":8,"checklist":[{"id":"documented_rate","label":"Transection rate documented for session"},{"id":"punch_reviewed","label":"Punch depth / alignment reviewed with trainer"}]}'::text,
      1,
      1,
      true
    ),
    (
      1,
      'Competent — transection within band',
      'Competent',
      false,
      false,
      '{"assessment_type":"hybrid","metric_key":"transection_rate","max":5,"checklist":[{"id":"stable_technique","label":"Technique adjustments applied when rate drifts"},{"id":"supervised_block","label":"Key extraction block observed by trainer"}]}'::text,
      2,
      2,
      true
    ),
    (
      2,
      'Target — transection at program target',
      'Target',
      true,
      false,
      '{"assessment_type":"hybrid","metric_key":"transection_rate","max":3,"checklist":[{"id":"sustained_performance","label":"Sustained acceptable transection across full session"},{"id":"independent_with_backup","label":"Supervised independence with immediate trainer backup plan"}]}'::text,
      2,
      2,
      true
    )
) AS v(step_index, label, short_label, is_target, is_optional, criteria_json, min_obs, min_cases, req_obs)
WHERE l.key = 'transection_control'
ON CONFLICT (ladder_id, step_index) DO NOTHING;

-- Donor management (qualitative checklist)
INSERT INTO public.training_competency_steps (
  ladder_id, step_index, label, short_label, is_target, is_optional,
  criteria_json, min_signed_observations, min_distinct_cases, requires_trainer_observation, repeatability_rule_json
)
SELECT l.id, v.step_index, v.label, v.short_label, v.is_target, v.is_optional, v.criteria_json::jsonb,
  v.min_obs, v.min_cases, v.req_obs, '{}'::jsonb
FROM public.training_competency_ladders l
CROSS JOIN (
  VALUES
    (
      0,
      'Developing — donor plan under direct guidance',
      'Developing',
      false,
      false,
      '{"assessment_type":"qualitative_checklist","checklist":[{"id":"zone_marked","label":"Donor zone marked and agreed with trainer"},{"id":"density_plan","label":"Harvest density plan stated before start"}]}'::text,
      1,
      1,
      true
    ),
    (
      1,
      'Competent — donor execution consistent',
      'Competent',
      false,
      false,
      '{"assessment_type":"qualitative_checklist","checklist":[{"id":"spacing_ok","label":"Spacing / pattern respects donor preservation"},{"id":"depth_control","label":"Depth control stable across session"}]}'::text,
      2,
      2,
      true
    ),
    (
      2,
      'Target — donor management ready for supervised independence',
      'Target',
      true,
      false,
      '{"assessment_type":"qualitative_checklist","checklist":[{"id":"complication_aware","label":"Recognises and escalates donor stress signs"},{"id":"documentation","label":"Donor documentation complete for case"}]}'::text,
      2,
      2,
      true
    )
) AS v(step_index, label, short_label, is_target, is_optional, criteria_json, min_obs, min_cases, req_obs)
WHERE l.key = 'donor_management'
ON CONFLICT (ladder_id, step_index) DO NOTHING;

-- Graft handling
INSERT INTO public.training_competency_steps (
  ladder_id, step_index, label, short_label, is_target, is_optional,
  criteria_json, min_signed_observations, min_distinct_cases, requires_trainer_observation, repeatability_rule_json
)
SELECT l.id, v.step_index, v.label, v.short_label, v.is_target, v.is_optional, v.criteria_json::jsonb,
  v.min_obs, v.min_cases, v.req_obs, '{}'::jsonb
FROM public.training_competency_ladders l
CROSS JOIN (
  VALUES
    (
      0,
      'Developing — graft handling basics',
      'Developing',
      false,
      false,
      '{"assessment_type":"qualitative_checklist","checklist":[{"id":"hydration","label":"Grafts kept hydrated per protocol"},{"id":"minimal_handling","label":"Forceps / manipulation minimised"}]}'::text,
      1,
      1,
      true
    ),
    (
      1,
      'Competent — tray discipline',
      'Competent',
      false,
      false,
      '{"assessment_type":"hybrid","metric_key":"out_of_body_time_estimate","max":120,"checklist":[{"id":"sorting_neat","label":"Sorting / counting tray organised"},{"id":"temperature","label":"Temperature control maintained"}]}'::text,
      2,
      2,
      true
    ),
    (
      2,
      'Target — graft handling at independence threshold',
      'Target',
      true,
      false,
      '{"assessment_type":"qualitative_checklist","checklist":[{"id":"oob_acceptable","label":"Out-of-body exposure acceptable for case context"},{"id":"no_red_flags","label":"No repeated crushing / dehydration incidents"}]}'::text,
      2,
      2,
      true
    )
) AS v(step_index, label, short_label, is_target, is_optional, criteria_json, min_obs, min_cases, req_obs)
WHERE l.key = 'graft_handling_quality'
ON CONFLICT (ladder_id, step_index) DO NOTHING;

-- Implantation angle
INSERT INTO public.training_competency_steps (
  ladder_id, step_index, label, short_label, is_target, is_optional,
  criteria_json, min_signed_observations, min_distinct_cases, requires_trainer_observation, repeatability_rule_json
)
SELECT l.id, v.step_index, v.label, v.short_label, v.is_target, v.is_optional, v.criteria_json::jsonb,
  v.min_obs, v.min_cases, v.req_obs, '{}'::jsonb
FROM public.training_competency_ladders l
CROSS JOIN (
  VALUES
    (
      0,
      'Developing — angles under correction',
      'Developing',
      false,
      false,
      '{"assessment_type":"qualitative_checklist","checklist":[{"id":"follows_vectors","label":"Follows planned angle vectors with correction"},{"id":"density_check","label":"Density checked with trainer periodically"}]}'::text,
      1,
      1,
      true
    ),
    (
      1,
      'Competent — stable angles',
      'Competent',
      false,
      false,
      '{"assessment_type":"qualitative_checklist","checklist":[{"id":"hairline_transition","label":"Hairline transition angles natural"},{"id":"crown_swirl","label":"Crown / swirl direction respected"}]}'::text,
      2,
      2,
      true
    ),
    (
      2,
      'Target — implantation angles at independence threshold',
      'Target',
      true,
      false,
      '{"assessment_type":"qualitative_checklist","checklist":[{"id":"full_session","label":"Angles consistent across full session"},{"id":"photo_documented","label":"Representative intra-op photos reviewed"}]}'::text,
      2,
      2,
      true
    )
) AS v(step_index, label, short_label, is_target, is_optional, criteria_json, min_obs, min_cases, req_obs)
WHERE l.key = 'implantation_angle_control'
ON CONFLICT (ladder_id, step_index) DO NOTHING;

-- Workflow readiness
INSERT INTO public.training_competency_steps (
  ladder_id, step_index, label, short_label, is_target, is_optional,
  criteria_json, min_signed_observations, min_distinct_cases, requires_trainer_observation, repeatability_rule_json
)
SELECT l.id, v.step_index, v.label, v.short_label, v.is_target, v.is_optional, v.criteria_json::jsonb,
  v.min_obs, v.min_cases, v.req_obs, '{}'::jsonb
FROM public.training_competency_ladders l
CROSS JOIN (
  VALUES
    (
      0,
      'Developing — follows supervised workflow',
      'Developing',
      false,
      false,
      '{"assessment_type":"qualitative_checklist","checklist":[{"id":"timeouts","label":"Pre-procedure checks / timeouts adhered to"},{"id":"instrument_passing","label":"Safe instrument passing and field awareness"}]}'::text,
      1,
      1,
      true
    ),
    (
      1,
      'Competent — anticipates routine issues',
      'Competent',
      false,
      false,
      '{"assessment_type":"qualitative_checklist","checklist":[{"id":"comms_clear","label":"Clear communication with team under load"},{"id":"patient_comfort","label":"Patient comfort / positioning monitored"}]}'::text,
      2,
      2,
      true
    ),
    (
      2,
      'Target — patient safety / workflow readiness',
      'Target',
      true,
      false,
      '{"assessment_type":"qualitative_checklist","checklist":[{"id":"emergency_knows","label":"Knows escalation path for complications"},{"id":"independence_plan","label":"Supervised independence plan agreed with trainer"}]}'::text,
      2,
      2,
      true
    )
) AS v(step_index, label, short_label, is_target, is_optional, criteria_json, min_obs, min_cases, req_obs)
WHERE l.key = 'workflow_readiness'
ON CONFLICT (ladder_id, step_index) DO NOTHING;
