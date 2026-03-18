-- Participation approval status for doctor and clinic (apply-via-email flow).
-- Surfaces in-app: Application not started, Pending review, Approved, More information required.
-- Does not gate submission yet; visibility and clarity first.

ALTER TABLE clinic_profiles
  ADD COLUMN IF NOT EXISTS participation_approval_status TEXT NOT NULL DEFAULT 'not_started'
  CHECK (participation_approval_status IN ('not_started', 'pending_review', 'approved', 'more_info_required'));

ALTER TABLE doctor_profiles
  ADD COLUMN IF NOT EXISTS participation_approval_status TEXT NOT NULL DEFAULT 'not_started'
  CHECK (participation_approval_status IN ('not_started', 'pending_review', 'approved', 'more_info_required'));

COMMENT ON COLUMN clinic_profiles.participation_approval_status IS 'Application/approval status for professional participation (email apply flow).';
COMMENT ON COLUMN doctor_profiles.participation_approval_status IS 'Application/approval status for professional participation (email apply flow).';
