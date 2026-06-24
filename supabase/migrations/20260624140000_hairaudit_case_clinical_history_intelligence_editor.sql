-- HA-INTELLIGENCE-9: Clinical Intelligence Editor — extended graft/technique fields.

ALTER TABLE public.hairaudit_case_clinical_history
  ADD COLUMN IF NOT EXISTS prior_surgery_timing_note TEXT,
  ADD COLUMN IF NOT EXISTS punch_size_mm NUMERIC(4, 2),
  ADD COLUMN IF NOT EXISTS extraction_method TEXT,
  ADD COLUMN IF NOT EXISTS implantation_method TEXT,
  ADD COLUMN IF NOT EXISTS single_hair_grafts INTEGER,
  ADD COLUMN IF NOT EXISTS double_hair_grafts INTEGER,
  ADD COLUMN IF NOT EXISTS triple_hair_grafts INTEGER,
  ADD COLUMN IF NOT EXISTS quadruple_hair_grafts INTEGER,
  ADD COLUMN IF NOT EXISTS transection_rate_percent NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS survival_estimate_percent NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS donor_reserve_assessment TEXT,
  ADD COLUMN IF NOT EXISTS surgical_technique_notes TEXT;

COMMENT ON COLUMN public.hairaudit_case_clinical_history.prior_surgery_timing_note IS
  'Approximate timing when exact prior_surgery_date is unknown (e.g. Approx 2 years ago).';
