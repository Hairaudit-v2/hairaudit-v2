-- Prevent duplicate draft Training Case Reviews per reviewer and case (additive)

-- Archive older duplicate drafts, keeping the most recently updated row per (case, reviewer).
-- Does not delete data.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY training_case_id, reviewer_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM public.training_case_reviews
  WHERE review_status = 'draft'
    AND training_case_id IS NOT NULL
)
UPDATE public.training_case_reviews r
SET review_status = 'archived', updated_at = NOW()
FROM ranked
WHERE r.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS training_case_reviews_one_draft_per_reviewer_case_idx
  ON public.training_case_reviews (training_case_id, reviewer_id)
  WHERE review_status = 'draft' AND training_case_id IS NOT NULL;

COMMENT ON INDEX public.training_case_reviews_one_draft_per_reviewer_case_idx IS
  'At most one draft Training Case Review per faculty reviewer per training case';
