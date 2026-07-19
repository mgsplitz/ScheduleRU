-- Reviewed alternatives for a specific requirement-course row (v1)
--
-- Some Degree Navigator families accept a course that is not printed in the
-- public catalog's short requirement list. Store those rules as reviewed
-- program data, rather than hardcoding course-specific behavior in the UI.
--
-- Run once against the hosted database:
--   wrangler d1 execute rutgers_courses --remote --file=schema_requirement_course_equivalencies.sql

CREATE TABLE IF NOT EXISTS requirement_course_equivalencies (
  program_id TEXT NOT NULL REFERENCES programs(id),
  requirement_course_code TEXT NOT NULL,
  equivalent_course_code TEXT NOT NULL,
  note TEXT,
  source_label TEXT,
  review_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (review_status IN ('reviewed', 'needs_review')),
  PRIMARY KEY (program_id, requirement_course_code, equivalent_course_code)
);

CREATE INDEX IF NOT EXISTS idx_requirement_course_equivalencies_requirement
  ON requirement_course_equivalencies(program_id, requirement_course_code, review_status);
