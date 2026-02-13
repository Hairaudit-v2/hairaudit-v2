-- Add status and error columns to reports for failure handling
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'complete';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS error TEXT;
