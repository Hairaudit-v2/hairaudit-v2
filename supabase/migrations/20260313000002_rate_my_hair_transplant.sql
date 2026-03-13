-- Community-facing Rate My Hair Transplant feature

CREATE TABLE IF NOT EXISTS community_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT NOT NULL,
  image_data_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  hairline_design_score INT NOT NULL CHECK (hairline_design_score BETWEEN 0 AND 100),
  density_score INT NOT NULL CHECK (density_score BETWEEN 0 AND 100),
  donor_preservation_score INT NOT NULL CHECK (donor_preservation_score BETWEEN 0 AND 100),
  naturalness_score INT NOT NULL CHECK (naturalness_score BETWEEN 0 AND 100),
  overall_score INT NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  allow_community_share BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  community_rating_count INT NOT NULL DEFAULT 0 CHECK (community_rating_count >= 0),
  community_naturalness_avg NUMERIC(4,2),
  community_density_avg NUMERIC(4,2),
  community_hairline_avg NUMERIC(4,2)
);

CREATE INDEX IF NOT EXISTS idx_community_cases_published_created
  ON community_cases (is_published, created_at DESC);

CREATE TABLE IF NOT EXISTS community_case_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES community_cases(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  naturalness INT NOT NULL CHECK (naturalness BETWEEN 1 AND 5),
  density INT NOT NULL CHECK (density BETWEEN 1 AND 5),
  hairline_design INT NOT NULL CHECK (hairline_design BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_community_case_ratings_case_id
  ON community_case_ratings (case_id);
