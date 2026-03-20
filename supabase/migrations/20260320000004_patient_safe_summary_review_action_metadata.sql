-- Batch 21: additive review workflow metadata for patient-safe summary translation pilot.
-- No changes to report generation, scoring, finalize, or PDF flows.

ALTER TABLE report_narrative_translations
  ADD COLUMN IF NOT EXISTS last_review_action TEXT NULL
    CHECK (last_review_action IN ('approved', 'rejected', 'reset_review'));

ALTER TABLE report_narrative_translations
  ADD COLUMN IF NOT EXISTS last_review_action_at TIMESTAMPTZ NULL;

ALTER TABLE report_narrative_translations
  ADD COLUMN IF NOT EXISTS last_review_action_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN report_narrative_translations.last_review_action IS 'Most recent human review action taken in pilot workflow.';
COMMENT ON COLUMN report_narrative_translations.last_review_action_at IS 'Timestamp of most recent review action.';
COMMENT ON COLUMN report_narrative_translations.last_review_action_by IS 'User id that performed most recent review action.';
