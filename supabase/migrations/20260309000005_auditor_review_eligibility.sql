-- Conditional optional auditor review: only extreme scores (or admin unlock) trigger review workflow.
-- Reports get eligibility/status/reason; UI shows review controls only when eligible.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS auditor_review_eligibility TEXT NOT NULL DEFAULT 'not_eligible'
    CHECK (auditor_review_eligibility IN ('not_eligible', 'eligible_low_score', 'eligible_high_score', 'eligible_manual_unlock')),
  ADD COLUMN IF NOT EXISTS auditor_review_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (auditor_review_status IN ('not_requested', 'available', 'in_review', 'completed', 'skipped')),
  ADD COLUMN IF NOT EXISTS auditor_review_reason TEXT
    CHECK (auditor_review_reason IS NULL OR auditor_review_reason IN ('low_score_extreme', 'high_score_extreme', 'manual_admin_unlock'));

COMMENT ON COLUMN reports.auditor_review_eligibility IS 'Derived or set: not_eligible | eligible_low_score (<60) | eligible_high_score (>90) | eligible_manual_unlock';
COMMENT ON COLUMN reports.auditor_review_status IS 'not_requested | available | in_review | completed | skipped';
COMMENT ON COLUMN reports.auditor_review_reason IS 'low_score_extreme | high_score_extreme | manual_admin_unlock when eligible';

CREATE INDEX IF NOT EXISTS idx_reports_auditor_review_eligibility
  ON reports(auditor_review_eligibility)
  WHERE auditor_review_eligibility != 'not_eligible';

CREATE INDEX IF NOT EXISTS idx_reports_auditor_review_status
  ON reports(auditor_review_status);
