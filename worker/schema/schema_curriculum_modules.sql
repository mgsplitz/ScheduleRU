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
-- Catalog programs are restored from the catalog snapshot. School attachments
-- are restored from the reference-data snapshot.

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

-- Reviewed rows are restored from
-- reference-data/snapshots/reviewed-reference-data.v1.json.
