-- HairAudit Mobile Surgery Upload — Stage 8 (Evidence Review Workspace)
-- Auditor-only structured notes + issue flags for the non-AI evidence review flow.
-- Does NOT touch cases.status, cases.submitted_at, or legacy audit submission.

ALTER TABLE public.surgery_upload_details
  ADD COLUMN IF NOT EXISTS evidence_review_workspace_notes TEXT,
  ADD COLUMN IF NOT EXISTS evidence_review_workspace_notes_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_review_workspace_notes_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidence_review_workspace_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_review_workspace_flags_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_review_workspace_flags_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.surgery_upload_details.evidence_review_workspace_notes IS
  'Stage 8: auditor evidence-review workspace notes (non-AI; separate from evidence_review_notes used for clinic-facing workflow).';

COMMENT ON COLUMN public.surgery_upload_details.evidence_review_workspace_flags IS
  'Stage 8: JSON array of { "code": string, "detail"?: string } evidence issue flags for internal review.';
