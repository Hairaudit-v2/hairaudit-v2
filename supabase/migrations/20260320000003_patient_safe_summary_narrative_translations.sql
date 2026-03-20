-- Batch 19: additive storage for patient-safe summary translated narrative pilot only.
-- Does not modify reports, finalize flow, scoring, or PDF generation.

CREATE TABLE IF NOT EXISTS report_narrative_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  report_version INT NOT NULL,
  section_id TEXT NOT NULL CHECK (section_id IN ('patientSafeSummaryNarrative')),
  source_locale TEXT NOT NULL DEFAULT 'en' CHECK (source_locale = 'en'),
  source_content_locale TEXT NOT NULL DEFAULT 'und',
  target_locale TEXT NOT NULL CHECK (target_locale IN ('es')),
  source_text_snapshot TEXT NOT NULL,
  source_content_version TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  translated_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  translation_status TEXT NOT NULL CHECK (translation_status IN (
    'not_requested',
    'pending_generation',
    'generated_unreviewed',
    'reviewed_approved',
    'stale_due_to_source_change'
  )),
  review_status TEXT NOT NULL CHECK (review_status IN (
    'not_reviewed',
    'review_required',
    'approved',
    'rejected'
  )),
  translation_provenance TEXT NULL,
  translated_at TIMESTAMPTZ NULL,
  reviewed_at TIMESTAMPTZ NULL,
  reviewer_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT NULL,
  stale_detected_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, section_id, target_locale)
);

CREATE INDEX IF NOT EXISTS idx_report_narrative_translations_report_locale
  ON report_narrative_translations(report_id, target_locale, section_id);

CREATE INDEX IF NOT EXISTS idx_report_narrative_translations_case_version
  ON report_narrative_translations(case_id, report_version DESC);

COMMENT ON TABLE report_narrative_translations IS 'Additive translated narrative overlays. Batch 19 only uses patientSafeSummaryNarrative for a bounded patient-safe pilot.';
COMMENT ON COLUMN report_narrative_translations.source_text_snapshot IS 'Canonical English snapshot used for translation generation and stale detection.';
COMMENT ON COLUMN report_narrative_translations.source_content_version IS 'Immutable source marker, e.g. report:<id>:v<version>:patientSafeSummaryNarrative.';
COMMENT ON COLUMN report_narrative_translations.translated_items IS 'Ordered translated observation items for bounded patient-safe summary rendering.';

ALTER TABLE report_narrative_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_narrative_translations_service_role" ON report_narrative_translations
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
