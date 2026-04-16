-- Primary timing + optional event counts for training case metrics (additive).

ALTER TABLE public.training_case_metrics
  ADD COLUMN IF NOT EXISTS extraction_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extraction_end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS implantation_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS implantation_end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transected_grafts_count INT,
  ADD COLUMN IF NOT EXISTS buried_grafts_count INT,
  ADD COLUMN IF NOT EXISTS popped_grafts_count INT;

COMMENT ON COLUMN public.training_case_metrics.extraction_start_time IS 'Session clock start for extraction phase (local wall time stored as timestamptz)';
COMMENT ON COLUMN public.training_case_metrics.extraction_end_time IS 'Session clock end for extraction phase';
COMMENT ON COLUMN public.training_case_metrics.implantation_start_time IS 'Session clock start for implantation phase';
COMMENT ON COLUMN public.training_case_metrics.implantation_end_time IS 'Session clock end for implantation phase';
COMMENT ON COLUMN public.training_case_metrics.transected_grafts_count IS 'Optional raw count for transection_rate derivation';
COMMENT ON COLUMN public.training_case_metrics.buried_grafts_count IS 'Optional raw count for buried_graft_rate derivation';
COMMENT ON COLUMN public.training_case_metrics.popped_grafts_count IS 'Optional raw count for popping_rate derivation';
