-- HairAudit Mobile Surgery Upload Portal — Stage 5 (Reviewer Actions + Evidence Status Workflow)
-- Turns submitted mobile surgery uploads into a structured evidence-review workflow:
--  * overall evidence review status + reviewer/request/ready timestamps on the detail row
--  * per-slot reviewer decisions (surgery_upload_slot_reviews)
--  * lightweight evidence event history (surgery_upload_evidence_events)
--
-- Design / safety notes:
--  * This workflow is SEPARATE from surgery_upload_details.status (draft/submitted)
--    and from cases.status (the audit pipeline). Nothing here triggers AI/audit.
--  * Reviewer decisions are auditor-only. Case participants (clinic/doctor) may READ
--    but never write reviewer decisions. Patients are excluded by case access.
--  * clinic_profile_id is NEVER an access grant — access flows through
--    surgery_upload_case_access() (Stage 1) exactly as before.
--  * Additive only: no changes to existing RLS on other tables, no data rewrites,
--    no generated columns.

-- ---------------------------------------------------------------------------
-- 1) Auditor-only predicate (SECURITY DEFINER so it can read profiles/auth.users)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.surgery_upload_is_auditor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'auditor'
  )
  OR EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND LOWER(COALESCE(u.email, '')) = 'auditor@hairaudit.com'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2) Overall evidence review state on surgery_upload_details
-- ---------------------------------------------------------------------------
ALTER TABLE public.surgery_upload_details
  ADD COLUMN IF NOT EXISTS evidence_review_status TEXT NOT NULL DEFAULT 'not_reviewed'
    CHECK (evidence_review_status IN (
      'not_reviewed', 'in_review', 'needs_more_evidence', 'evidence_accepted', 'ready_for_audit'
    )),
  ADD COLUMN IF NOT EXISTS evidence_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidence_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS evidence_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidence_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_request_message TEXT,
  ADD COLUMN IF NOT EXISTS evidence_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidence_resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ready_for_audit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_for_audit_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_surgery_upload_details_evidence_review_status
  ON public.surgery_upload_details(evidence_review_status, created_at DESC);

COMMENT ON COLUMN public.surgery_upload_details.evidence_review_status IS
  'Stage 5 reviewer workflow status: not_reviewed | in_review | needs_more_evidence | evidence_accepted | ready_for_audit. Separate from status (draft/submitted) and cases.status. Does NOT trigger the audit pipeline.';

-- ---------------------------------------------------------------------------
-- 3) Per-slot reviewer decisions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.surgery_upload_slot_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  slot_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_reviewed'
    CHECK (status IN ('not_reviewed', 'accepted', 'needs_more_photos', 'poor_quality', 'not_applicable')),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_surgery_upload_slot_reviews_case
  ON public.surgery_upload_slot_reviews(case_id);

DROP TRIGGER IF EXISTS trg_surgery_upload_slot_reviews_updated_at
  ON public.surgery_upload_slot_reviews;
CREATE TRIGGER trg_surgery_upload_slot_reviews_updated_at
  BEFORE UPDATE ON public.surgery_upload_slot_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_surgery_upload_details_updated_at();

ALTER TABLE public.surgery_upload_slot_reviews ENABLE ROW LEVEL SECURITY;

-- Read: any case participant or auditor (same as the detail row).
CREATE POLICY surgery_slot_reviews_select ON public.surgery_upload_slot_reviews
  FOR SELECT USING (public.surgery_upload_case_access(case_id));

-- Write: auditors only. Clinic/doctor users can never change reviewer decisions.
CREATE POLICY surgery_slot_reviews_insert ON public.surgery_upload_slot_reviews
  FOR INSERT WITH CHECK (public.surgery_upload_is_auditor());

CREATE POLICY surgery_slot_reviews_update ON public.surgery_upload_slot_reviews
  FOR UPDATE USING (public.surgery_upload_is_auditor())
  WITH CHECK (public.surgery_upload_is_auditor());

CREATE POLICY surgery_slot_reviews_delete ON public.surgery_upload_slot_reviews
  FOR DELETE USING (public.surgery_upload_is_auditor());

COMMENT ON TABLE public.surgery_upload_slot_reviews IS
  'Stage 5: per-photo-slot reviewer decisions for mobile surgery uploads. One row per (case_id, slot_key). Auditor-only writes; case participants read-only.';

-- ---------------------------------------------------------------------------
-- 4) Lightweight evidence event history (audit log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.surgery_upload_evidence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'evidence_review_status_changed',
      'slot_review_updated',
      'additional_evidence_uploaded',
      'evidence_resubmitted'
    )),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surgery_upload_evidence_events_case
  ON public.surgery_upload_evidence_events(case_id, created_at DESC);

ALTER TABLE public.surgery_upload_evidence_events ENABLE ROW LEVEL SECURITY;

-- Read: any case participant or auditor. Writes happen through service-role API
-- routes (which bypass RLS); the insert policy is a safe net for direct access.
CREATE POLICY surgery_evidence_events_select ON public.surgery_upload_evidence_events
  FOR SELECT USING (public.surgery_upload_case_access(case_id));

CREATE POLICY surgery_evidence_events_insert ON public.surgery_upload_evidence_events
  FOR INSERT WITH CHECK (public.surgery_upload_case_access(case_id));

COMMENT ON TABLE public.surgery_upload_evidence_events IS
  'Stage 5: lightweight evidence-review event history (status changes, slot reviews, additional evidence, resubmissions). Append-only; does not trigger the audit pipeline.';
