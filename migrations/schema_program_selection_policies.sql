-- Program-selection policy data (v1)
--
-- Run against the intended environment only, for example:
--   npx wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=../migrations/schema_program_selection_policies.sql
--
-- WHY THIS IS SEPARATE FROM double_count_policies:
-- Double-count policies govern whether one COURSE can satisfy two programs.
-- These tables govern whether a STUDENT may select a combination of programs
-- in the first place. Rutgers rules differ by a student's home school, the
-- type of program, and sometimes a named pair of programs. Do not turn these
-- rows into an application-wide maximum.

CREATE TABLE IF NOT EXISTS program_selection_limits (
  home_school_slug TEXT NOT NULL,
  program_type TEXT NOT NULL,       -- major | minor | concentration | certificate | ...
  max_selected INTEGER NOT NULL CHECK (max_selected >= 0),
  note TEXT NOT NULL,
  source_url TEXT NOT NULL,
  verified_at INTEGER NOT NULL,
  PRIMARY KEY (home_school_slug, program_type)
);

CREATE TABLE IF NOT EXISTS program_combination_policies (
  policy_key TEXT PRIMARY KEY,
  home_school_slug TEXT NOT NULL,

  -- A side can match a named program, a school, a type, or a combination of
  -- those fields. Both sides need at least one populated matcher; the Worker
  -- rejects blank policy sides defensively.
  program_a_id TEXT,
  program_a_school_slug TEXT,
  program_a_type TEXT,
  program_b_id TEXT,
  program_b_school_slug TEXT,
  program_b_type TEXT,
  same_program_family INTEGER NOT NULL DEFAULT 0
    CHECK (same_program_family IN (0, 1)),

  -- "blocked" means the app must not save the selection. "requires_transfer"
  -- is also blocked for the current home school. "requires_approval" remains
  -- selectable but must be shown as an advising warning. "allowed" records a
  -- reviewed positive exception when a future school needs one.
  decision TEXT NOT NULL CHECK (decision IN ('allowed', 'blocked', 'requires_approval', 'requires_transfer')),
  note TEXT NOT NULL,
  source_url TEXT NOT NULL,
  verified_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_program_selection_limits_home_school
  ON program_selection_limits(home_school_slug);
CREATE INDEX IF NOT EXISTS idx_program_combination_policies_home_school
  ON program_combination_policies(home_school_slug);

-- Reviewed rows are restored from
-- reference-data/snapshots/reviewed-reference-data.v1.json.
