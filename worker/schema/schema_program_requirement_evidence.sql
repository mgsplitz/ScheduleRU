-- Requirement evidence gate (v1)
--
-- Apply once to the intended D1 environment after schema_programs.sql. This
-- migration is additive: legacy programs keep the default opt-out state until
-- their group and course rows have complete reviewed evidence.
--
-- For development:
--   npx wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/schema_program_requirement_evidence.sql

ALTER TABLE programs ADD COLUMN requirement_evidence_required INTEGER NOT NULL DEFAULT 0
  CHECK (requirement_evidence_required IN (0, 1));

CREATE TABLE IF NOT EXISTS program_requirement_evidence (
  entity_key TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('group', 'course')),
  group_id TEXT NOT NULL REFERENCES requirement_groups(id),
  course_code TEXT,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_catalog_year TEXT,
  accessed_at INTEGER NOT NULL,
  reviewer_note TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('unreviewed', 'reviewed', 'needs_fix')),
  CHECK ((entity_type = 'group' AND course_code IS NULL) OR (entity_type = 'course' AND course_code IS NOT NULL)),
  UNIQUE(program_id, entity_type, group_id, course_code)
);
