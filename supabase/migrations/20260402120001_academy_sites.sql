-- Academy sites: per-site ops inbox and metadata for onboarding routing (additive)

CREATE TABLE IF NOT EXISTS public.academy_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT,
  ops_notification_email TEXT,
  general_contact_email TEXT,
  phone TEXT,
  country TEXT,
  timezone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academy_sites_slug_idx ON public.academy_sites(slug);
CREATE INDEX IF NOT EXISTS academy_sites_is_active_idx ON public.academy_sites(is_active) WHERE is_active = TRUE;

ALTER TABLE public.training_programs
  ADD COLUMN IF NOT EXISTS academy_site_id UUID REFERENCES public.academy_sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS training_programs_academy_site_id_idx ON public.training_programs(academy_site_id);

ALTER TABLE public.training_doctors
  ADD COLUMN IF NOT EXISTS academy_site_id UUID REFERENCES public.academy_sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS training_doctors_academy_site_id_idx ON public.training_doctors(academy_site_id);

DROP TRIGGER IF EXISTS trg_academy_sites_updated_at ON public.academy_sites;
CREATE TRIGGER trg_academy_sites_updated_at
  BEFORE UPDATE ON public.academy_sites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Default site + link existing seeded program
INSERT INTO public.academy_sites (id, name, slug, display_name, is_active, notes)
SELECT
  'b0000000-0000-4000-8000-000000000001',
  'Default IIOHR site',
  'iiohr-default',
  'IIOHR / Evolved (default)',
  TRUE,
  'Created by migration; set ops_notification_email in /academy/sites or use ACADEMY_OPS_NOTIFICATION_EMAIL env fallback.'
WHERE NOT EXISTS (SELECT 1 FROM public.academy_sites WHERE id = 'b0000000-0000-4000-8000-000000000001');

UPDATE public.training_programs
SET academy_site_id = 'b0000000-0000-4000-8000-000000000001'
WHERE id = 'a0000000-0000-4000-8000-000000000001'
  AND academy_site_id IS NULL;

ALTER TABLE public.academy_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY academy_sites_select_staff ON public.academy_sites
  FOR SELECT USING (public.academy_has_staff_access(auth.uid()));

CREATE POLICY academy_sites_select_trainee ON public.academy_sites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_doctors td
      LEFT JOIN public.training_programs p ON p.id = td.program_id
      WHERE td.auth_user_id = auth.uid()
        AND (td.academy_site_id = academy_sites.id OR p.academy_site_id = academy_sites.id)
    )
  );

CREATE POLICY academy_sites_insert ON public.academy_sites
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

CREATE POLICY academy_sites_update ON public.academy_sites
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

CREATE POLICY academy_sites_delete ON public.academy_sites
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.academy_users au WHERE au.user_id = auth.uid() AND au.role = 'academy_admin')
  );

COMMENT ON TABLE public.academy_sites IS 'Training academy / site registry; ops_notification_email drives roster request routing';
COMMENT ON COLUMN public.training_programs.academy_site_id IS 'Academy site for onboarding and program context';
COMMENT ON COLUMN public.training_doctors.academy_site_id IS 'Optional override; else inherits from program site';
