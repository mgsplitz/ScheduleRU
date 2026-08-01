-- Reviewed school profiles (v1)
--
-- A school profile is the small, source-backed layer that tells the public
-- planner how to describe a reviewed Rutgers school. It intentionally does
-- NOT claim that a school is supported merely because it has a name: only
-- rows with review_status = 'reviewed' are returned by GET /api/schools.
--
-- Apply to one environment at a time. For development:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=../migrations/schema_school_profiles.sql

CREATE TABLE IF NOT EXISTS school_profiles (
  slug TEXT PRIMARY KEY,              -- matches programs.school_slug, e.g. rbsnb
  institution_slug TEXT NOT NULL,     -- e.g. rutgers
  campus_slug TEXT NOT NULL,          -- e.g. new-brunswick
  name TEXT NOT NULL,                 -- official student-facing school name
  short_name TEXT NOT NULL,           -- compact UI label
  catalog_year TEXT,                  -- current reviewed support boundary, e.g. 25-26
  configuration_json TEXT NOT NULL,   -- reviewed UI/policy context; parsed and validated by the Worker
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (review_status IN ('unreviewed', 'reviewed', 'needs_fix')),
  reviewed_at INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_school_profiles_visible
  ON school_profiles(review_status, sort_order, name);

-- Reviewed rows are restored from
-- reference-data/snapshots/reviewed-reference-data.v1.json.
