-- Reviewed SAS New Brunswick Computer Science minor (program code 198).
--
-- The Department publishes a finite approved set for the current minor.
-- Its six-course total and two-course upper-level subset are represented as
-- a normal nested constraint; grade, residency, advisor-consultation, and
-- the announced Spring 2027 introductory-sequence transition stay advisory.

INSERT INTO programs (
  id, name, school_slug, program_slug, type, catalog_year,
  academic_program_code, degree_type, program_family_id, source_url,
  review_status, last_scraped_at, requirement_evidence_required
) VALUES (
  'sasnb-computer-science-minor', 'Computer Science', 'sasnb', 'computer-science-minor', 'minor',
  'Current official page (Spring 2027 sequence transition announced)', '198', NULL, 'sasnb-computer-science-198',
  'https://www.cs.rutgers.edu/academics/undergraduate/cs-degrees/minor-in-cs',
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
) VALUES
  (
    'sasnb-computer-science-minor',
    'https://www.cs.rutgers.edu/academics/undergraduate/cs-degrees/minor-in-cs',
    'Minor in Computer Science', NULL, 'program_requirements',
    strftime('%s','now') * 1000,
    'Current official Department of Computer Science minor page; no catalog-year boundary stated.'
  ),
  (
    'sasnb-computer-science-minor',
    'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/computer-science',
    'Computer Science (Minor)', NULL, 'program_profile',
    strftime('%s','now') * 1000,
    'Current SAS profile confirms program code 198, SAS ownership, and no minor declaration requirement.'
  ),
  (
    'sasnb-computer-science-minor',
    'https://www.cs.rutgers.edu/academics/undergraduate/new-introductory-computer-science-course-sequence',
    'New Introductory Computer Science Course Sequence', NULL, 'curriculum_transition',
    strftime('%s','now') * 1000,
    'The department announces an introductory-sequence transition beginning Spring 2027; review the minor source again before relying on this current path for later terms.'
  )
ON CONFLICT(program_id, source_url) DO UPDATE SET
  source_title=excluded.source_title,
  source_catalog_year=excluded.source_catalog_year,
  source_scope=excluded.source_scope,
  accessed_at=excluded.accessed_at,
  note=excluded.note;

DELETE FROM program_requirement_evidence
WHERE program_id = 'sasnb-computer-science-minor';

DELETE FROM requirement_course_selectors
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-computer-science-minor'
);

DELETE FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-computer-science-minor'
);

DELETE FROM requirement_groups
WHERE program_id = 'sasnb-computer-science-minor';

DELETE FROM program_eligibility_rules
WHERE program_id = 'sasnb-computer-science-minor';

INSERT INTO requirement_groups (
  id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated
) VALUES
  (
    'sasnb-computer-science-minor-approved-courses', 'sasnb-computer-science-minor', NULL,
    'Six approved Computer Science courses.', 'min_courses', 6, 10, 0
  ),
  (
    'sasnb-computer-science-minor-upper-level', 'sasnb-computer-science-minor',
    'sasnb-computer-science-minor-approved-courses',
    'At least two approved 300- or 400-level Computer Science courses.', 'min_courses', 2, 10, 0
  );

INSERT INTO requirement_courses (group_id, course_code, note, source_title, source_credits)
VALUES
  ('sasnb-computer-science-minor-approved-courses', '01:198:111', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:112', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:205', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:206', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:210', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:211', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:213', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:214', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:314', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:323', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:324', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:334', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:336', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:344', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:345', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:352', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:411', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:415', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:416', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:417', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:419', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:424', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:425', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:428', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:431', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:437', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:439', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:440', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:442', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:452', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:460', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:461', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-approved-courses', '01:198:462', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:314', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:323', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:324', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:334', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:336', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:344', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:345', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:352', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:411', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:415', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:416', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:417', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:419', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:424', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:425', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:428', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:431', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:437', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:439', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:440', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:442', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:452', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:460', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:461', NULL, NULL, NULL),
  ('sasnb-computer-science-minor-upper-level', '01:198:462', NULL, NULL, NULL);

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'group:' || id,
  'sasnb-computer-science-minor',
  'group',
  id,
  NULL,
  'https://www.cs.rutgers.edu/academics/undergraduate/cs-degrees/minor-in-cs',
  'Minor in Computer Science',
  NULL,
  strftime('%s','now') * 1000,
  'Current official Department of Computer Science minor page; no catalog-year boundary stated.',
  'reviewed'
FROM requirement_groups
WHERE program_id = 'sasnb-computer-science-minor';

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'course:' || requirement_courses.group_id || ':' || requirement_courses.course_code,
  'sasnb-computer-science-minor',
  'course',
  requirement_courses.group_id,
  requirement_courses.course_code,
  'https://www.cs.rutgers.edu/academics/undergraduate/cs-degrees/minor-in-cs',
  'Minor in Computer Science',
  NULL,
  strftime('%s','now') * 1000,
  'Current official Department of Computer Science minor page; no catalog-year boundary stated.',
  'reviewed'
FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-computer-science-minor'
);

INSERT INTO program_eligibility_rules (
  rule_key, program_id, condition_type, condition_value_json, decision,
  note, source_url, review_status, verified_at
) VALUES (
  'sasnb-computer-science-minor-academic-review',
  'sasnb-computer-science-minor',
  'advisor_confirmation',
  '{"topics":["course choices must be made in consultation with a departmental advisor","no more than one D may be accepted","At least five of the courses used to satisfy the requirements of the minor must be courses taken in the New Brunswick Department of Computer Science","Spring 2027 introductory-sequence transition"]}',
  'requires_approval',
  'Confirm approved course choices, grades, New Brunswick Computer Science residency, and requirements for terms beginning Spring 2027 with Computer Science advising before relying on this plan.',
  'https://www.cs.rutgers.edu/academics/undergraduate/cs-degrees/minor-in-cs',
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
