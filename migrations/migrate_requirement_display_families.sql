-- Requirement display families (v1)
--
-- Existing-database compatibility only. New databases already receive these
-- columns from schema_programs.sql. Reviewed family values are restored from
-- the catalog snapshot; this migration contains no academic content.
--
-- Run once after schema_programs.sql, against the intended environment:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=../migrations/migrate_requirement_display_families.sql

ALTER TABLE requirement_groups ADD COLUMN display_family TEXT;
ALTER TABLE requirement_groups ADD COLUMN display_priority INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_reqgroups_display_family
  ON requirement_groups(display_family, display_priority);
