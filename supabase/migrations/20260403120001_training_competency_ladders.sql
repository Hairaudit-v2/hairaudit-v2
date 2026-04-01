-- Doctor training competency ladders: progressive milestones, trainer sign-off only.
-- Additive: new tables + columns; does not alter existing academy behavior.

-- ---------------------------------------------------------------------------
-- Trainee program anchor (4-week view uses this, else start_date)
-- ---------------------------------------------------------------------------
ALTER TABLE public.training_doctors
  ADD COLUMN IF NOT EXISTS competency_wave_start_date DATE,
  ADD COLUMN IF NOT EXISTS competency_final_readiness_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS competency_final_readiness_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.training_doctors.competency_wave_start_date IS 'Start of structured 4-week competency window for dashboard weeks';
COMMENT ON COLUMN public.training_doctors.competency_final_readiness_at IS 'Trainer explicit supervised-independence readiness timestamp';
COMMENT ON COLUMN public.training_doctors.competency_final_readiness_by IS 'Trainer who signed final readiness';

-- ---------------------------------------------------------------------------
-- Session metrics extensions (attempt capture; does not auto-sign milestones)
-- ---------------------------------------------------------------------------
ALTER TABLE public.training_case_metrics
  ADD COLUMN IF NOT EXISTS total_hairs INT,
  ADD COLUMN IF NOT EXISTS hair_to_graft_ratio NUMERIC(8, 4),
  ADD COLUMN IF NOT EXISTS observed_by_trainer BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.training_case_metrics.total_hairs IS 'Total hairs for session/day observation';
COMMENT ON COLUMN public.training_case_metrics.hair_to_graft_ratio IS 'Hairs per graft when both totals known; informational';
COMMENT ON COLUMN public.training_case_metrics.observed_by_trainer IS 'Trainer physically observed this session metrics';

-- ---------------------------------------------------------------------------
-- Ladder definitions (extensible: add rows for transection, donor mgmt, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_competency_ladders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.training_competency_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ladder_id UUID NOT NULL REFERENCES public.training_competency_ladders(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  label TEXT NOT NULL,
  short_label TEXT,
  is_target BOOLEAN NOT NULL DEFAULT FALSE,
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  criteria_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ladder_id, step_index)
);

CREATE INDEX IF NOT EXISTS training_competency_steps_ladder_idx ON public.training_competency_steps(ladder_id, step_index);

CREATE TABLE IF NOT EXISTS public.training_competency_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_doctor_id UUID NOT NULL REFERENCES public.training_doctors(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.training_competency_steps(id) ON DELETE CASCADE,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_off_by UUID NOT NULL REFERENCES auth.users(id),
  trainer_comments TEXT,
  evidence_training_case_id UUID REFERENCES public.training_cases(id) ON DELETE SET NULL,
  performance_demonstration TEXT NOT NULL DEFAULT 'not_specified'
    CHECK (performance_demonstration IN (
      'not_specified',
      'single_session_peak',
      'repeatable_across_sessions'
    )),
  capture_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (training_doctor_id, step_id)
);

CREATE INDEX IF NOT EXISTS training_competency_achievements_doctor_idx
  ON public.training_competency_achievements(training_doctor_id);

CREATE INDEX IF NOT EXISTS training_competency_achievements_step_idx
  ON public.training_competency_achievements(step_id);

DROP TRIGGER IF EXISTS trg_training_competency_achievements_updated_at ON public.training_competency_achievements;
CREATE TRIGGER trg_training_competency_achievements_updated_at
  BEFORE UPDATE ON public.training_competency_achievements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.training_competency_ladders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_competency_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_competency_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_competency_ladders_select ON public.training_competency_ladders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid())
  );

CREATE POLICY training_competency_steps_select ON public.training_competency_steps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid())
  );

CREATE POLICY training_competency_achievements_select ON public.training_competency_achievements
  FOR SELECT USING (
    public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_competency_achievements_insert ON public.training_competency_achievements
  FOR INSERT WITH CHECK (
    public.academy_has_staff_access(auth.uid())
    AND signed_off_by = auth.uid()
    AND public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_competency_achievements_update ON public.training_competency_achievements
  FOR UPDATE USING (
    public.academy_has_staff_access(auth.uid())
    AND signed_off_by = auth.uid()
    AND public.academy_can_access_training_doctor(auth.uid(), training_doctor_id)
  );

CREATE POLICY training_competency_achievements_delete ON public.training_competency_achievements
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

COMMENT ON TABLE public.training_competency_ladders IS 'Extensible competency domains (speed, ratio, punch, consistency, future ladders)';
COMMENT ON TABLE public.training_competency_steps IS 'Ordered milestones within a ladder; trainer sign-off only, no auto-complete';
COMMENT ON TABLE public.training_competency_achievements IS 'One trainer-verified achievement per trainee per step; evidence case optional';

-- ---------------------------------------------------------------------------
-- Seed core ladders (idempotent by key)
-- ---------------------------------------------------------------------------
INSERT INTO public.training_competency_ladders (key, title, description, sort_order)
VALUES
  (
    'extraction_speed',
    'Extraction speed progression',
    'Grafts extracted per hour — supervised steps to 500/hr target.',
    10
  ),
  (
    'implantation_speed',
    'Implantation speed progression',
    'Grafts implanted per hour — supervised steps to 500/hr target.',
    20
  ),
  (
    'hair_to_graft_ratio',
    'Hair-to-graft ratio progression',
    'Ratio milestones toward 1.9–2.2 target range maintained.',
    30
  ),
  (
    'punch_size',
    'Punch size competency',
    'Motorised punch sizes; core target ≤1.0 mm; sub-1.0 optional when trainer approves.',
    40
  ),
  (
    'daily_hair_output',
    'Daily hair output progression',
    'Total hairs per day observed in supervised sessions.',
    50
  ),
  (
    'consistency_repeatability',
    'Consistency / repeatability',
    'From first achievement through verified consistency across sessions.',
    60
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.training_competency_steps (ladder_id, step_index, label, short_label, is_target, is_optional, criteria_json)
SELECT l.id, v.step_index, v.label, v.short_label, v.is_target, v.is_optional, v.criteria_json::jsonb
FROM public.training_competency_ladders l
CROSS JOIN (
  VALUES
    (0, '100 grafts/hour (supervised)', '100/hr', false, false, '{"metric_key":"extraction_grafts_per_hour","min":100}'),
    (1, '200 grafts/hour', '200/hr', false, false, '{"metric_key":"extraction_grafts_per_hour","min":200}'),
    (2, '300 grafts/hour', '300/hr', false, false, '{"metric_key":"extraction_grafts_per_hour","min":300}'),
    (3, '400 grafts/hour', '400/hr', false, false, '{"metric_key":"extraction_grafts_per_hour","min":400}'),
    (4, '500 grafts/hour — target', '500/hr', true, false, '{"metric_key":"extraction_grafts_per_hour","min":500}')
) AS v(step_index, label, short_label, is_target, is_optional, criteria_json)
WHERE l.key = 'extraction_speed'
ON CONFLICT (ladder_id, step_index) DO NOTHING;

INSERT INTO public.training_competency_steps (ladder_id, step_index, label, short_label, is_target, is_optional, criteria_json)
SELECT l.id, v.step_index, v.label, v.short_label, v.is_target, v.is_optional, v.criteria_json::jsonb
FROM public.training_competency_ladders l
CROSS JOIN (
  VALUES
    (0, '100 grafts/hour (supervised)', '100/hr', false, false, '{"metric_key":"implantation_grafts_per_hour","min":100}'),
    (1, '200 grafts/hour', '200/hr', false, false, '{"metric_key":"implantation_grafts_per_hour","min":200}'),
    (2, '300 grafts/hour', '300/hr', false, false, '{"metric_key":"implantation_grafts_per_hour","min":300}'),
    (3, '400 grafts/hour', '400/hr', false, false, '{"metric_key":"implantation_grafts_per_hour","min":400}'),
    (4, '500 grafts/hour — target', '500/hr', true, false, '{"metric_key":"implantation_grafts_per_hour","min":500}')
) AS v(step_index, label, short_label, is_target, is_optional, criteria_json)
WHERE l.key = 'implantation_speed'
ON CONFLICT (ladder_id, step_index) DO NOTHING;

INSERT INTO public.training_competency_steps (ladder_id, step_index, label, short_label, is_target, is_optional, criteria_json)
SELECT l.id, v.step_index, v.label, v.short_label, v.is_target, v.is_optional, v.criteria_json::jsonb
FROM public.training_competency_ladders l
CROSS JOIN (
  VALUES
    (0, 'Ratio 1.6+', '1.6+', false, false, '{"metric_key":"hair_to_graft_ratio","min":1.6}'),
    (1, 'Ratio 1.7+', '1.7+', false, false, '{"metric_key":"hair_to_graft_ratio","min":1.7}'),
    (2, 'Ratio 1.8+', '1.8+', false, false, '{"metric_key":"hair_to_graft_ratio","min":1.8}'),
    (3, 'Ratio 1.9+', '1.9+', false, false, '{"metric_key":"hair_to_graft_ratio","min":1.9}'),
    (4, 'Ratio 1.9–2.2 target maintained', '1.9–2.2', true, false, '{"metric_key":"hair_to_graft_ratio","min":1.9,"max":2.2}')
) AS v(step_index, label, short_label, is_target, is_optional, criteria_json)
WHERE l.key = 'hair_to_graft_ratio'
ON CONFLICT (ladder_id, step_index) DO NOTHING;

INSERT INTO public.training_competency_steps (ladder_id, step_index, label, short_label, is_target, is_optional, criteria_json)
SELECT l.id, v.step_index, v.label, v.short_label, v.is_target, v.is_optional, v.criteria_json::jsonb
FROM public.training_competency_ladders l
CROSS JOIN (
  VALUES
    (0, '1.1 mm motorised punch competency', '1.1 mm', false, false, '{"punch_mm_max":1.1}'),
    (1, '1.0 mm motorised punch (core target ≤1.0 mm)', '≤1.0 mm', true, false, '{"punch_mm_max":1.0}'),
    (2, 'Sub-1.0 mm — trainer-approved advanced (optional)', '<1.0 mm', false, true, '{"punch_mm_max":0.999,"optional_advanced":true}')
) AS v(step_index, label, short_label, is_target, is_optional, criteria_json)
WHERE l.key = 'punch_size'
ON CONFLICT (ladder_id, step_index) DO NOTHING;

INSERT INTO public.training_competency_steps (ladder_id, step_index, label, short_label, is_target, is_optional, criteria_json)
SELECT l.id, v.step_index, v.label, v.short_label, v.is_target, v.is_optional, v.criteria_json::jsonb
FROM public.training_competency_ladders l
CROSS JOIN (
  VALUES
    (0, '1,500 hairs / day observed', '1.5k', false, false, '{"metric_key":"total_hairs","min":1500}'),
    (1, '2,500 hairs / day observed', '2.5k', false, false, '{"metric_key":"total_hairs","min":2500}'),
    (2, '3,500 hairs / day observed', '3.5k', false, false, '{"metric_key":"total_hairs","min":3500}'),
    (3, '4,000 hairs / day observed', '4.0k', false, false, '{"metric_key":"total_hairs","min":4000}'),
    (4, '4,500 hairs / day — target', '4.5k', true, false, '{"metric_key":"total_hairs","min":4500}')
) AS v(step_index, label, short_label, is_target, is_optional, criteria_json)
WHERE l.key = 'daily_hair_output'
ON CONFLICT (ladder_id, step_index) DO NOTHING;

INSERT INTO public.training_competency_steps (ladder_id, step_index, label, short_label, is_target, is_optional, criteria_json)
SELECT l.id, v.step_index, v.label, v.short_label, v.is_target, v.is_optional, v.criteria_json::jsonb
FROM public.training_competency_ladders l
CROSS JOIN (
  VALUES
    (0, 'Threshold achieved once (trainer-verified)', 'Once', false, false, '{"consistency":"once"}'),
    (1, 'Achieved twice (separate sessions)', 'Twice', false, false, '{"consistency":"twice"}'),
    (2, 'Achieved in 3 supervised sessions', '3 sessions', false, false, '{"consistency":"three_sessions"}'),
    (3, 'Consistently across full sessions', 'Full sessions', false, false, '{"consistency":"full_sessions"}'),
    (4, 'Final verified consistency — target', 'Verified', true, false, '{"consistency":"final_verified"}')
) AS v(step_index, label, short_label, is_target, is_optional, criteria_json)
WHERE l.key = 'consistency_repeatability'
ON CONFLICT (ladder_id, step_index) DO NOTHING;

-- Future ladders (transection rate, donor management, graft handling, angle control, hairline design,
-- patient safety / workflow): INSERT INTO training_competency_ladders (key, title, ...) then INSERT steps
-- with criteria_json describing thresholds or qualitative markers. No code change required beyond optional
-- UI hints in src/lib/academy/competency.ts suggestStepIdsFromLatestMetrics for new metric_key values.
