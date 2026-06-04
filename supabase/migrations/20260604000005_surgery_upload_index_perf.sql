-- HairAudit Mobile Surgery Upload Portal — Stage 4B (Index Performance)
-- Stage 4A moved the surgery upload index to server-side filtering + pagination,
-- ordered by created_at DESC. These additive indexes back the common filter +
-- sort shapes so the index keeps performing as upload volume grows.
--
-- Safe + additive only: no RLS changes, no data changes, no generated columns.
-- Standard CREATE INDEX IF NOT EXISTS (the project's migration convention; no
-- CONCURRENTLY, which cannot run inside the migration transaction).
--
-- Note: idx_surgery_upload_details_created_by already covers
--   (created_by, created_at DESC) (Stage 1 migration), so the optional
--   created_by ordering index is intentionally NOT recreated here.

-- Auditor / all-rows newest-first ordering (no created_by predicate).
CREATE INDEX IF NOT EXISTS idx_surgery_upload_details_created_at
  ON public.surgery_upload_details(created_at DESC);

-- Status filter + newest-first ordering (Stage 1 only indexed status, updated_at).
CREATE INDEX IF NOT EXISTS idx_surgery_upload_details_status_created_at
  ON public.surgery_upload_details(status, created_at DESC);

-- Linked-clinic filter + newest-first ordering (Stage 2.2 only indexed clinic_profile_id).
CREATE INDEX IF NOT EXISTS idx_surgery_upload_details_clinic_created_at
  ON public.surgery_upload_details(clinic_profile_id, created_at DESC);

-- Surgery-date range filtering / date-based ordering.
CREATE INDEX IF NOT EXISTS idx_surgery_upload_details_surgery_date
  ON public.surgery_upload_details(surgery_date DESC);
