-- Award progression: validated-case counts, volume confidence, low-score pause
-- Only award-counting cases (counts_for_awards = true) contribute to Silver/Gold/Platinum.

ALTER TABLE clinic_profiles
  ADD COLUMN IF NOT EXISTS award_progression_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS volume_confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validated_case_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provisional_high_score_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validated_high_score_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_score_case_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS benchmark_eligible_validated_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN clinic_profiles.award_progression_paused IS 'When true, tier does not advance (e.g. too many low-score validated cases).';
COMMENT ON COLUMN clinic_profiles.volume_confidence_score IS '0-100; enough validated cases to trust the pattern.';
COMMENT ON COLUMN clinic_profiles.validated_case_count IS 'Contributed cases whose latest report has counts_for_awards = true.';
COMMENT ON COLUMN clinic_profiles.provisional_high_score_count IS 'Contributed cases with provisional high score not yet counting.';
COMMENT ON COLUMN clinic_profiles.validated_high_score_count IS 'Validated cases with score >= 90.';
COMMENT ON COLUMN clinic_profiles.low_score_case_count IS 'Validated cases with score < 60 (triggers pause when >= threshold).';
COMMENT ON COLUMN clinic_profiles.benchmark_eligible_validated_count IS 'Validated cases that are benchmark-eligible.';

-- Doctor profiles: same columns for surgeon recognition
ALTER TABLE doctor_profiles
  ADD COLUMN IF NOT EXISTS award_progression_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS volume_confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validated_case_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provisional_high_score_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validated_high_score_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_score_case_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS benchmark_eligible_validated_count INT NOT NULL DEFAULT 0;
