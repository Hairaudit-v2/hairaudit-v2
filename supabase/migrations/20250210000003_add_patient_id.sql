-- Add patient_id for role-based patient case ownership
ALTER TABLE cases ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES auth.users(id);
