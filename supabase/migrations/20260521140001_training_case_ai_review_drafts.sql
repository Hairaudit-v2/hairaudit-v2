-- AI-assisted training image review drafts (faculty-only internal tool; not patient HairAudit)

CREATE TABLE IF NOT EXISTS public.training_case_ai_review_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_case_id UUID NOT NULL REFERENCES public.training_cases(id) ON DELETE CASCADE,
  training_case_review_id UUID REFERENCES public.training_case_reviews(id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  ai_model TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'completed', 'failed')),
  image_count INT NOT NULL DEFAULT 0,
  missing_categories TEXT[],
  overall_summary TEXT,
  strengths TEXT[],
  improvement_areas TEXT[],
  suggested_next_focus TEXT,
  structured_feedback JSONB,
  safety_notes TEXT[],
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_case_ai_review_drafts_case_id_idx
  ON public.training_case_ai_review_drafts(training_case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS training_case_ai_review_drafts_review_id_idx
  ON public.training_case_ai_review_drafts(training_case_review_id)
  WHERE training_case_review_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_training_case_ai_review_drafts_updated_at ON public.training_case_ai_review_drafts;
CREATE TRIGGER trg_training_case_ai_review_drafts_updated_at
  BEFORE UPDATE ON public.training_case_ai_review_drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.training_case_ai_review_drafts ENABLE ROW LEVEL SECURITY;

-- Staff only: trainees must never read AI drafts
DROP POLICY IF EXISTS training_case_ai_review_drafts_select ON public.training_case_ai_review_drafts;
CREATE POLICY training_case_ai_review_drafts_select ON public.training_case_ai_review_drafts
  FOR SELECT USING (
    public.academy_has_staff_access(auth.uid())
    AND public.academy_can_access_training_case(auth.uid(), training_case_id)
  );

DROP POLICY IF EXISTS training_case_ai_review_drafts_insert ON public.training_case_ai_review_drafts;
CREATE POLICY training_case_ai_review_drafts_insert ON public.training_case_ai_review_drafts
  FOR INSERT WITH CHECK (
    public.academy_has_staff_access(auth.uid())
    AND requested_by = auth.uid()
    AND public.academy_can_access_training_case(auth.uid(), training_case_id)
  );

DROP POLICY IF EXISTS training_case_ai_review_drafts_update ON public.training_case_ai_review_drafts;
CREATE POLICY training_case_ai_review_drafts_update ON public.training_case_ai_review_drafts
  FOR UPDATE USING (
    public.academy_has_staff_access(auth.uid())
    AND public.academy_can_access_training_case(auth.uid(), training_case_id)
  );

COMMENT ON TABLE public.training_case_ai_review_drafts IS
  'Internal faculty-only AI-assisted draft observations for training case image review. Not visible to trainees. Faculty must edit and submit the formal training_case_review separately.';
