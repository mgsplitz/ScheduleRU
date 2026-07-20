-- Reviewed SAS New Brunswick Statistics major (program code 960).

INSERT INTO programs (
  id, name, school_slug, program_slug, type, catalog_year,
  academic_program_code, degree_type, program_family_id, source_url,
  review_status, last_scraped_at, requirement_evidence_required
) VALUES (
  'sasnb-statistics-major', 'Statistics', 'sasnb', 'statistics', 'major',
  'Current official page (catalog year not stated)', '960', 'B.A.', 'sasnb-statistics-960',
  'https://statistics.rutgers.edu/majors',
  'reviewed', strftime('%s','now') * 1000, 1
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name, school_slug=excluded.school_slug, program_slug=excluded.program_slug,
  type=excluded.type, catalog_year=excluded.catalog_year, academic_program_code=excluded.academic_program_code,
  degree_type=excluded.degree_type, program_family_id=excluded.program_family_id, source_url=excluded.source_url,
  review_status=excluded.review_status, last_scraped_at=excluded.last_scraped_at,
  requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id, source_url, source_title, source_catalog_year, source_scope, accessed_at, note)
VALUES
  ('sasnb-statistics-major', 'https://statistics.rutgers.edu/majors', 'Statistics majors', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Current official Department of Statistics requirements page; no catalog-year boundary stated.'),
  ('sasnb-statistics-major', 'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/statistics', 'Statistics (Major, Minor) | BA', NULL, 'program_profile', strftime('%s','now') * 1000, 'Current SAS profile confirms program code 960 and degree type.')
ON CONFLICT(program_id, source_url) DO UPDATE SET source_title=excluded.source_title, source_catalog_year=excluded.source_catalog_year, source_scope=excluded.source_scope, accessed_at=excluded.accessed_at, note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id = 'sasnb-statistics-major';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id = 'sasnb-statistics-major');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id = 'sasnb-statistics-major');
DELETE FROM requirement_groups WHERE program_id = 'sasnb-statistics-major';
DELETE FROM program_eligibility_rules WHERE program_id = 'sasnb-statistics-major';

INSERT INTO requirement_groups (id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated)
VALUES
  ('sasnb-statistics-major-computer-science', 'sasnb-statistics-major', NULL, 'One required Computer Science course.', 'min_courses', 1, 10, 0),
  ('sasnb-statistics-major-mathematics-core', 'sasnb-statistics-major', NULL, 'Required Mathematics courses.', 'all', NULL, 20, 0),
  ('sasnb-statistics-major-mathematics-elective', 'sasnb-statistics-major', NULL, 'One additional Mathematics elective.', 'min_courses', 1, 30, 0),
  ('sasnb-statistics-major-statistics-core', 'sasnb-statistics-major', NULL, 'Required Statistics courses.', 'all', NULL, 40, 0),
  ('sasnb-statistics-major-statistical-inference', 'sasnb-statistics-major', NULL, 'One approved Statistical Inference course.', 'min_courses', 1, 50, 0),
  ('sasnb-statistics-major-regression', 'sasnb-statistics-major', NULL, 'One approved regression or methods course.', 'min_courses', 1, 60, 0),
  ('sasnb-statistics-major-statistics-electives', 'sasnb-statistics-major', NULL, 'Two approved Statistics electives.', 'min_courses', 2, 70, 0);

INSERT INTO requirement_courses (group_id, course_code, note, source_title, source_credits)
VALUES
  ('sasnb-statistics-major-computer-science', '01:198:107', NULL, NULL, NULL),
  ('sasnb-statistics-major-computer-science', '01:198:110', NULL, NULL, NULL),
  ('sasnb-statistics-major-computer-science', '01:198:111', NULL, NULL, NULL),
  ('sasnb-statistics-major-computer-science', '01:198:170', NULL, NULL, NULL),
  ('sasnb-statistics-major-mathematics-core', '01:640:151', NULL, NULL, NULL),
  ('sasnb-statistics-major-mathematics-core', '01:640:152', NULL, NULL, NULL),
  ('sasnb-statistics-major-mathematics-core', '01:640:250', NULL, NULL, NULL),
  ('sasnb-statistics-major-mathematics-core', '01:640:251', NULL, NULL, NULL),
  ('sasnb-statistics-major-mathematics-elective', '01:640:252', NULL, NULL, NULL),
  ('sasnb-statistics-major-statistics-core', '01:960:381', NULL, NULL, NULL),
  ('sasnb-statistics-major-statistics-core', '01:960:382', NULL, NULL, NULL),
  ('sasnb-statistics-major-statistics-core', '01:960:463', NULL, NULL, NULL),
  ('sasnb-statistics-major-statistics-core', '01:960:486', NULL, NULL, NULL),
  ('sasnb-statistics-major-statistics-core', '01:960:490', NULL, NULL, NULL),
  ('sasnb-statistics-major-statistical-inference', '01:960:212', NULL, NULL, NULL),
  ('sasnb-statistics-major-statistical-inference', '01:960:384', NULL, NULL, NULL),
  ('sasnb-statistics-major-regression', '01:960:295', NULL, NULL, NULL),
  ('sasnb-statistics-major-regression', '01:960:390', NULL, NULL, NULL),
  ('sasnb-statistics-major-statistics-electives', '01:960:365', NULL, NULL, NULL),
  ('sasnb-statistics-major-statistics-electives', '01:960:467', NULL, NULL, NULL),
  ('sasnb-statistics-major-statistics-electives', '01:960:476', NULL, NULL, NULL),
  ('sasnb-statistics-major-statistics-electives', '01:960:483', NULL, NULL, NULL);

INSERT INTO requirement_course_selectors (group_id, selector_key, selector_json, source_url, source_label, review_status, reviewed_at)
VALUES (
  'sasnb-statistics-major-mathematics-elective',
  'sasnb-statistics-major-mathematics-300-to-499',
  '{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["640"],"course_number_min":300,"course_number_max":499,"exclude_course_codes":["01:640:477","01:640:481"]}',
  'https://statistics.rutgers.edu/majors', 'Statistics majors', 'reviewed', strftime('%s','now') * 1000
)
ON CONFLICT(group_id, selector_key) DO UPDATE SET selector_json=excluded.selector_json, source_url=excluded.source_url, source_label=excluded.source_label, review_status=excluded.review_status, reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key, program_id, entity_type, group_id, course_code, source_url, source_title, source_catalog_year, accessed_at, reviewer_note, review_status)
SELECT 'group:' || id, 'sasnb-statistics-major', 'group', id, NULL,
  'https://statistics.rutgers.edu/majors', 'Statistics majors', NULL, strftime('%s','now') * 1000,
  'Current official Department of Statistics requirements page; no catalog-year boundary stated.', 'reviewed'
FROM requirement_groups WHERE program_id = 'sasnb-statistics-major';

INSERT INTO program_requirement_evidence (entity_key, program_id, entity_type, group_id, course_code, source_url, source_title, source_catalog_year, accessed_at, reviewer_note, review_status)
SELECT 'course:' || requirement_courses.group_id || ':' || requirement_courses.course_code,
  'sasnb-statistics-major', 'course', requirement_courses.group_id, requirement_courses.course_code,
  'https://statistics.rutgers.edu/majors', 'Statistics majors', NULL, strftime('%s','now') * 1000,
  'Current official Department of Statistics requirements page; no catalog-year boundary stated.', 'reviewed'
FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id = 'sasnb-statistics-major');

INSERT INTO program_eligibility_rules (rule_key, program_id, condition_type, condition_value_json, decision, note, source_url, review_status, verified_at)
VALUES (
  'sasnb-statistics-major-academic-review', 'sasnb-statistics-major', 'advisor_confirmation',
  '{"topics":["overall C average in Calculus I and II for declaration","No courses with grade D can be counted toward the major","approved Mathematics elective credit"]}',
  'requires_approval',
  'Confirm the published declaration average, course-grade rule, and any Mathematics elective approval with Statistics advising before relying on this plan.',
  'https://statistics.rutgers.edu/majors', 'reviewed', strftime('%s','now') * 1000
)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id, condition_type=excluded.condition_type, condition_value_json=excluded.condition_value_json, decision=excluded.decision, note=excluded.note, source_url=excluded.source_url, review_status=excluded.review_status, verified_at=excluded.verified_at;
