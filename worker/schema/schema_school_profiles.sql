-- Reviewed school profiles (v1)
--
-- A school profile is the small, source-backed layer that tells the public
-- planner how to describe a reviewed Rutgers school. It intentionally does
-- NOT claim that a school is supported merely because it has a name: only
-- rows with review_status = 'reviewed' are returned by GET /api/schools.
--
-- Apply to one environment at a time. For development:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/schema_school_profiles.sql

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

-- This is intentionally the sole visible school until another school's
-- curriculum, program set, and selection policies are independently reviewed.
INSERT INTO school_profiles (
  slug, institution_slug, campus_slug, name, short_name, catalog_year,
  configuration_json, source_url, source_title, review_status, reviewed_at, sort_order
) VALUES (
  'rbsnb',
  'rutgers',
  'new-brunswick',
  'Rutgers Business School - New Brunswick',
  'RBS New Brunswick',
  '25-26',
  '{"default_program_id":"rbsnb-bait","advising_label":"RBS advising","shared_requirement_reference_types":["major"],"core_fallback_label":"RBS Core Curriculum","core_intro":"RBS requires a minimum of 27 Core credits. Completed, scheduled, and eligible AP-equivalent courses are allocated automatically to maximize completed Core goals. One course is used once within each Core family, while Rutgers permits it to satisfy goals in different families. Click any course for details.","program_type_sections":[{"type":"major","label":"Majors","singular":"Major"},{"type":"minor","label":"Minors","singular":"Minor"},{"type":"concentration","label":"Concentrations","singular":"Concentration"},{"type":"certificate","label":"Certificates","singular":"Certificate"}]}',
  'https://newbrunswick-undergrad-25-26.catalogs.rutgers.edu/',
  'Rutgers-New Brunswick Undergraduate Catalog, 2025-2026',
  'reviewed',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  10
)
ON CONFLICT(slug) DO UPDATE SET
  institution_slug = excluded.institution_slug,
  campus_slug = excluded.campus_slug,
  name = excluded.name,
  short_name = excluded.short_name,
  catalog_year = excluded.catalog_year,
  configuration_json = excluded.configuration_json,
  source_url = excluded.source_url,
  source_title = excluded.source_title,
  review_status = excluded.review_status,
  reviewed_at = excluded.reviewed_at,
  sort_order = excluded.sort_order;
