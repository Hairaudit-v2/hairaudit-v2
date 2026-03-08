-- Manual auditor adjustment system
-- Enables auditors to override AI domain scores, record reasons, and leave section-level feedback.
-- All changes preserved in audit trail; AI output never overwritten.

-- Enum types for constrained values
CREATE TYPE audit_score_reason_category AS ENUM (
  'ai_overestimated',
  'ai_underestimated',
  'missing_documentation',
  'image_quality_issue',
  'conflicting_evidence',
  'clinic_contribution_clarified',
  'medical_nuance',
  'benchmark_rule_exception',
  'auditor_judgment'
);

CREATE TYPE audit_section_visibility_scope AS ENUM (
  'internal_only',
  'included_in_report',
  'included_in_clinic_feedback'
);

-- 1) audit_score_overrides: one override per domain per report
CREATE TABLE IF NOT EXISTS audit_score_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL CHECK (domain_key IN ('SP', 'DP', 'GV', 'IC', 'DI')),
  section_key TEXT,
  ai_score NUMERIC(6,2) NOT NULL,
  ai_weighted_score NUMERIC(6,2),
  manual_score NUMERIC(6,2) NOT NULL CHECK (manual_score >= 0 AND manual_score <= 100),
  manual_weighted_score NUMERIC(6,2),
  delta_score NUMERIC(6,2) NOT NULL,
  reason_category audit_score_reason_category NOT NULL,
  override_note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(case_id, report_id, domain_key)
);

CREATE INDEX IF NOT EXISTS idx_audit_score_overrides_case_report
  ON audit_score_overrides(case_id, report_id);
CREATE INDEX IF NOT EXISTS idx_audit_score_overrides_report
  ON audit_score_overrides(report_id);

COMMENT ON TABLE audit_score_overrides IS 'Auditor overrides of AI domain scores; preserves original AI values and records reason.';
COMMENT ON COLUMN audit_score_overrides.delta_score IS 'manual_score - ai_score';
COMMENT ON COLUMN audit_score_overrides.section_key IS 'Optional sub-section when override applies to a specific section within domain.';

-- 2) audit_section_feedback: structured feedback per section
CREATE TABLE IF NOT EXISTS audit_section_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'clarification',
    'improvement_suggestion',
    'evidence_gap',
    'quality_note',
    'benchmark_note',
    'other'
  )),
  visibility_scope audit_section_visibility_scope NOT NULL DEFAULT 'internal_only',
  feedback_note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_section_feedback_case_report
  ON audit_section_feedback(case_id, report_id);
CREATE INDEX IF NOT EXISTS idx_audit_section_feedback_report
  ON audit_section_feedback(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_section_feedback_visibility
  ON audit_section_feedback(visibility_scope)
  WHERE visibility_scope != 'internal_only';

COMMENT ON TABLE audit_section_feedback IS 'Targeted auditor feedback per audit section; visibility_scope controls future report/clinic exposure.';
COMMENT ON COLUMN audit_section_feedback.section_key IS 'Section identifier: hairline_design, donor_management, extraction_quality, recipient_placement, density_distribution, graft_handling, documentation_integrity, healing_aftercare, benchmark_eligibility.';

-- Updated_at trigger for both tables
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_score_overrides_updated_at ON audit_score_overrides;
CREATE TRIGGER audit_score_overrides_updated_at
  BEFORE UPDATE ON audit_score_overrides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS audit_section_feedback_updated_at ON audit_section_feedback;
CREATE TRIGGER audit_section_feedback_updated_at
  BEFORE UPDATE ON audit_section_feedback
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: auditors and case stakeholders can read; only auditors can write
ALTER TABLE audit_score_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_section_feedback ENABLE ROW LEVEL SECURITY;

-- Read: case owners, patient, doctor, clinic, or auditor
CREATE POLICY "audit_score_overrides_select" ON audit_score_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = audit_score_overrides.case_id
        AND (c.user_id = auth.uid() OR c.patient_id = auth.uid() OR c.doctor_id = auth.uid() OR c.clinic_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'auditor')
  );

CREATE POLICY "audit_section_feedback_select" ON audit_section_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = audit_section_feedback.case_id
        AND (c.user_id = auth.uid() OR c.patient_id = auth.uid() OR c.doctor_id = auth.uid() OR c.clinic_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'auditor')
  );

-- Write: auditors only
CREATE POLICY "audit_score_overrides_insert" ON audit_score_overrides
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'auditor')
  );

CREATE POLICY "audit_score_overrides_update" ON audit_score_overrides
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'auditor')
  );

CREATE POLICY "audit_score_overrides_delete" ON audit_score_overrides
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'auditor')
  );

CREATE POLICY "audit_section_feedback_insert" ON audit_section_feedback
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'auditor')
  );

CREATE POLICY "audit_section_feedback_update" ON audit_section_feedback
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'auditor')
  );

CREATE POLICY "audit_section_feedback_delete" ON audit_section_feedback
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'auditor')
  );

-- Part 6: Audit trail — history of all override changes (who, when, what, previous, new)
CREATE TABLE IF NOT EXISTS audit_score_override_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id UUID REFERENCES audit_score_overrides(id) ON DELETE SET NULL,
  case_id UUID NOT NULL,
  report_id UUID NOT NULL,
  domain_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  previous_ai_score NUMERIC(6,2),
  previous_manual_score NUMERIC(6,2),
  new_ai_score NUMERIC(6,2),
  new_manual_score NUMERIC(6,2),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_override_history_override ON audit_score_override_history(override_id);
CREATE INDEX IF NOT EXISTS idx_override_history_case ON audit_score_override_history(case_id);
CREATE INDEX IF NOT EXISTS idx_override_history_changed_at ON audit_score_override_history(changed_at DESC);

COMMENT ON TABLE audit_score_override_history IS 'Audit trail for score override changes; preserves who/when/what/previous/new.';

-- Trigger to log changes (SECURITY DEFINER so trigger can insert into history regardless of RLS)
CREATE OR REPLACE FUNCTION log_override_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_score_override_history (override_id, case_id, report_id, domain_key, action, new_ai_score, new_manual_score, changed_by)
    VALUES (NEW.id, NEW.case_id, NEW.report_id, NEW.domain_key, 'insert', NEW.ai_score, NEW.manual_score, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_score_override_history (override_id, case_id, report_id, domain_key, action, previous_ai_score, previous_manual_score, new_ai_score, new_manual_score, changed_by)
    VALUES (NEW.id, NEW.case_id, NEW.report_id, NEW.domain_key, 'update', OLD.ai_score, OLD.manual_score, NEW.ai_score, NEW.manual_score, NEW.created_by);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_score_override_history (override_id, case_id, report_id, domain_key, action, previous_ai_score, previous_manual_score, changed_by)
    VALUES (OLD.id, OLD.case_id, OLD.report_id, OLD.domain_key, 'delete', OLD.ai_score, OLD.manual_score, OLD.created_by);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_score_overrides_history_trigger ON audit_score_overrides;
CREATE TRIGGER audit_score_overrides_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON audit_score_overrides
  FOR EACH ROW EXECUTE FUNCTION log_override_history();

ALTER TABLE audit_score_override_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "override_history_auditor_select" ON audit_score_override_history
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'auditor'));
