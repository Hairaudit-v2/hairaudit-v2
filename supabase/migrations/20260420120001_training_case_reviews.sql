-- Training Case Review — educational faculty feedback (separate from training_case_assessments)

-- ---------------------------------------------------------------------------
-- Tables (must exist before helper function — SQL functions validate bodies at CREATE)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.training_case_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_case_id UUID REFERENCES public.training_cases(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.training_doctors(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  cohort_id UUID REFERENCES public.training_cohorts(id) ON DELETE SET NULL,
  program_id UUID REFERENCES public.training_programs(id) ON DELETE SET NULL,
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'submitted', 'archived')),
  case_date DATE,
  case_type TEXT,
  case_difficulty TEXT,
  trainee_stage TEXT,
  overall_level TEXT,
  summary TEXT,
  main_strengths TEXT[],
  improvement_priorities TEXT[],
  recommended_next_focus TEXT,
  faculty_recommendation TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_case_reviews_case_id_idx
  ON public.training_case_reviews(training_case_id);
CREATE INDEX IF NOT EXISTS training_case_reviews_trainee_id_idx
  ON public.training_case_reviews(trainee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS training_case_reviews_status_idx
  ON public.training_case_reviews(review_status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.training_case_review_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.training_case_reviews(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_title TEXT NOT NULL,
  developmental_level TEXT,
  what_went_well TEXT,
  needs_improvement TEXT,
  clinical_importance TEXT,
  next_case_focus TEXT,
  faculty_note TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_id, section_key)
);

CREATE INDEX IF NOT EXISTS training_case_review_sections_review_id_idx
  ON public.training_case_review_sections(review_id, sort_order);

CREATE TABLE IF NOT EXISTS public.training_case_review_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.training_case_reviews(id) ON DELETE CASCADE,
  image_id UUID REFERENCES public.training_case_uploads(id) ON DELETE SET NULL,
  image_url TEXT,
  image_category TEXT NOT NULL,
  reviewer_comment TEXT,
  image_quality_level TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_case_review_images_review_id_idx
  ON public.training_case_review_images(review_id, sort_order);

-- ---------------------------------------------------------------------------
-- Helper: review visibility (staff see all; trainees only submitted on own profile)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.academy_can_access_training_case_review(check_uid UUID, p_review_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.training_case_reviews r
    WHERE r.id = p_review_id
      AND (
        public.academy_has_staff_access(check_uid)
        OR (
          r.review_status = 'submitted'
          AND EXISTS (
            SELECT 1 FROM public.training_doctors td
            WHERE td.id = r.trainee_id AND td.auth_user_id = check_uid
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.academy_can_access_training_case_review(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.academy_can_access_training_case_review(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.academy_can_access_training_case_review(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_training_case_reviews_updated_at ON public.training_case_reviews;
CREATE TRIGGER trg_training_case_reviews_updated_at
  BEFORE UPDATE ON public.training_case_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_training_case_review_sections_updated_at ON public.training_case_review_sections;
CREATE TRIGGER trg_training_case_review_sections_updated_at
  BEFORE UPDATE ON public.training_case_review_sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.training_case_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_case_review_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_case_review_images ENABLE ROW LEVEL SECURITY;

-- training_case_reviews
DROP POLICY IF EXISTS training_case_reviews_select ON public.training_case_reviews;
CREATE POLICY training_case_reviews_select ON public.training_case_reviews
  FOR SELECT USING (
    public.academy_has_staff_access(auth.uid())
    OR (
      review_status = 'submitted'
      AND EXISTS (
        SELECT 1 FROM public.training_doctors td
        WHERE td.id = trainee_id AND td.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS training_case_reviews_insert ON public.training_case_reviews;
CREATE POLICY training_case_reviews_insert ON public.training_case_reviews
  FOR INSERT WITH CHECK (
    public.academy_has_staff_access(auth.uid())
    AND reviewer_id = auth.uid()
    AND (
      training_case_id IS NULL
      OR public.academy_can_access_training_case(auth.uid(), training_case_id)
    )
    AND public.academy_can_access_training_doctor(auth.uid(), trainee_id)
  );

DROP POLICY IF EXISTS training_case_reviews_update ON public.training_case_reviews;
CREATE POLICY training_case_reviews_update ON public.training_case_reviews
  FOR UPDATE USING (
    public.academy_has_staff_access(auth.uid())
    AND reviewer_id = auth.uid()
    AND review_status IN ('draft', 'submitted')
  );

DROP POLICY IF EXISTS training_case_reviews_delete ON public.training_case_reviews;
CREATE POLICY training_case_reviews_delete ON public.training_case_reviews
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.academy_users au
      WHERE au.user_id = auth.uid() AND au.role = 'academy_admin'
    )
  );

-- training_case_review_sections
DROP POLICY IF EXISTS training_case_review_sections_select ON public.training_case_review_sections;
CREATE POLICY training_case_review_sections_select ON public.training_case_review_sections
  FOR SELECT USING (public.academy_can_access_training_case_review(auth.uid(), review_id));

DROP POLICY IF EXISTS training_case_review_sections_insert ON public.training_case_review_sections;
CREATE POLICY training_case_review_sections_insert ON public.training_case_review_sections
  FOR INSERT WITH CHECK (
    public.academy_has_staff_access(auth.uid())
    AND public.academy_can_access_training_case_review(auth.uid(), review_id)
  );

DROP POLICY IF EXISTS training_case_review_sections_update ON public.training_case_review_sections;
CREATE POLICY training_case_review_sections_update ON public.training_case_review_sections
  FOR UPDATE USING (
    public.academy_has_staff_access(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.training_case_reviews r
      WHERE r.id = review_id AND r.reviewer_id = auth.uid() AND r.review_status = 'draft'
    )
  );

DROP POLICY IF EXISTS training_case_review_sections_delete ON public.training_case_review_sections;
CREATE POLICY training_case_review_sections_delete ON public.training_case_review_sections
  FOR DELETE USING (
    public.academy_has_staff_access(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.training_case_reviews r
      WHERE r.id = review_id AND r.reviewer_id = auth.uid() AND r.review_status = 'draft'
    )
  );

-- training_case_review_images
DROP POLICY IF EXISTS training_case_review_images_select ON public.training_case_review_images;
CREATE POLICY training_case_review_images_select ON public.training_case_review_images
  FOR SELECT USING (public.academy_can_access_training_case_review(auth.uid(), review_id));

DROP POLICY IF EXISTS training_case_review_images_insert ON public.training_case_review_images;
CREATE POLICY training_case_review_images_insert ON public.training_case_review_images
  FOR INSERT WITH CHECK (
    public.academy_has_staff_access(auth.uid())
    AND public.academy_can_access_training_case_review(auth.uid(), review_id)
  );

DROP POLICY IF EXISTS training_case_review_images_update ON public.training_case_review_images;
CREATE POLICY training_case_review_images_update ON public.training_case_review_images
  FOR UPDATE USING (
    public.academy_has_staff_access(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.training_case_reviews r
      WHERE r.id = review_id AND r.reviewer_id = auth.uid() AND r.review_status = 'draft'
    )
  );

DROP POLICY IF EXISTS training_case_review_images_delete ON public.training_case_review_images;
CREATE POLICY training_case_review_images_delete ON public.training_case_review_images
  FOR DELETE USING (
    public.academy_has_staff_access(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.training_case_reviews r
      WHERE r.id = review_id AND r.reviewer_id = auth.uid() AND r.review_status = 'draft'
    )
  );

COMMENT ON TABLE public.training_case_reviews IS
  'Educational training case feedback for surgical coaching — not a patient HairAudit report';
COMMENT ON TABLE public.training_case_review_sections IS
  'Structured developmental feedback sections per training case review';
COMMENT ON TABLE public.training_case_review_images IS
  'Image-linked faculty comments for training case reviews';
