-- Program provenance and eligibility rules (v1)
--
-- Programs, requirement groups, and course rows say WHAT a program requires.
-- This migration records WHERE each program fact came from and WHO may formally
-- declare it. Keeping these facts separate prevents a course-requirement tree
-- from silently losing rules such as "for non-RBS students only" or a GPA
-- threshold.
--
-- Apply to one environment at a time. For development:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/schema_program_provenance_and_eligibility.sql

CREATE TABLE IF NOT EXISTS program_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id TEXT NOT NULL REFERENCES programs(id),
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_catalog_year TEXT,
  source_scope TEXT NOT NULL DEFAULT 'program_requirements',
  accessed_at INTEGER NOT NULL,
  note TEXT,
  UNIQUE(program_id, source_url)
);
CREATE INDEX IF NOT EXISTS idx_program_sources_program ON program_sources(program_id);

-- Atomic declaration/eligibility rules. `condition_value_json` deliberately
-- stays flexible so the same table works for an exact program id today and
-- a set of acceptable transfer equivalents later. Every row is still typed,
-- source-backed, and review-gated.
--
-- Current condition types:
--   home_school_must_be_one_of
--   home_school_must_not_be_one_of
--   selected_program_must_include_one_of
--   selected_program_must_not_include_any
--   minimum_total_credits
--   minimum_gpa
--   minimum_course_grade
--   course_completion_or_placement
--   application_required
--   advisor_confirmation
--
-- `blocked` is enforced when the app can evaluate the condition from the
-- selected programs/home school. `requires_approval` and `information` are
-- visible planning facts, not a claim that the app can verify grades or GPA.
CREATE TABLE IF NOT EXISTS program_eligibility_rules (
  rule_key TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id),
  condition_type TEXT NOT NULL,
  condition_value_json TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('blocked', 'requires_approval', 'information')),
  note TEXT NOT NULL,
  source_url TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (review_status IN ('unreviewed', 'reviewed', 'needs_fix')),
  verified_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_program_eligibility_program
  ON program_eligibility_rules(program_id, review_status);
