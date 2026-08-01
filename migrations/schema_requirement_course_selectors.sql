-- Reviewed course selectors (v1)
--
-- Use this only when an official requirement is expressed as a source-backed
-- course range or a reviewed finite list that cannot be represented by the
-- ordinary requirement_courses rows. The browser understands only the
-- documented selector shapes in course-selector-logic.js and fails closed on
-- malformed data.
--
-- Development command:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=../migrations/schema_requirement_course_selectors.sql

CREATE TABLE IF NOT EXISTS requirement_course_selectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES requirement_groups(id),
  selector_key TEXT NOT NULL,
  selector_json TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_label TEXT,
  review_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (review_status IN ('unreviewed', 'reviewed', 'needs_fix')),
  reviewed_at INTEGER,
  UNIQUE(group_id, selector_key)
);
CREATE INDEX IF NOT EXISTS idx_requirement_course_selectors_visible
  ON requirement_course_selectors(group_id, review_status);
