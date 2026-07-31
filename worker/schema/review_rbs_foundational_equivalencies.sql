-- RBS New Brunswick foundational equivalencies (reviewed 2026-07-27).
--
-- These are data relationships consumed by the generic academic-credit
-- resolver. They intentionally live on both the reusable Foundational Core
-- requirement set and its RBS Core curriculum counterpart so every planner
-- surface receives the same alternatives.

INSERT INTO requirement_course_equivalencies (
  program_id,
  requirement_course_code,
  equivalent_course_code,
  note,
  source_label,
  review_status
)
VALUES
  (
    'rbsnb-foundational-core',
    '01:198:170',
    '01:198:111',
    'Introduction to Computer Science satisfies the RBS Computer Applications for Business foundational requirement.',
    'User-confirmed Degree Navigator behavior, 2026-07-27',
    'reviewed'
  ),
  (
    'rbsnb-core-curriculum',
    '01:198:170',
    '01:198:111',
    'Introduction to Computer Science satisfies the RBS Computer Applications for Business foundational requirement.',
    'User-confirmed Degree Navigator behavior, 2026-07-27',
    'reviewed'
  ),
  (
    'rbsnb-foundational-core',
    '01:960:285',
    '01:960:211',
    'Statistics I is an accepted RBS statistics-foundation substitute; AP Statistics awards Statistics I.',
    'Rutgers Business School transfer guidance and SAS AP table, reviewed 2026-07-27',
    'reviewed'
  ),
  (
    'rbsnb-core-curriculum',
    '01:960:285',
    '01:960:211',
    'Statistics I is an accepted RBS statistics-foundation substitute; AP Statistics awards Statistics I.',
    'Rutgers Business School transfer guidance and SAS AP table, reviewed 2026-07-27',
    'reviewed'
  )
ON CONFLICT(program_id, requirement_course_code, equivalent_course_code)
DO UPDATE SET
  note = excluded.note,
  source_label = excluded.source_label,
  review_status = excluded.review_status;
