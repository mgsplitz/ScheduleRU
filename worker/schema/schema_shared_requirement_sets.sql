-- Shared requirement sets (v1)
--
-- A requirement set is stored as a non-selectable row in `programs` with
-- type = 'shared_requirement_set'. Its existing requirement_groups and
-- requirement_courses rows are then linked to one or more real programs
-- here. This keeps school-wide requirements (such as RBS Foundational Core,
-- formerly Pre-Business) in one place instead of copying their course rows
-- into every major.
--
-- Run once against the hosted database:
--   wrangler d1 execute rutgers_courses --remote --file=schema_shared_requirement_sets.sql

CREATE TABLE IF NOT EXISTS program_requirement_sets (
  program_id TEXT NOT NULL REFERENCES programs(id),
  requirement_set_id TEXT NOT NULL REFERENCES programs(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (program_id, requirement_set_id),
  CHECK (program_id <> requirement_set_id)
);

CREATE INDEX IF NOT EXISTS idx_program_requirement_sets_program
  ON program_requirement_sets(program_id, sort_order);
