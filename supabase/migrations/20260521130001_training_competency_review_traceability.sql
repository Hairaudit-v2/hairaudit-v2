-- Optional competency traceability: link achievements/observations to submitted training case reviews.
-- Evidence only — does not auto-sign-off or create achievements from reviews.

ALTER TABLE public.training_competency_achievements
  ADD COLUMN IF NOT EXISTS evidence_training_case_review_id UUID
    REFERENCES public.training_case_reviews(id) ON DELETE SET NULL;

ALTER TABLE public.training_competency_step_observations
  ADD COLUMN IF NOT EXISTS evidence_training_case_review_id UUID
    REFERENCES public.training_case_reviews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS training_competency_achievements_review_evidence_idx
  ON public.training_competency_achievements(evidence_training_case_review_id)
  WHERE evidence_training_case_review_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS training_competency_step_observations_review_evidence_idx
  ON public.training_competency_step_observations(evidence_training_case_review_id)
  WHERE evidence_training_case_review_id IS NOT NULL;

COMMENT ON COLUMN public.training_competency_achievements.evidence_training_case_review_id IS
  'Optional submitted training case review linked as supporting evidence for faculty sign-off';

COMMENT ON COLUMN public.training_competency_step_observations.evidence_training_case_review_id IS
  'Optional submitted training case review linked as supporting evidence for this observation';

-- Ensure linked reviews belong to the same trainee and are submitted (trainee-visible).
CREATE OR REPLACE FUNCTION public.training_competency_validate_review_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.evidence_training_case_review_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.training_case_reviews r
      WHERE r.id = NEW.evidence_training_case_review_id
        AND r.trainee_id = NEW.training_doctor_id
        AND r.review_status = 'submitted'
    ) THEN
      RAISE EXCEPTION 'Evidence training case review must be submitted and belong to the same trainee';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_competency_achievements_review_evidence
  ON public.training_competency_achievements;
CREATE TRIGGER trg_training_competency_achievements_review_evidence
  BEFORE INSERT OR UPDATE OF evidence_training_case_review_id, training_doctor_id
  ON public.training_competency_achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.training_competency_validate_review_evidence();

DROP TRIGGER IF EXISTS trg_training_competency_step_observations_review_evidence
  ON public.training_competency_step_observations;
CREATE TRIGGER trg_training_competency_step_observations_review_evidence
  BEFORE INSERT OR UPDATE OF evidence_training_case_review_id, training_doctor_id
  ON public.training_competency_step_observations
  FOR EACH ROW
  EXECUTE FUNCTION public.training_competency_validate_review_evidence();
