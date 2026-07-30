-- HA-PRE-SURGERY-INTELLIGENCE-2A — Clinician-assisted image analysis, graft plans,
-- annotations, observations, illustrative projections, and bounded audit events.
-- Additive, service-role only. Does not alter patient report or HA-PROJECTION-1A–1G tables.

-- Image clinician reviews (preserve original AI values; corrections are append-only)
CREATE TABLE IF NOT EXISTS public.hairaudit_pre_surgery_image_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  image_id UUID NOT NULL,
  schema_version TEXT NOT NULL DEFAULT 'ha-pre-surgery-image-review-v1',
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hairaudit_pre_surgery_image_reviews_case_image_uq UNIQUE (case_id, image_id)
);

COMMENT ON TABLE public.hairaudit_pre_surgery_image_reviews IS
  'HA-PRE-SURGERY-INTELLIGENCE-2A clinician image reviews. Original AI classifier fields preserved inside payload.';

CREATE INDEX IF NOT EXISTS idx_ha_pre_surgery_image_reviews_case
  ON public.hairaudit_pre_surgery_image_reviews (case_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.hairaudit_pre_surgery_image_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  image_id UUID NOT NULL,
  review_id UUID NULL REFERENCES public.hairaudit_pre_surgery_image_reviews(id) ON DELETE SET NULL,
  field TEXT NOT NULL,
  previous_value JSONB,
  next_value JSONB,
  original_ai_value JSONB,
  reviewed_by TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NULL,
  model_or_ruleset_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.hairaudit_pre_surgery_image_corrections IS
  'HA-PRE-SURGERY-INTELLIGENCE-2A append-only image field corrections with original AI provenance.';

CREATE INDEX IF NOT EXISTS idx_ha_pre_surgery_image_corrections_case
  ON public.hairaudit_pre_surgery_image_corrections (case_id, created_at DESC);

-- Annotations (versioned via supersession; soft-delete)
CREATE TABLE IF NOT EXISTS public.hairaudit_pre_surgery_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  image_id UUID NOT NULL,
  schema_version TEXT NOT NULL DEFAULT 'ha-pre-surgery-annotation-v1',
  payload JSONB NOT NULL,
  supersedes_annotation_id UUID NULL
    REFERENCES public.hairaudit_pre_surgery_annotations(id) ON DELETE RESTRICT,
  deleted_at TIMESTAMPTZ NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.hairaudit_pre_surgery_annotations IS
  'HA-PRE-SURGERY-INTELLIGENCE-2A normalised clinical image annotations (AI suggestions vs clinician-approved).';

CREATE INDEX IF NOT EXISTS idx_ha_pre_surgery_annotations_case_image
  ON public.hairaudit_pre_surgery_annotations (case_id, image_id, created_at DESC);

-- Structured observations
CREATE TABLE IF NOT EXISTS public.hairaudit_pre_surgery_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT 'ha-pre-surgery-observation-v1',
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hairaudit_pre_surgery_observations_case_domain_uq UNIQUE (case_id, domain)
);

COMMENT ON TABLE public.hairaudit_pre_surgery_observations IS
  'HA-PRE-SURGERY-INTELLIGENCE-2A clinician-reviewable structured observations (AI proposed + clinician approved).';

CREATE INDEX IF NOT EXISTS idx_ha_pre_surgery_observations_case
  ON public.hairaudit_pre_surgery_observations (case_id, updated_at DESC);

-- Versioned graft plans (immutable rows; edits create new version)
CREATE TABLE IF NOT EXISTS public.hairaudit_pre_surgery_graft_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  schema_version TEXT NOT NULL DEFAULT 'ha-pre-surgery-graft-plan-v1',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'clinician_reviewed', 'approved', 'superseded')),
  checksum TEXT NOT NULL,
  payload JSONB NOT NULL,
  previous_plan_id UUID NULL
    REFERENCES public.hairaudit_pre_surgery_graft_plans(id) ON DELETE RESTRICT,
  ai_seed_plan_id UUID NULL
    REFERENCES public.hairaudit_pre_surgery_graft_plans(id) ON DELETE RESTRICT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT NULL,
  approved_at TIMESTAMPTZ NULL,
  CONSTRAINT hairaudit_pre_surgery_graft_plans_case_version_uq UNIQUE (case_id, version)
);

COMMENT ON TABLE public.hairaudit_pre_surgery_graft_plans IS
  'HA-PRE-SURGERY-INTELLIGENCE-2A versioned clinician graft plans. Historical rows are never rewritten.';

CREATE INDEX IF NOT EXISTS idx_ha_pre_surgery_graft_plans_case
  ON public.hairaudit_pre_surgery_graft_plans (case_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_ha_pre_surgery_graft_plans_active
  ON public.hairaudit_pre_surgery_graft_plans (case_id, created_at DESC)
  WHERE status IN ('draft', 'clinician_reviewed', 'approved');

-- Illustrative pre-surgery projections (not longitudinal HA-PROJECTION snapshots)
CREATE TABLE IF NOT EXISTS public.hairaudit_pre_surgery_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  graft_plan_id UUID NOT NULL
    REFERENCES public.hairaudit_pre_surgery_graft_plans(id) ON DELETE RESTRICT,
  graft_plan_version INTEGER NOT NULL,
  source_image_id UUID NOT NULL,
  mode TEXT NOT NULL
    CHECK (mode IN ('conservative', 'planned', 'optimistic_within_approved_range')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'generated',
      'validation_failed',
      'rejected',
      'approved',
      'superseded'
    )),
  engine_version TEXT NOT NULL,
  input_checksum TEXT NOT NULL,
  output_checksum TEXT NULL,
  storage_path TEXT NULL,
  payload JSONB NOT NULL,
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_at TIMESTAMPTZ NULL,
  approved_by TEXT NULL,
  approved_at TIMESTAMPTZ NULL,
  rejected_by TEXT NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL
);

COMMENT ON TABLE public.hairaudit_pre_surgery_projections IS
  'HA-PRE-SURGERY-INTELLIGENCE-2A illustrative planning projections. Distinct from hairaudit_projection_snapshots (1D).';

CREATE INDEX IF NOT EXISTS idx_ha_pre_surgery_projections_case
  ON public.hairaudit_pre_surgery_projections (case_id, requested_at DESC);

-- Bounded audit timeline (identifiers / versions only; no PHI bodies)
CREATE TABLE IF NOT EXISTS public.hairaudit_pre_surgery_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'ai_analysis_created',
      'image_role_corrected',
      'observation_confirmed',
      'observation_corrected',
      'annotation_added',
      'annotation_deleted',
      'graft_plan_edited',
      'graft_plan_approved',
      'projection_requested',
      'projection_generated',
      'projection_rejected',
      'projection_approved',
      'report_released'
    )),
  actor_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version TEXT NOT NULL DEFAULT 'ha-pre-surgery-intelligence-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.hairaudit_pre_surgery_audit_events IS
  'HA-PRE-SURGERY-INTELLIGENCE-2A bounded audit timeline. No PHI snapshot bodies.';

CREATE INDEX IF NOT EXISTS idx_ha_pre_surgery_audit_events_case
  ON public.hairaudit_pre_surgery_audit_events (case_id, created_at DESC);

-- RLS: service-role only (app-layer auth for auditors / case clinicians)
ALTER TABLE public.hairaudit_pre_surgery_image_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_pre_surgery_image_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_pre_surgery_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_pre_surgery_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_pre_surgery_graft_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_pre_surgery_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_pre_surgery_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hairaudit_pre_surgery_image_reviews_service_role"
  ON public.hairaudit_pre_surgery_image_reviews
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "hairaudit_pre_surgery_image_corrections_service_role"
  ON public.hairaudit_pre_surgery_image_corrections
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "hairaudit_pre_surgery_annotations_service_role"
  ON public.hairaudit_pre_surgery_annotations
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "hairaudit_pre_surgery_observations_service_role"
  ON public.hairaudit_pre_surgery_observations
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "hairaudit_pre_surgery_graft_plans_service_role"
  ON public.hairaudit_pre_surgery_graft_plans
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "hairaudit_pre_surgery_projections_service_role"
  ON public.hairaudit_pre_surgery_projections
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "hairaudit_pre_surgery_audit_events_service_role"
  ON public.hairaudit_pre_surgery_audit_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.hairaudit_pre_surgery_image_reviews TO service_role;
GRANT ALL ON public.hairaudit_pre_surgery_image_corrections TO service_role;
GRANT ALL ON public.hairaudit_pre_surgery_annotations TO service_role;
GRANT ALL ON public.hairaudit_pre_surgery_observations TO service_role;
GRANT ALL ON public.hairaudit_pre_surgery_graft_plans TO service_role;
GRANT ALL ON public.hairaudit_pre_surgery_projections TO service_role;
GRANT ALL ON public.hairaudit_pre_surgery_audit_events TO service_role;
