-- Accounting Information Systems is listed in the Accounting major table as
-- "fulfilled in Business Core requirements." It is a source cross-reference,
-- not a second major requirement or extra three credits. Keep it in the
-- reviewed Accounting Business Core and preserve the source sentence as a
-- resolved note rather than showing a duplicate card.
--
-- Apply to development after the reviewed RBS major seed:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/review_rbs_accounting_business_core_reference.sql

DELETE FROM requirement_courses
WHERE group_id = 'rbsnb-accounting-g2'
  AND course_code = '33:010:458';

DELETE FROM requirement_raw_notes
WHERE program_id = 'rbsnb-accounting'
  AND section_name = 'Required Accounting Courses'
  AND raw_text LIKE '33:010:458%fulfilled in Business Core requirements%';

INSERT INTO requirement_raw_notes (program_id, section_name, raw_text, resolved)
VALUES (
  'rbsnb-accounting',
  'Required Accounting Courses',
  '33:010:458 Accounting Information Systems is fulfilled in Business Core requirements; it is shown once in Business Core and is not an additional required-major course or extra three credits.',
  1
);
