-- Provisional high-score award safeguards and validation pathways.
-- Score >= 90 is provisional until validated (auditor, evidence, or consistency).
-- Only validated cases count toward Silver/Gold/Platinum.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS provisional_status TEXT NOT NULL DEFAULT 'none'
    CHECK (provisional_status IN ('none', 'pending_validation', 'validated_by_auditor', 'validated_by_evidence', 'validated_by_consistency', 'rejected')),
  ADD COLUMN IF NOT EXISTS counts_for_awards BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS validation_method TEXT
    CHECK (validation_method IS NULL OR validation_method IN ('auditor', 'evidence', 'consistency')),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provisional_reason TEXT,
  ADD COLUMN IF NOT EXISTS award_contribution_weight NUMERIC(5,2);

COMMENT ON COLUMN reports.provisional_status IS 'none | pending_validation (>=90) | validated_by_* | rejected';
COMMENT ON COLUMN reports.counts_for_awards IS 'True only when case is validated or score < 90';
COMMENT ON COLUMN reports.validation_method IS 'auditor | evidence | consistency when validated';
COMMENT ON COLUMN reports.award_contribution_weight IS '1.0 normal, 0 provisional unvalidated, 1.5 validated high-score, +0.25 benchmark bonus';

CREATE INDEX IF NOT EXISTS idx_reports_provisional_status
  ON reports(provisional_status)
  WHERE provisional_status != 'none';

CREATE INDEX IF NOT EXISTS idx_reports_counts_for_awards
  ON reports(counts_for_awards)
  WHERE counts_for_awards = true;
