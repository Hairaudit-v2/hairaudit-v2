-- Graft Integrity Index™: claimed vs visually supported graft estimate ranges

CREATE TABLE IF NOT EXISTS graft_integrity_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

  claimed_grafts INT NULL,

  estimated_extracted_min INT NULL,
  estimated_extracted_max INT NULL,

  estimated_implanted_min INT NULL,
  estimated_implanted_max INT NULL,

  variance_claimed_vs_implanted_min_pct NUMERIC NULL,
  variance_claimed_vs_implanted_max_pct NUMERIC NULL,

  variance_claimed_vs_extracted_min_pct NUMERIC NULL,
  variance_claimed_vs_extracted_max_pct NUMERIC NULL,

  confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  confidence_label TEXT NOT NULL DEFAULT 'medium'
    CHECK (confidence_label IN ('low', 'medium', 'high')),

  inputs_used JSONB NOT NULL DEFAULT '{}'::jsonb,
  limitations TEXT[] NOT NULL DEFAULT '{}'::text[],
  ai_notes TEXT NULL,
  flags TEXT[] NOT NULL DEFAULT '{}'::text[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  auditor_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (auditor_status IN ('pending', 'approved', 'rejected', 'needs_more_evidence')),

  auditor_notes TEXT NULL,
  auditor_adjustments JSONB NOT NULL DEFAULT '{}'::jsonb,

  audited_by UUID NULL REFERENCES profiles(id),
  audited_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_graft_integrity_estimates_case_id
  ON graft_integrity_estimates(case_id);

CREATE INDEX IF NOT EXISTS idx_graft_integrity_estimates_created_at
  ON graft_integrity_estimates(created_at);

ALTER TABLE graft_integrity_estimates ENABLE ROW LEVEL SECURITY;

-- Read: case owner / linked patient-doctor-clinic OR auditors
CREATE POLICY "gii_select_via_case_or_auditor" ON graft_integrity_estimates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = graft_integrity_estimates.case_id
      AND (c.user_id = auth.uid() OR c.patient_id = auth.uid() OR c.doctor_id = auth.uid() OR c.clinic_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'auditor'
    )
  );

-- Service role: insert/update AI results
CREATE POLICY "gii_insert_service_role" ON graft_integrity_estimates
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "gii_update_service_role" ON graft_integrity_estimates
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Auditors: can update auditor_* fields / status (app enforces which columns change)
CREATE POLICY "gii_update_auditor" ON graft_integrity_estimates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'auditor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'auditor'
    )
  );

