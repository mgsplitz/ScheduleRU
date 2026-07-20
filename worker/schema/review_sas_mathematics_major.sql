-- Reviewed SAS New Brunswick Mathematics major (program code 640).
--
-- Rutgers publishes two degree paths under Mathematics: the Standard Option
-- leading to a B.A. and the Honors Track leading to a B.S.  They are seeded
-- as separate reviewed paths because the Honors Track is not a stricter copy
-- of the Standard Option.  The Actuarial Track is a separately catalog-listed
-- path and is deliberately not claimed by this audit.

INSERT INTO programs (
  id, name, school_slug, program_slug, type, catalog_year,
  academic_program_code, degree_type, program_family_id, source_url,
  review_status, last_scraped_at, requirement_evidence_required
) VALUES
  (
    'sasnb-mathematics-ba', 'Mathematics - B.A. Standard Option', 'sasnb', 'mathematics', 'major',
    'Current official departmental and SAS pages', '640', 'B.A.', 'sasnb-mathematics-640',
    'https://math.rutgers.edu/academics/undergraduate/majors',
    'reviewed', strftime('%s','now') * 1000, 1
  ),
  (
    'sasnb-mathematics-honors-bs', 'Mathematics - B.S. Honors Track', 'sasnb', 'mathematics', 'major',
    'Current official departmental and SAS pages', '640', 'B.S.', 'sasnb-mathematics-640',
    'https://math.rutgers.edu/academics/undergraduate/honors/honors-menu/honors-track-option',
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
    'sasnb-mathematics-ba',
    'https://math.rutgers.edu/academics/undergraduate/majors',
    'Mathematics majors', NULL, 'program_requirements', strftime('%s','now') * 1000,
    'Current Department of Mathematics page defining the common major requirements and Standard Option B.A. course structure.'
  ),
  (
    'sasnb-mathematics-ba',
    'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/mathematics',
    'Mathematics (Major, Minor) | BA or BS', NULL, 'program_profile', strftime('%s','now') * 1000,
    'Current SAS profile confirms SAS ownership, program code 640, and the B.A./B.S. degree distinction.'
  ),
  (
    'sasnb-mathematics-honors-bs',
    'https://math.rutgers.edu/academics/undergraduate/honors/honors-menu/honors-track-option',
    'Honors Track/BS Option', NULL, 'program_requirements', strftime('%s','now') * 1000,
    'Current Department of Mathematics Honors Track requirements page.'
  ),
  (
    'sasnb-mathematics-honors-bs',
    'https://math.rutgers.edu/academics/undergraduate/majors',
    'Mathematics majors', NULL, 'program_requirements', strftime('%s','now') * 1000,
    'Current common Mathematics-major requirements, which also apply to the Honors Track.'
  ),
  (
    'sasnb-mathematics-honors-bs',
    'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/mathematics',
    'Mathematics (Major, Minor) | BA or BS', NULL, 'program_profile', strftime('%s','now') * 1000,
    'Current SAS profile confirms SAS ownership, program code 640, and the B.A./B.S. degree distinction.'
  )
ON CONFLICT(program_id, source_url) DO UPDATE SET
  source_title=excluded.source_title,
  source_catalog_year=excluded.source_catalog_year,
  source_scope=excluded.source_scope,
  accessed_at=excluded.accessed_at,
  note=excluded.note;

DELETE FROM program_requirement_evidence
WHERE program_id IN ('sasnb-mathematics-ba', 'sasnb-mathematics-honors-bs');

DELETE FROM requirement_course_selectors
WHERE group_id IN (
  SELECT id FROM requirement_groups
  WHERE program_id IN ('sasnb-mathematics-ba', 'sasnb-mathematics-honors-bs')
);

DELETE FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups
  WHERE program_id IN ('sasnb-mathematics-ba', 'sasnb-mathematics-honors-bs')
);

DELETE FROM requirement_groups
WHERE program_id IN ('sasnb-mathematics-ba', 'sasnb-mathematics-honors-bs');

DELETE FROM program_eligibility_rules
WHERE program_id IN ('sasnb-mathematics-ba', 'sasnb-mathematics-honors-bs');

INSERT INTO requirement_groups (
  id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated
) VALUES
  -- Standard B.A. core shared by every Mathematics major.
  ('sasnb-mathematics-ba-calculus', 'sasnb-mathematics-ba', NULL,
    'Three terms of Calculus.', 'all', NULL, 10, 0),
  ('sasnb-mathematics-ba-linear-algebra', 'sasnb-mathematics-ba', NULL,
    'Introduction to Linear Algebra.', 'all', NULL, 20, 0),
  ('sasnb-mathematics-ba-differential-equations', 'sasnb-mathematics-ba', NULL,
    'Elementary Differential Equations.', 'all', NULL, 30, 0),
  ('sasnb-mathematics-ba-computing', 'sasnb-mathematics-ba', NULL,
    'One approved introductory computing course.', 'one_of', NULL, 40, 0),
  ('sasnb-mathematics-ba-computing-107', 'sasnb-mathematics-ba', 'sasnb-mathematics-ba-computing',
    'Introduction to Computing for Mathematics and the Sciences.', 'all', NULL, 10, 0),
  ('sasnb-mathematics-ba-computing-111', 'sasnb-mathematics-ba', 'sasnb-mathematics-ba-computing',
    'Introduction to Computer Science.', 'all', NULL, 20, 0),
  ('sasnb-mathematics-ba-computing-332-252', 'sasnb-mathematics-ba', 'sasnb-mathematics-ba-computing',
    'SAS-listed alternative introductory programming course.', 'all', NULL, 30, 0),
  -- Standard B.A. option.
  ('sasnb-mathematics-ba-upper-level-total', 'sasnb-mathematics-ba', NULL,
    'Eight 3-credit Mathematics courses at the 300-400 level.', 'min_courses', 8, 50, 0),
  ('sasnb-mathematics-ba-reasoning', 'sasnb-mathematics-ba', NULL,
    'Introduction to Mathematical Reasoning.', 'all', NULL, 60, 0),
  ('sasnb-mathematics-ba-analysis', 'sasnb-mathematics-ba', NULL,
    'One approved analysis course.', 'one_of', NULL, 70, 0),
  ('sasnb-mathematics-ba-analysis-311', 'sasnb-mathematics-ba', 'sasnb-mathematics-ba-analysis',
    'Introduction to Real Analysis I.', 'all', NULL, 10, 0),
  ('sasnb-mathematics-ba-analysis-312', 'sasnb-mathematics-ba', 'sasnb-mathematics-ba-analysis',
    'Introduction to Real Analysis II.', 'all', NULL, 20, 0),
  ('sasnb-mathematics-ba-analysis-411', 'sasnb-mathematics-ba', 'sasnb-mathematics-ba-analysis',
    'Honors Mathematical Analysis I.', 'all', NULL, 30, 0),
  ('sasnb-mathematics-ba-algebra', 'sasnb-mathematics-ba', NULL,
    'One approved algebra course.', 'one_of', NULL, 80, 0),
  ('sasnb-mathematics-ba-algebra-350', 'sasnb-mathematics-ba', 'sasnb-mathematics-ba-algebra',
    'Linear Algebra.', 'all', NULL, 10, 0),
  ('sasnb-mathematics-ba-algebra-351', 'sasnb-mathematics-ba', 'sasnb-mathematics-ba-algebra',
    'Abstract Algebra I.', 'all', NULL, 20, 0),
  ('sasnb-mathematics-ba-algebra-451', 'sasnb-mathematics-ba', 'sasnb-mathematics-ba-algebra',
    'Honors Abstract Algebra I.', 'all', NULL, 30, 0),

  -- Honors B.S. common and track-specific requirements.
  ('sasnb-mathematics-honors-bs-calculus-i-ii', 'sasnb-mathematics-honors-bs', NULL,
    'Calculus I and II.', 'all', NULL, 10, 0),
  ('sasnb-mathematics-honors-bs-advanced-foundation', 'sasnb-mathematics-honors-bs', NULL,
    'One approved advanced Calculus, Linear Algebra, and Differential Equations path.', 'one_of', NULL, 20, 0),
  ('sasnb-mathematics-honors-bs-advanced-foundation-291-292', 'sasnb-mathematics-honors-bs', 'sasnb-mathematics-honors-bs-advanced-foundation',
    'Honors Calculus III and IV.', 'all', NULL, 10, 0),
  ('sasnb-mathematics-honors-bs-advanced-foundation-251-252-250', 'sasnb-mathematics-honors-bs', 'sasnb-mathematics-honors-bs-advanced-foundation',
    'Multivariable Calculus, Differential Equations, and Linear Algebra.', 'all', NULL, 20, 0),
  ('sasnb-mathematics-honors-bs-computing', 'sasnb-mathematics-honors-bs', NULL,
    'One approved introductory computing course.', 'one_of', NULL, 30, 0),
  ('sasnb-mathematics-honors-bs-computing-107', 'sasnb-mathematics-honors-bs', 'sasnb-mathematics-honors-bs-computing',
    'Introduction to Computing for Mathematics and the Sciences.', 'all', NULL, 10, 0),
  ('sasnb-mathematics-honors-bs-computing-111', 'sasnb-mathematics-honors-bs', 'sasnb-mathematics-honors-bs-computing',
    'Introduction to Computer Science.', 'all', NULL, 20, 0),
  ('sasnb-mathematics-honors-bs-computing-332-252', 'sasnb-mathematics-honors-bs', 'sasnb-mathematics-honors-bs-computing',
    'SAS-listed alternative introductory programming course.', 'all', NULL, 30, 0),
  ('sasnb-mathematics-honors-bs-reasoning', 'sasnb-mathematics-honors-bs', NULL,
    'Introduction to Mathematical Reasoning.', 'all', NULL, 40, 0),
  ('sasnb-mathematics-honors-bs-analysis', 'sasnb-mathematics-honors-bs', NULL,
    'Mathematical Analysis I and II.', 'all', NULL, 50, 0),
  ('sasnb-mathematics-honors-bs-algebra', 'sasnb-mathematics-honors-bs', NULL,
    'Abstract Algebra I and II.', 'all', NULL, 60, 0),
  ('sasnb-mathematics-honors-bs-electives', 'sasnb-mathematics-honors-bs', NULL,
    'Four additional 3-credit Mathematics electives at the 300-400 level.', 'min_courses', 4, 70, 0),
  ('sasnb-mathematics-honors-bs-seminars', 'sasnb-mathematics-honors-bs', NULL,
    'Two Mathematics honors seminars, including Seminar 492.', 'all', NULL, 80, 0),
  ('sasnb-mathematics-honors-bs-additional-seminar', 'sasnb-mathematics-honors-bs', 'sasnb-mathematics-honors-bs-seminars',
    'One additional approved honors seminar.', 'one_of', NULL, 10, 0),
  ('sasnb-mathematics-honors-bs-additional-seminar-196', 'sasnb-mathematics-honors-bs', 'sasnb-mathematics-honors-bs-additional-seminar',
    'Mathematics honors seminar 196.', 'all', NULL, 10, 0),
  ('sasnb-mathematics-honors-bs-additional-seminar-491', 'sasnb-mathematics-honors-bs', 'sasnb-mathematics-honors-bs-additional-seminar',
    'Mathematics honors seminar 491.', 'all', NULL, 20, 0);

INSERT INTO requirement_courses (group_id, course_code, note, source_title, source_credits)
VALUES
  ('sasnb-mathematics-ba-calculus', '01:640:151', 'Typical first calculus term.', 'Calculus I for Mathematical and Physical Sciences', '4'),
  ('sasnb-mathematics-ba-calculus', '01:640:152', 'Typical second calculus term.', 'Calculus II for Mathematical and Physical Sciences', '4'),
  ('sasnb-mathematics-ba-calculus', '01:640:251', 'Typical third calculus term.', 'Multivariable Calculus', '4'),
  ('sasnb-mathematics-ba-linear-algebra', '01:640:250', NULL, 'Introduction to Linear Algebra', '3'),
  ('sasnb-mathematics-ba-differential-equations', '01:640:252', NULL, 'Elementary Differential Equations', '3'),
  ('sasnb-mathematics-ba-computing-107', '01:198:107', NULL, 'Introduction to Computing for Mathematics and the Sciences', NULL),
  ('sasnb-mathematics-ba-computing-111', '01:198:111', NULL, 'Introduction to Computer Science', NULL),
  ('sasnb-mathematics-ba-computing-332-252', '14:332:252', 'Alternative named by the current SAS program profile.', NULL, NULL),
  ('sasnb-mathematics-ba-reasoning', '01:640:300', NULL, 'Introduction to Mathematical Reasoning', '3'),
  ('sasnb-mathematics-ba-analysis-311', '01:640:311', NULL, 'Introduction to Real Analysis I', '3'),
  ('sasnb-mathematics-ba-analysis-312', '01:640:312', NULL, 'Introduction to Real Analysis II', '3'),
  ('sasnb-mathematics-ba-analysis-411', '01:640:411', NULL, 'Honors Mathematical Analysis I', '3'),
  ('sasnb-mathematics-ba-algebra-350', '01:640:350', NULL, 'Linear Algebra', '3'),
  ('sasnb-mathematics-ba-algebra-351', '01:640:351', NULL, 'Abstract Algebra I', '3'),
  ('sasnb-mathematics-ba-algebra-451', '01:640:451', NULL, 'Honors Abstract Algebra I', '3'),
  ('sasnb-mathematics-honors-bs-calculus-i-ii', '01:640:151', NULL, 'Calculus I for Mathematical and Physical Sciences', '4'),
  ('sasnb-mathematics-honors-bs-calculus-i-ii', '01:640:152', NULL, 'Calculus II for Mathematical and Physical Sciences', '4'),
  ('sasnb-mathematics-honors-bs-advanced-foundation-291-292', '01:640:291', NULL, 'Honors Calculus III', NULL),
  ('sasnb-mathematics-honors-bs-advanced-foundation-291-292', '01:640:292', NULL, 'Honors Calculus IV', NULL),
  ('sasnb-mathematics-honors-bs-advanced-foundation-251-252-250', '01:640:251', NULL, 'Multivariable Calculus', '4'),
  ('sasnb-mathematics-honors-bs-advanced-foundation-251-252-250', '01:640:252', NULL, 'Elementary Differential Equations', '3'),
  ('sasnb-mathematics-honors-bs-advanced-foundation-251-252-250', '01:640:250', NULL, 'Introduction to Linear Algebra', '3'),
  ('sasnb-mathematics-honors-bs-computing-107', '01:198:107', NULL, 'Introduction to Computing for Mathematics and the Sciences', NULL),
  ('sasnb-mathematics-honors-bs-computing-111', '01:198:111', NULL, 'Introduction to Computer Science', NULL),
  ('sasnb-mathematics-honors-bs-computing-332-252', '14:332:252', 'Alternative named by the current SAS program profile.', NULL, NULL),
  ('sasnb-mathematics-honors-bs-reasoning', '01:640:300', NULL, 'Introduction to Mathematical Reasoning', '3'),
  ('sasnb-mathematics-honors-bs-analysis', '01:640:411', NULL, 'Mathematical Analysis I', '3'),
  ('sasnb-mathematics-honors-bs-analysis', '01:640:412', NULL, 'Mathematical Analysis II', '3'),
  ('sasnb-mathematics-honors-bs-algebra', '01:640:451', NULL, 'Abstract Algebra I', '3'),
  ('sasnb-mathematics-honors-bs-algebra', '01:640:452', NULL, 'Abstract Algebra II', '3'),
  ('sasnb-mathematics-honors-bs-seminars', '01:640:492', 'One required Mathematics honors seminar.', 'Mathematics honors seminar', NULL),
  ('sasnb-mathematics-honors-bs-additional-seminar-196', '01:640:196', NULL, 'Mathematics honors seminar', NULL),
  ('sasnb-mathematics-honors-bs-additional-seminar-491', '01:640:491', NULL, 'Mathematics honors seminar', NULL);

INSERT INTO requirement_course_selectors (
  group_id, selector_key, selector_json, source_url, source_label,
  review_status, reviewed_at
) VALUES
  (
    'sasnb-mathematics-ba-upper-level-total',
    'sasnb-mathematics-ba-300-to-499',
    '{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["640"],"course_number_min":300,"course_number_max":499,"minimum_credits":3,"label":"Mathematics courses numbered 300-499 and worth at least three credits"}',
    'https://math.rutgers.edu/academics/undergraduate/majors',
    'Mathematics majors', 'reviewed', strftime('%s','now') * 1000
  ),
  (
    'sasnb-mathematics-honors-bs-electives',
    'sasnb-mathematics-honors-bs-additional-300-to-499',
    '{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["640"],"course_number_min":300,"course_number_max":499,"minimum_credits":3,"exclude_course_codes":["01:640:300","01:640:411","01:640:412","01:640:451","01:640:452","01:640:491","01:640:492"],"label":"Additional Mathematics courses numbered 300-499 and worth at least three credits"}',
    'https://math.rutgers.edu/academics/undergraduate/honors/honors-menu/honors-track-option',
    'Honors Track/BS Option', 'reviewed', strftime('%s','now') * 1000
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
  'sasnb-mathematics-ba',
  'group', id, NULL,
  'https://math.rutgers.edu/academics/undergraduate/majors',
  'Mathematics majors', NULL, strftime('%s','now') * 1000,
  'Current Department of Mathematics B.A. requirement or reviewed bounded selector.',
  'reviewed'
FROM requirement_groups
WHERE program_id = 'sasnb-mathematics-ba';

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'course:' || requirement_courses.group_id || ':' || requirement_courses.course_code,
  'sasnb-mathematics-ba',
  'course', requirement_courses.group_id, requirement_courses.course_code,
  CASE WHEN requirement_courses.course_code = '14:332:252'
    THEN 'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/mathematics'
    ELSE 'https://math.rutgers.edu/academics/undergraduate/majors' END,
  CASE WHEN requirement_courses.course_code = '14:332:252'
    THEN 'Mathematics (Major, Minor) | BA or BS'
    ELSE 'Mathematics majors' END,
  NULL, strftime('%s','now') * 1000,
  'Current official Mathematics major course requirement.',
  'reviewed'
FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-mathematics-ba'
);

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'group:' || id,
  'sasnb-mathematics-honors-bs',
  'group', id, NULL,
  CASE WHEN id LIKE 'sasnb-mathematics-honors-bs-computing%'
    THEN 'https://math.rutgers.edu/academics/undergraduate/majors'
    ELSE 'https://math.rutgers.edu/academics/undergraduate/honors/honors-menu/honors-track-option' END,
  CASE WHEN id LIKE 'sasnb-mathematics-honors-bs-computing%'
    THEN 'Mathematics majors'
    ELSE 'Honors Track/BS Option' END,
  NULL, strftime('%s','now') * 1000,
  'Current Department of Mathematics Honors Track requirement or reviewed bounded selector.',
  'reviewed'
FROM requirement_groups
WHERE program_id = 'sasnb-mathematics-honors-bs';

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'course:' || requirement_courses.group_id || ':' || requirement_courses.course_code,
  'sasnb-mathematics-honors-bs',
  'course', requirement_courses.group_id, requirement_courses.course_code,
  CASE
    WHEN requirement_courses.course_code = '14:332:252'
      THEN 'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/mathematics'
    WHEN requirement_courses.group_id LIKE 'sasnb-mathematics-honors-bs-computing%'
      THEN 'https://math.rutgers.edu/academics/undergraduate/majors'
    ELSE 'https://math.rutgers.edu/academics/undergraduate/honors/honors-menu/honors-track-option'
  END,
  CASE
    WHEN requirement_courses.course_code = '14:332:252'
      THEN 'Mathematics (Major, Minor) | BA or BS'
    WHEN requirement_courses.group_id LIKE 'sasnb-mathematics-honors-bs-computing%'
      THEN 'Mathematics majors'
    ELSE 'Honors Track/BS Option'
  END,
  NULL, strftime('%s','now') * 1000,
  'Current official Mathematics Honors Track course requirement.',
  'reviewed'
FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-mathematics-honors-bs'
);

INSERT INTO program_eligibility_rules (
  rule_key, program_id, condition_type, condition_value_json, decision,
  note, source_url, review_status, verified_at
) VALUES
  (
    'sasnb-mathematics-ba-academic-review',
    'sasnb-mathematics-ba', 'advisor_confirmation',
    '{"topics":["calculus-course equivalencies","C-or-better course-grade requirements","at least four upper-level Mathematics courses at Rutgers-New Brunswick/Piscataway","department-approved graduate-course substitutions for analysis or algebra"]}',
    'requires_approval',
    'Confirm calculus equivalents, grade and Rutgers-New Brunswick/Piscataway residency rules, and any approved graduate-course substitution with Mathematics advising before relying on this plan.',
    'https://math.rutgers.edu/academics/undergraduate/majors',
    'reviewed', strftime('%s','now') * 1000
  ),
  (
    'sasnb-mathematics-honors-bs-academic-review',
    'sasnb-mathematics-honors-bs', 'advisor_confirmation',
    '{"topics":["Honors admission and approved substitutions","special permission for honors sections and application-only 411-412 and 451-452","C-or-better course-grade requirements","second semester of 01:640:492 or an approved substitute","at least four upper-level Mathematics courses at Rutgers-New Brunswick/Piscataway"]}',
    'requires_approval',
    'Honors admission and approved substitutions must be confirmed with Mathematics advising. A second term of Seminar 492 or an approved seminar substitute is not automatically countable because the current planner stores a repeated course code once.',
    'https://math.rutgers.edu/academics/undergraduate/honors/honors-menu/honors-track-option',
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
