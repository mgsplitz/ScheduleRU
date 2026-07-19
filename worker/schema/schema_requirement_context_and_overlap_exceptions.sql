-- Contextual requirement paths and narrow double-count exceptions (v1)
--
-- Apply before any reviewed program data that uses these tables:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/schema_requirement_context_and_overlap_exceptions.sql

CREATE TABLE IF NOT EXISTS requirement_group_conditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES requirement_groups(id),
  condition_type TEXT NOT NULL,
  condition_value_json TEXT NOT NULL,
  note TEXT,
  source_url TEXT,
  review_status TEXT DEFAULT 'unreviewed',
  UNIQUE(group_id, condition_type, condition_value_json)
);
CREATE INDEX IF NOT EXISTS idx_reqgroupconditions_group ON requirement_group_conditions(group_id);

CREATE TABLE IF NOT EXISTS double_count_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_a TEXT NOT NULL REFERENCES programs(id),
  program_b TEXT NOT NULL REFERENCES programs(id),
  allowed_course_codes_json TEXT NOT NULL,
  note TEXT,
  source_url TEXT,
  review_status TEXT DEFAULT 'unreviewed',
  verified_at INTEGER,
  UNIQUE(program_a, program_b)
);
CREATE INDEX IF NOT EXISTS idx_doublecountexceptions_program_a ON double_count_exceptions(program_a);
CREATE INDEX IF NOT EXISTS idx_doublecountexceptions_program_b ON double_count_exceptions(program_b);
