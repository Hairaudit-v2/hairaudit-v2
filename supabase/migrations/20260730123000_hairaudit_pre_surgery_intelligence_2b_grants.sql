-- HA-PRE-SURGERY-INTELLIGENCE-2B — Harden grants: anon/authenticated have no table access.
-- Idempotent. Remote already applied alongside 2A create; this file tracks the revoke contract.

REVOKE ALL ON TABLE public.hairaudit_pre_surgery_image_reviews FROM anon, authenticated;
REVOKE ALL ON TABLE public.hairaudit_pre_surgery_image_corrections FROM anon, authenticated;
REVOKE ALL ON TABLE public.hairaudit_pre_surgery_annotations FROM anon, authenticated;
REVOKE ALL ON TABLE public.hairaudit_pre_surgery_observations FROM anon, authenticated;
REVOKE ALL ON TABLE public.hairaudit_pre_surgery_graft_plans FROM anon, authenticated;
REVOKE ALL ON TABLE public.hairaudit_pre_surgery_projections FROM anon, authenticated;
REVOKE ALL ON TABLE public.hairaudit_pre_surgery_audit_events FROM anon, authenticated;
