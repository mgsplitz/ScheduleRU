-- Reusable curriculum modules (v1)
--
-- A curriculum module is a reviewed, non-selectable requirement tree that
-- one or more schools may attach to their plan. This separates the
-- Rutgers-New Brunswick Core from the RBS profile that first used it: a
-- future SAS profile can reference the same reviewed module instead of
-- copying its groups and course list.
--
-- Apply to one environment at a time. For development:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/schema_curriculum_modules.sql
--
-- This migration deliberately copies the already reviewed RBS Core tree into
-- a new canonical module before changing the read path. The old RBS-owned
-- row remains in place for rollback safety and is no longer selected by the
-- public Core API after this migration.

CREATE TABLE IF NOT EXISTS school_curriculum_modules (
  school_slug TEXT NOT NULL,
  module_type TEXT NOT NULL CHECK (module_type IN ('core_curriculum')),
  curriculum_program_id TEXT NOT NULL REFERENCES programs(id),
  source_url TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (review_status IN ('unreviewed', 'reviewed', 'needs_fix')),
  reviewed_at INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (school_slug, module_type)
);
CREATE INDEX IF NOT EXISTS idx_school_curriculum_modules_visible
  ON school_curriculum_modules(school_slug, module_type, review_status, sort_order);

-- The canonical owner is the Rutgers-New Brunswick curriculum, not an
-- individual school. It retains the same official public source and the
-- same reviewed tree as the existing RBS Core.
INSERT INTO programs (
  id, name, school_slug, program_slug, type, catalog_year, source_url,
  review_status, last_scraped_at
) VALUES (
  'rutgers-nb-core-curriculum',
  'Rutgers-New Brunswick Core Curriculum',
  'rutgers-nb',
  'core-curriculum',
  'core_curriculum',
  '25-26',
  'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/core?id=106&layout=blog&view=category',
  'reviewed',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  school_slug = excluded.school_slug,
  program_slug = excluded.program_slug,
  type = excluded.type,
  catalog_year = excluded.catalog_year,
  source_url = excluded.source_url,
  review_status = excluded.review_status;

INSERT OR REPLACE INTO requirement_groups (
  id, program_id, parent_group_id, name, display_family, display_priority,
  rule, count, sort_order, auto_generated
)
SELECT
  REPLACE(id, 'rbsnb-core-curriculum', 'rutgers-nb-core-curriculum'),
  'rutgers-nb-core-curriculum',
  CASE
    WHEN parent_group_id IS NULL THEN NULL
    ELSE REPLACE(parent_group_id, 'rbsnb-core-curriculum', 'rutgers-nb-core-curriculum')
  END,
  name, display_family, display_priority, rule, count, sort_order, auto_generated
FROM requirement_groups
WHERE program_id = 'rbsnb-core-curriculum';

INSERT OR REPLACE INTO requirement_courses (
  group_id, course_code, note, source_title, source_credits
)
SELECT
  REPLACE(group_id, 'rbsnb-core-curriculum', 'rutgers-nb-core-curriculum'),
  course_code, note, source_title, source_credits
FROM requirement_courses
WHERE group_id LIKE 'rbsnb-core-curriculum-%';

INSERT OR IGNORE INTO requirement_group_conditions (
  group_id, condition_type, condition_value_json, note, source_url, review_status
)
SELECT
  REPLACE(group_id, 'rbsnb-core-curriculum', 'rutgers-nb-core-curriculum'),
  condition_type, condition_value_json, note, source_url, review_status
FROM requirement_group_conditions
WHERE group_id LIKE 'rbsnb-core-curriculum-%';

INSERT INTO school_curriculum_modules (
  school_slug, module_type, curriculum_program_id, source_url,
  review_status, reviewed_at, sort_order
) VALUES (
  'rbsnb',
  'core_curriculum',
  'rutgers-nb-core-curriculum',
  'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/core/about-sas-core',
  'reviewed',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  10
)
ON CONFLICT(school_slug, module_type) DO UPDATE SET
  curriculum_program_id = excluded.curriculum_program_id,
  source_url = excluded.source_url,
  review_status = excluded.review_status,
  reviewed_at = excluded.reviewed_at,
  sort_order = excluded.sort_order;

-- Several reviewed RBS concentration pages are intentionally current-source
-- only: their official pages do not state a catalog year. Show that fact in
-- the Programs modal instead of leaving the support boundary blank.
UPDATE programs
SET catalog_year = 'Current RBS page (catalog year not stated)'
WHERE school_slug = 'rbsnb'
  AND review_status = 'reviewed'
  AND catalog_year IS NULL;
