-- Primary timing + optional count inputs for academy training case metrics.
-- Derived columns (minutes, rates, TOB estimate) remain on the same row for backward compatibility.

ALTER TABLE public.training_case_metrics
  ADD COLUMN IF NOT EXISTS extraction_start_time TIME,
  ADD COLUMN IF NOT EXISTS extraction_end_time TIME,
  ADD COLUMN IF NOT EXISTS implantation_start_time TIME,
  ADD COLUMN IF NOT EXISTS implantation_end_time TIME,
  ADD COLUMN IF NOT EXISTS transected_grafts_count INT,
  ADD COLUMN IF NOT EXISTS buried_grafts_count INT,
  ADD COLUMN IF NOT EXISTS popped_grafts_count INT;

COMMENT ON COLUMN public.training_case_metrics.extraction_start_time IS 'Local session clock time on surgery date; pairs with extraction_end_time for duration';
COMMENT ON COLUMN public.training_case_metrics.implantation_start_time IS 'Local session clock time on surgery date; pairs with implantation_end_time for duration';
COMMENT ON COLUMN public.training_case_metrics.transected_grafts_count IS 'Optional raw count; transection_rate may be derived when denominator known';
COMMENT ON COLUMN public.training_case_metrics.buried_grafts_count IS 'Optional raw count; buried_graft_rate may be derived vs grafts_extracted';
COMMENT ON COLUMN public.training_case_metrics.popped_grafts_count IS 'Optional raw count; popping_rate may be derived vs grafts_extracted';
