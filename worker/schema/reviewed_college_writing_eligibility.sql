-- College Writing eligibility review (reviewed 2026-07-29).
--
-- The live Schedule of Classes description exposes placement/support-course
-- alternatives in its prerequisite text. Those alternatives are not a
-- universal course chain: SAS describes College Writing (or its equivalent)
-- as the starting WC requirement and says the student's English placement
-- identifies the appropriate first writing course. ScheduleRU therefore must
-- not auto-schedule Basic Composition or Academic Writing before 01:355:101.
--
-- Apply after schema_course_eligibility_conditions.sql:
--   npx wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/reviewed_college_writing_eligibility.sql

INSERT INTO course_eligibility_reviews (
  course_code, campus_slug, catalog_year, review_status, no_known_conditions,
  source_url, source_label, source_date, reviewed_at, note
)
VALUES (
  '01:355:101',
  'sasnb',
  'Current SAS Core Curriculum page (catalog year not stated)',
  'reviewed',
  1,
  'https://www.sasundergrad.rutgers.edu/majors-and-core-curriculum/core/cognitive-skills-and-processes-writing-and-communication',
  'Rutgers SAS Core: Writing and Communication',
  '2026-07-29',
  strftime('%s','now') * 1000,
  'No universal prerequisite course is enforced by ScheduleRU. English placement determines whether College Writing, College Writing Extended, or another equivalent is the appropriate starting course.'
)
ON CONFLICT(course_code) DO UPDATE SET
  campus_slug = excluded.campus_slug,
  catalog_year = excluded.catalog_year,
  review_status = excluded.review_status,
  no_known_conditions = excluded.no_known_conditions,
  source_url = excluded.source_url,
  source_label = excluded.source_label,
  source_date = excluded.source_date,
  reviewed_at = excluded.reviewed_at,
  note = excluded.note;

DELETE FROM course_eligibility_conditions
WHERE course_code = '01:355:101';
