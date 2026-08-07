-- HA-PRE-SURGERY-PHOTOREALISTIC-OUTCOME-2A
-- Separate Graft Allocation Map / Proposed Hairline Design / Illustrative Projected Outcome.
-- local-illustrative overlays are NOT projected cosmetic outcomes.

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD COLUMN IF NOT EXISTS artifact_type TEXT;

ALTER TABLE public.hairaudit_pre_surgery_projections
  DROP CONSTRAINT IF EXISTS hairaudit_pre_surgery_projections_artifact_type_check;

ALTER TABLE public.hairaudit_pre_surgery_projections
  ADD CONSTRAINT hairaudit_pre_surgery_projections_artifact_type_check
  CHECK (
    artifact_type IS NULL
    OR artifact_type IN (
      'graft_allocation_map',
      'proposed_hairline_design',
      'illustrative_projected_outcome'
    )
  );

COMMENT ON COLUMN public.hairaudit_pre_surgery_projections.artifact_type IS
  'PHOTOREALISTIC-OUTCOME-2A product class: graft_allocation_map | proposed_hairline_design | illustrative_projected_outcome. local-illustrative-v1 maps to graft_allocation_map only.';

-- Backfill: local-illustrative (and unmarked legacy overlays) → graft_allocation_map.
-- ImagingOS rows → illustrative_projected_outcome. Never invent cosmetic outcomes from overlays.
UPDATE public.hairaudit_pre_surgery_projections
SET artifact_type = CASE
  WHEN coalesce(provider_id, '') ILIKE 'imagingos%' THEN 'illustrative_projected_outcome'
  WHEN coalesce(provider_id, '') ILIKE 'local-illustrative%' THEN 'graft_allocation_map'
  WHEN coalesce(payload->>'artifactType', '') IN (
    'graft_allocation_map',
    'proposed_hairline_design',
    'illustrative_projected_outcome'
  ) THEN payload->>'artifactType'
  ELSE 'graft_allocation_map'
END
WHERE artifact_type IS NULL;

-- Keep payload in sync for the known rejected overlay mislabelled as a projected result.
UPDATE public.hairaudit_pre_surgery_projections
SET
  artifact_type = 'graft_allocation_map',
  payload = jsonb_set(
    coalesce(payload, '{}'::jsonb),
    '{artifactType}',
    '"graft_allocation_map"'::jsonb,
    true
  )
WHERE id = 'cd51d8da-e4d7-4146-993f-23fecce838b7';

CREATE INDEX IF NOT EXISTS idx_ha_pre_surgery_projections_artifact_type
  ON public.hairaudit_pre_surgery_projections (case_id, artifact_type, requested_at DESC);
