-- HA-PHOTO-TIMELINE-2A — Canonical photo sessions (Phases A+B).
-- Overlay on existing uploads; does not rewrite upload categories or storage paths.
-- Milestone enum intentionally excludes `current` (derived view only).

CREATE TABLE IF NOT EXISTS public.hairaudit_photo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  relative_day INTEGER,
  milestone TEXT NOT NULL DEFAULT 'unknown',
  milestone_source TEXT NOT NULL DEFAULT 'derived',
  milestone_confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.500
    CHECK (milestone_confidence >= 0 AND milestone_confidence <= 1),
  patient_confirmed_at TIMESTAMPTZ,
  clinician_confirmed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'patient_upload',
  status TEXT NOT NULL DEFAULT 'active',
  merged_into_session_id UUID REFERENCES public.hairaudit_photo_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hairaudit_photo_sessions_milestone_chk CHECK (
    milestone IN (
      'pre_surgery',
      'surgery_day',
      'early_recovery',
      'month_1',
      'month_3',
      'month_6',
      'month_9',
      'month_12',
      'month_18',
      'long_term',
      'unknown'
    )
  ),
  CONSTRAINT hairaudit_photo_sessions_milestone_source_chk CHECK (
    milestone_source IN (
      'derived',
      'patient',
      'clinician',
      'legacy_category',
      'needs_review'
    )
  ),
  CONSTRAINT hairaudit_photo_sessions_source_chk CHECK (
    source IN (
      'patient_upload',
      'auditor',
      'clinic',
      'reconciliation',
      'guided_capture'
    )
  ),
  CONSTRAINT hairaudit_photo_sessions_status_chk CHECK (
    status IN (
      'active',
      'needs_review',
      'merged',
      'split',
      'superseded'
    )
  )
);

COMMENT ON TABLE public.hairaudit_photo_sessions IS
  'HA-PHOTO-TIMELINE-2A photo sessions. Milestone allocation is session-level; current is never a milestone.';

COMMENT ON COLUMN public.hairaudit_photo_sessions.captured_at IS
  'Clinical capture date/time. Latest follow-up selection prefers this over uploaded_at.';

COMMENT ON COLUMN public.hairaudit_photo_sessions.relative_day IS
  'Days after procedure (nullable when procedure date unknown).';

CREATE INDEX IF NOT EXISTS idx_hairaudit_photo_sessions_case
  ON public.hairaudit_photo_sessions (case_id, status, captured_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_hairaudit_photo_sessions_case_milestone
  ON public.hairaudit_photo_sessions (case_id, milestone)
  WHERE status IN ('active', 'needs_review');

CREATE TABLE IF NOT EXISTS public.hairaudit_photo_session_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_session_id UUID NOT NULL
    REFERENCES public.hairaudit_photo_sessions(id) ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  detected_role TEXT NOT NULL DEFAULT 'unknown',
  confirmed_role TEXT,
  role_confidence NUMERIC(4, 3)
    CHECK (role_confidence IS NULL OR (role_confidence >= 0 AND role_confidence <= 1)),
  quality_status TEXT NOT NULL DEFAULT 'unknown',
  is_canonical_for_role BOOLEAN NOT NULL DEFAULT FALSE,
  excluded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hairaudit_photo_session_images_role_chk CHECK (
    detected_role IN (
      'front',
      'top',
      'crown',
      'left',
      'right',
      'donor_rear',
      'recipient_closeup',
      'donor_closeup',
      'other',
      'unknown'
    )
  ),
  CONSTRAINT hairaudit_photo_session_images_confirmed_role_chk CHECK (
    confirmed_role IS NULL OR confirmed_role IN (
      'front',
      'top',
      'crown',
      'left',
      'right',
      'donor_rear',
      'recipient_closeup',
      'donor_closeup',
      'other',
      'unknown'
    )
  ),
  CONSTRAINT hairaudit_photo_session_images_quality_chk CHECK (
    quality_status IN ('ok', 'low', 'unusable', 'unknown')
  )
);

COMMENT ON TABLE public.hairaudit_photo_session_images IS
  'HA-PHOTO-TIMELINE-2A image-to-session overlay. Does not rewrite uploads.type or storage paths.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_hairaudit_photo_session_images_upload
  ON public.hairaudit_photo_session_images (upload_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hairaudit_photo_session_images_canonical_role
  ON public.hairaudit_photo_session_images (photo_session_id, confirmed_role)
  WHERE is_canonical_for_role = TRUE
    AND confirmed_role IS NOT NULL
    AND excluded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hairaudit_photo_session_images_session
  ON public.hairaudit_photo_session_images (photo_session_id)
  WHERE excluded_at IS NULL;

ALTER TABLE public.hairaudit_photo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hairaudit_photo_session_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hairaudit_photo_sessions_service_role ON public.hairaudit_photo_sessions;
CREATE POLICY hairaudit_photo_sessions_service_role
  ON public.hairaudit_photo_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS hairaudit_photo_session_images_service_role ON public.hairaudit_photo_session_images;
CREATE POLICY hairaudit_photo_session_images_service_role
  ON public.hairaudit_photo_session_images
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.hairaudit_photo_sessions TO service_role;
GRANT ALL ON public.hairaudit_photo_session_images TO service_role;
