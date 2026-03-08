-- Deterministic evidence preparation manifest for AI audit reliability

CREATE TABLE IF NOT EXISTS case_evidence_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  prepared_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_score NUMERIC NOT NULL DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  missing_categories TEXT[] NOT NULL DEFAULT '{}'::text[],
  errors TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_evidence_manifests_case_id
  ON case_evidence_manifests(case_id);

CREATE INDEX IF NOT EXISTS idx_case_evidence_manifests_created_at
  ON case_evidence_manifests(created_at DESC);

ALTER TABLE case_evidence_manifests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cem_select_via_case_or_auditor" ON case_evidence_manifests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_evidence_manifests.case_id
      AND (c.user_id = auth.uid() OR c.patient_id = auth.uid() OR c.doctor_id = auth.uid() OR c.clinic_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'auditor'
    )
  );

CREATE POLICY "cem_insert_service_role" ON case_evidence_manifests
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "cem_update_service_role" ON case_evidence_manifests
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

