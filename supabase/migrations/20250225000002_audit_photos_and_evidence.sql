-- audit_photos: structured evidence storage for dual-schema (doctor/patient)
-- evidence_score / confidence: stored on cases for quick display

-- 1) Create audit_photos table
CREATE TABLE IF NOT EXISTS audit_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  submitter_type TEXT NOT NULL CHECK (submitter_type IN ('doctor', 'patient')),
  photo_key TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_photos_case_submitter
  ON audit_photos(case_id, submitter_type);

CREATE INDEX IF NOT EXISTS idx_audit_photos_case_key
  ON audit_photos(case_id, photo_key);

-- 2) Add evidence columns to cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS evidence_score_doctor TEXT
  CHECK (evidence_score_doctor IS NULL OR evidence_score_doctor IN ('A', 'B', 'C', 'D'));

ALTER TABLE cases ADD COLUMN IF NOT EXISTS evidence_score_patient TEXT
  CHECK (evidence_score_patient IS NULL OR evidence_score_patient IN ('A', 'B', 'C', 'D'));

ALTER TABLE cases ADD COLUMN IF NOT EXISTS confidence_label_doctor TEXT
  CHECK (confidence_label_doctor IS NULL OR confidence_label_doctor IN ('High', 'Medium', 'Low', 'Very Low'));

ALTER TABLE cases ADD COLUMN IF NOT EXISTS confidence_label_patient TEXT
  CHECK (confidence_label_patient IS NULL OR confidence_label_patient IN ('High', 'Medium', 'Low', 'Very Low'));

ALTER TABLE cases ADD COLUMN IF NOT EXISTS evidence_details JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN cases.evidence_score_doctor IS 'A/B/C/D evidence grade from doctor photos';
COMMENT ON COLUMN cases.evidence_score_patient IS 'A/B/C/D evidence grade from patient photos';
COMMENT ON COLUMN cases.evidence_details IS 'Completed categories, missing required, counts by key';

-- RLS (app often uses service role; policies for anon/auth if needed)
ALTER TABLE audit_photos ENABLE ROW LEVEL SECURITY;

-- Allow read for case owner / patient / doctor / clinic / auditor (via cases)
CREATE POLICY "audit_photos_select_via_case" ON audit_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = audit_photos.case_id
      AND (c.user_id = auth.uid() OR c.patient_id = auth.uid() OR c.doctor_id = auth.uid() OR c.clinic_id = auth.uid())
    )
  );

-- Allow insert for case owner / patient / doctor / clinic
CREATE POLICY "audit_photos_insert_via_case" ON audit_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = audit_photos.case_id
      AND (c.user_id = auth.uid() OR c.patient_id = auth.uid() OR c.doctor_id = auth.uid() OR c.clinic_id = auth.uid())
    )
  );

-- Allow delete for case owner / patient / doctor / clinic
CREATE POLICY "audit_photos_delete_via_case" ON audit_photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = audit_photos.case_id
      AND (c.user_id = auth.uid() OR c.patient_id = auth.uid() OR c.doctor_id = auth.uid() OR c.clinic_id = auth.uid())
    )
  );
