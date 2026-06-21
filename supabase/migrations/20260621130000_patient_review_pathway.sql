-- HA-DUAL-PATHWAY-1: explicit pre/post surgery patient review pathway on cases.
-- Distinct from cases.audit_type (patient | doctor | clinic submitter role).

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS patient_review_pathway TEXT NOT NULL DEFAULT 'post_surgery'
  CHECK (patient_review_pathway IN ('pre_surgery', 'post_surgery'));

COMMENT ON COLUMN cases.patient_review_pathway IS
  'Patient public review pathway: pre_surgery (planning review) or post_surgery (result audit).';

CREATE INDEX IF NOT EXISTS idx_cases_patient_review_pathway ON cases(patient_review_pathway);
