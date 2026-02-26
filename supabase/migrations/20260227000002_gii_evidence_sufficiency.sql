-- Graft Integrity Index™: internal evidence sufficiency score (0–100)

ALTER TABLE graft_integrity_estimates
  ADD COLUMN IF NOT EXISTS evidence_sufficiency_score INT NOT NULL DEFAULT 0
  CHECK (evidence_sufficiency_score >= 0 AND evidence_sufficiency_score <= 100);

