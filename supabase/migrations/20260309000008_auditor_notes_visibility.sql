-- Visibility-safe auditor notes: control which notes appear in patient report vs clinic feedback.
-- Overrides get visibility_scope; section feedback already has it.

ALTER TABLE audit_score_overrides
  ADD COLUMN IF NOT EXISTS visibility_scope audit_section_visibility_scope NOT NULL DEFAULT 'internal_only';

COMMENT ON COLUMN audit_score_overrides.visibility_scope IS 'internal_only | included_in_report | included_in_clinic_feedback; only report/clinic scope notes appear in those views.';

CREATE INDEX IF NOT EXISTS idx_audit_score_overrides_visibility
  ON audit_score_overrides(visibility_scope)
  WHERE visibility_scope != 'internal_only';
