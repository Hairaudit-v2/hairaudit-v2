-- FIN-IMAGING-3 — shadow comparison logs for HairAudit ↔ FI OS unified classifier cutover.
-- Service-role writes only; not exposed to patients or clinic users.

CREATE TABLE IF NOT EXISTS public.hairaudit_classifier_shadow_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL,
  case_id UUID NOT NULL,
  legacy_category TEXT NOT NULL,
  unified_category TEXT NOT NULL,
  categories_match BOOLEAN NOT NULL,
  confidence_delta DOUBLE PRECISION NULL,
  quality_delta DOUBLE PRECISION NULL,
  blur_delta DOUBLE PRECISION NULL,
  protocol_delta DOUBLE PRECISION NULL,
  latency_ms INTEGER NOT NULL,
  unified_fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT NOT NULL,
  processing_version TEXT NOT NULL,
  legacy_latency_ms INTEGER NULL,
  legacy_provider TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hairaudit_classifier_shadow_comparisons_upload_id
  ON public.hairaudit_classifier_shadow_comparisons (upload_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_classifier_shadow_comparisons_case_id
  ON public.hairaudit_classifier_shadow_comparisons (case_id);

CREATE INDEX IF NOT EXISTS idx_hairaudit_classifier_shadow_comparisons_created_at
  ON public.hairaudit_classifier_shadow_comparisons (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hairaudit_classifier_shadow_comparisons_categories_match
  ON public.hairaudit_classifier_shadow_comparisons (categories_match);

COMMENT ON TABLE public.hairaudit_classifier_shadow_comparisons IS
  'FIN-IMAGING-3 shadow mode: legacy vs FI OS unified classifier comparison (staging cutover). Service-role only.';

ALTER TABLE public.hairaudit_classifier_shadow_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hairaudit_classifier_shadow_comparisons_service_role"
  ON public.hairaudit_classifier_shadow_comparisons
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.hairaudit_classifier_shadow_comparisons TO service_role;
