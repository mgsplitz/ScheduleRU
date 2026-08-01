-- Program academic metadata (v1)
--
-- Apply ONCE to an existing environment after schema_programs.sql. This
-- prepares the data model for school programs that have distinct B.A./B.S.
-- or option-specific paths. A path remains a normal program row so it can
-- own its own reviewed requirements; program_family_id lets related paths be
-- described together without a frontend exception.
--
-- Development command:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=../migrations/migrate_program_academic_metadata.sql

ALTER TABLE programs ADD COLUMN academic_program_code TEXT;
ALTER TABLE programs ADD COLUMN degree_type TEXT;
ALTER TABLE programs ADD COLUMN program_family_id TEXT;

CREATE INDEX IF NOT EXISTS idx_programs_family ON programs(program_family_id);
