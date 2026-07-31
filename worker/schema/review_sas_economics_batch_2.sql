-- Reviewed SAS New Brunswick Economics program, batch 2.
--
-- The traditional Economics minor is a source-backed, selector-based path.
-- Its official page permits all New Brunswick Economics 300- and 400-level
-- courses plus the named core courses, so the reviewed selector records that
-- published range rather than freezing a current-term course list.

INSERT INTO programs (
  id, name, school_slug, program_slug, type, catalog_year,
  academic_program_code, degree_type, program_family_id, source_url,
  review_status, last_scraped_at, requirement_evidence_required
) VALUES (
  'sasnb-economics-minor', 'Economics', 'sasnb', 'economics-minor', 'minor',
  'Current official page (catalog year not stated)', '220', NULL, 'sasnb-economics-220',
  'https://economics.rutgers.edu/academics/undergraduate/minors/minor-in-economics',
  'reviewed', strftime('%s','now') * 1000, 1
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,
  school_slug=excluded.school_slug,
  program_slug=excluded.program_slug,
  type=excluded.type,
  catalog_year=excluded.catalog_year,
  academic_program_code=excluded.academic_program_code,
  degree_type=excluded.degree_type,
  program_family_id=excluded.program_family_id,
  source_url=excluded.source_url,
  review_status=excluded.review_status,
  last_scraped_at=excluded.last_scraped_at,
  requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (
  program_id, source_url, source_title, source_catalog_year, source_scope,
  accessed_at, note
) VALUES (
  'sasnb-economics-minor',
  'https://economics.rutgers.edu/academics/undergraduate/minors/minor-in-economics',
  'Minor in Economics', NULL, 'program_requirements',
  strftime('%s','now') * 1000,
  'Current official Department of Economics requirements page; no catalog-year boundary stated.'
)
ON CONFLICT(program_id, source_url) DO UPDATE SET
  source_title=excluded.source_title,
  source_catalog_year=excluded.source_catalog_year,
  source_scope=excluded.source_scope,
  accessed_at=excluded.accessed_at,
  note=excluded.note;

DELETE FROM program_requirement_evidence
WHERE program_id = 'sasnb-economics-minor';

DELETE FROM requirement_course_selectors
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-economics-minor'
);

DELETE FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-economics-minor'
);

DELETE FROM requirement_groups
WHERE program_id = 'sasnb-economics-minor';

DELETE FROM program_eligibility_rules
WHERE program_id = 'sasnb-economics-minor';

INSERT INTO requirement_groups (
  id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated
) VALUES
  ('sasnb-economics-minor-core', 'sasnb-economics-minor', NULL, 'Three required Economics courses.', 'all', NULL, 10, 0),
  ('sasnb-economics-minor-electives', 'sasnb-economics-minor', NULL, 'Three New Brunswick Economics 300- or 400-level courses.', 'min_courses', 3, 20, 0);

INSERT INTO requirement_courses (group_id, course_code, note, source_title, source_credits)
VALUES
  ('sasnb-economics-minor-core', '01:220:102', NULL, 'Introduction to Microeconomics', '3'),
  ('sasnb-economics-minor-core', '01:220:103', NULL, 'Introduction to Macroeconomics', '3'),
  ('sasnb-economics-minor-core', '01:220:212', NULL, 'Economic Data Analytics: Introduction to Data Management, Statistics and Regression Analysis', '3');

INSERT INTO requirement_course_selectors (
  group_id, selector_key, selector_json, source_url, source_label,
  review_status, reviewed_at
) VALUES (
  'sasnb-economics-minor-electives',
  'sasnb-economics-minor-nb-300-to-499',
  '{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["220"],"course_number_min":300,"course_number_max":499}',
  'https://economics.rutgers.edu/academics/undergraduate/minors/minor-in-economics',
  'Minor in Economics',
  'reviewed', strftime('%s','now') * 1000
)
ON CONFLICT(group_id, selector_key) DO UPDATE SET
  selector_json=excluded.selector_json,
  source_url=excluded.source_url,
  source_label=excluded.source_label,
  review_status=excluded.review_status,
  reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'group:' || id,
  'sasnb-economics-minor',
  'group',
  id,
  NULL,
  'https://economics.rutgers.edu/academics/undergraduate/minors/minor-in-economics',
  'Minor in Economics',
  NULL,
  strftime('%s','now') * 1000,
  'Current official Department of Economics requirements page; no catalog-year boundary stated.',
  'reviewed'
FROM requirement_groups
WHERE program_id = 'sasnb-economics-minor';

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'course:' || requirement_courses.group_id || ':' || requirement_courses.course_code,
  'sasnb-economics-minor',
  'course',
  requirement_courses.group_id,
  requirement_courses.course_code,
  'https://economics.rutgers.edu/academics/undergraduate/minors/minor-in-economics',
  'Minor in Economics',
  NULL,
  strftime('%s','now') * 1000,
  'Current official Department of Economics requirements page; no catalog-year boundary stated.',
  'reviewed'
FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-economics-minor'
);

INSERT INTO program_eligibility_rules (
  rule_key, program_id, condition_type, condition_value_json, decision,
  note, source_url, review_status, verified_at
) VALUES (
  'sasnb-economics-minor-academic-review',
  'sasnb-economics-minor',
  'advisor_confirmation',
  '{"topics":["minimum course grades","approved outside-department credit","Engineering Economics eligibility"]}',
  'requires_approval',
  'Confirm the published grade, approved outside-department credit, and Engineering Economics rules with Economics advising before relying on this plan.',
  'https://economics.rutgers.edu/academics/undergraduate/minors/minor-in-economics',
  'reviewed', strftime('%s','now') * 1000
)
ON CONFLICT(rule_key) DO UPDATE SET
  program_id=excluded.program_id,
  condition_type=excluded.condition_type,
  condition_value_json=excluded.condition_value_json,
  decision=excluded.decision,
  note=excluded.note,
  source_url=excluded.source_url,
  review_status=excluded.review_status,
  verified_at=excluded.verified_at;
