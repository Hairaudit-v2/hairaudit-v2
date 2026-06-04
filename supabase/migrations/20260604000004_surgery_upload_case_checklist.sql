-- HairAudit Mobile Surgery Upload Portal — Stage 3 (Custom Clinic Checklist)
-- Adds a per-case photo checklist snapshot so the required/optional/hidden photo
-- categories that applied AT THE TIME OF SURGERY are preserved on each case.
--
-- Design notes:
--  * photo_checklist_config is NULLABLE on purpose. Existing (historical) rows stay
--    NULL and the runtime falls back to the base HairAudit checklist (six required).
--  * Clinic-level preferences live in surgery_upload_clinic_defaults.default_photo_checklist_config
--    (added in Stage 2's migration). At create time, that config is COPIED into this
--    column so later clinic-default changes never mutate already-created cases.
--  * The six HairAudit minimum evidence slots remain required regardless of config;
--    this is enforced in application code (sanitizeSurgeryChecklistConfig), so no DB
--    CHECK constraint is added (keeps the JSONB shape flexible for future stages).

ALTER TABLE public.surgery_upload_details
  ADD COLUMN IF NOT EXISTS photo_checklist_config JSONB;

COMMENT ON COLUMN public.surgery_upload_details.photo_checklist_config IS
  'Stage 3: per-case snapshot of the required/optional/hidden photo checklist, copied from the clinic defaults at creation. NULL => fall back to the base HairAudit checklist (six required). Historical cases are never mutated when clinic defaults change.';

-- No backfill: existing rows intentionally remain NULL so they keep using the base
-- HairAudit checklist (six required slots), preserving historical accuracy.
