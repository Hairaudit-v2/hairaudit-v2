-- Add 'archived' trainee status: soft roster cleanup distinct from 'withdrawn' (both hidden from default operational lists).

ALTER TABLE public.training_doctors DROP CONSTRAINT IF EXISTS training_doctors_status_check;
ALTER TABLE public.training_doctors ADD CONSTRAINT training_doctors_status_check
  CHECK (status IN ('active', 'paused', 'graduated', 'withdrawn', 'archived'));

COMMENT ON COLUMN public.training_doctors.status IS
  'Roster state: active/paused/graduated shown by default; withdrawn/archived hidden from operational lists but retained for history.';
