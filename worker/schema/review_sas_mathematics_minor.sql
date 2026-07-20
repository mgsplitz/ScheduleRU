-- Reviewed SAS New Brunswick Mathematics minor (program code 640).
--
-- The official Department of Mathematics page publishes a complete minor
-- shape: the ordinary calculus sequence, Linear Algebra, and four 3-credit
-- Mathematics electives.  The elective selector deliberately excludes the
-- two courses the department says cannot satisfy the minor.

INSERT INTO programs (
  id, name, school_slug, program_slug, type, catalog_year,
  academic_program_code, degree_type, program_family_id, source_url,
  review_status, last_scraped_at, requirement_evidence_required
) VALUES (
  'sasnb-mathematics-minor', 'Mathematics', 'sasnb', 'mathematics-minor', 'minor',
  'Current official page (catalog year not stated)', '640', NULL, 'sasnb-mathematics-640',
  'https://math.rutgers.edu/academics/undergraduate/minors',
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
    'sasnb-mathematics-minor',
    'https://math.rutgers.edu/academics/undergraduate/minors',
    'Mathematics minors', NULL, 'program_requirements',
    strftime('%s','now') * 1000,
    'Current official Department of Mathematics requirements page; no catalog-year boundary stated.'
  ),
  (
    'sasnb-mathematics-minor',
    'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/mathematics',
    'Mathematics (Major, Minor) | BA or BS', NULL, 'program_profile',
    strftime('%s','now') * 1000,
    'Current SAS profile confirms program code 640, SAS ownership, and no minor declaration requirement.'
  )
ON CONFLICT(program_id, source_url) DO UPDATE SET
  source_title=excluded.source_title,
  source_catalog_year=excluded.source_catalog_year,
  source_scope=excluded.source_scope,
  accessed_at=excluded.accessed_at,
  note=excluded.note;

DELETE FROM program_requirement_evidence
WHERE program_id = 'sasnb-mathematics-minor';

DELETE FROM requirement_course_selectors
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-mathematics-minor'
);

DELETE FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-mathematics-minor'
);

DELETE FROM requirement_groups
WHERE program_id = 'sasnb-mathematics-minor';

DELETE FROM program_eligibility_rules
WHERE program_id = 'sasnb-mathematics-minor';

INSERT INTO requirement_groups (
  id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated
) VALUES
  (
    'sasnb-mathematics-minor-calculus', 'sasnb-mathematics-minor', NULL,
    'Three terms of Calculus.', 'all', NULL, 10, 0
  ),
  (
    'sasnb-mathematics-minor-linear-algebra', 'sasnb-mathematics-minor', NULL,
    'Introduction to Linear Algebra.', 'all', NULL, 20, 0
  ),
  (
    'sasnb-mathematics-minor-electives', 'sasnb-mathematics-minor', NULL,
    'Four additional 3-credit Mathematics courses.', 'min_courses', 4, 30, 0
  );

INSERT INTO requirement_courses (group_id, course_code, note, source_title, source_credits)
VALUES
  ('sasnb-mathematics-minor-calculus', '01:640:151', 'Ordinary first calculus term.', 'Calculus I for Mathematical and Physical Sciences', '4'),
  ('sasnb-mathematics-minor-calculus', '01:640:152', 'Ordinary second calculus term.', 'Calculus II for Mathematical and Physical Sciences', '4'),
  ('sasnb-mathematics-minor-calculus', '01:640:251', 'Ordinary third calculus term.', 'Multivariable Calculus', '4'),
  ('sasnb-mathematics-minor-linear-algebra', '01:640:250', NULL, 'Introduction to Linear Algebra', '3'),
  ('sasnb-mathematics-minor-electives', '01:640:244', NULL, 'Differential Equations for Engineering and Physics', '3'),
  ('sasnb-mathematics-minor-electives', '01:640:252', NULL, 'Elementary Differential Equations', '3');

INSERT INTO requirement_course_selectors (
  group_id, selector_key, selector_json, source_url, source_label,
  review_status, reviewed_at
) VALUES (
  'sasnb-mathematics-minor-electives',
  'sasnb-mathematics-minor-nb-300-to-499',
  '{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["640"],"course_number_min":300,"course_number_max":499,"exclude_course_codes":["01:640:491","01:640:492"]}',
  'https://math.rutgers.edu/academics/undergraduate/minors',
  'Mathematics minors',
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
  'sasnb-mathematics-minor',
  'group',
  id,
  NULL,
  'https://math.rutgers.edu/academics/undergraduate/minors',
  'Mathematics minors',
  NULL,
  strftime('%s','now') * 1000,
  'Current official Department of Mathematics requirements page; no catalog-year boundary stated.',
  'reviewed'
FROM requirement_groups
WHERE program_id = 'sasnb-mathematics-minor';

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'course:' || requirement_courses.group_id || ':' || requirement_courses.course_code,
  'sasnb-mathematics-minor',
  'course',
  requirement_courses.group_id,
  requirement_courses.course_code,
  'https://math.rutgers.edu/academics/undergraduate/minors',
  'Mathematics minors',
  NULL,
  strftime('%s','now') * 1000,
  'Current official Department of Mathematics requirements page; no catalog-year boundary stated.',
  'reviewed'
FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-mathematics-minor'
);

INSERT INTO program_eligibility_rules (
  rule_key, program_id, condition_type, condition_value_json, decision,
  note, source_url, review_status, verified_at
) VALUES (
  'sasnb-mathematics-minor-academic-review',
  'sasnb-mathematics-minor',
  'advisor_confirmation',
  '{"topics":["calculus-course equivalencies","minimum course grades","At least three out of the four elective courses must be taken at Rutgers - New Brunswick/Piscataway"]}',
  'requires_approval',
  'Confirm calculus equivalents, published course-grade rules, and the Rutgers-New Brunswick/Piscataway elective-residency requirement with Mathematics advising before relying on this plan.',
  'https://math.rutgers.edu/academics/undergraduate/minors',
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
