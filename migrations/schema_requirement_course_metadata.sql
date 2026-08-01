-- Requirement-course source metadata (v1)
--
-- A degree requirement is valid for a full catalog year, while the live
-- Schedule of Classes only contains courses offered in the current term.
-- Keep the title and credit value printed on the official program page with
-- each requirement row, so a course card never becomes an unexplained code
-- when it is not offered this term.
--
-- Run once against the hosted database:
--   wrangler d1 execute rutgers_courses --remote --file=../migrations/schema_requirement_course_metadata.sql

ALTER TABLE requirement_courses ADD COLUMN source_title TEXT;
ALTER TABLE requirement_courses ADD COLUMN source_credits TEXT;
