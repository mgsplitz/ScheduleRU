-- Reviewed SAS New Brunswick Economics programs, batch 1.
--
-- Development-only review decision, 2026-07-20. The Economics B.A. source is
-- the Department worksheet last revised Spring 2026; the Quantitative
-- Economics minor source is the current official department page. Every
-- requirement row below has a matching reviewed evidence record.
--
-- Apply only after the reviewed schema migrations, on development:
--   npx wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/review_sas_economics_batch_1.sql

INSERT INTO school_profiles (
  slug, institution_slug, campus_slug, name, short_name, catalog_year,
  configuration_json, source_url, source_title, review_status, reviewed_at, sort_order
) VALUES (
  'sasnb',
  'rutgers',
  'new-brunswick',
  'School of Arts and Sciences - New Brunswick',
  'SAS New Brunswick',
  'Current official SAS pages (reviewed 2026-07-20)',
  '{"default_program_id":"sasnb-economics-major","advising_label":"SAS and Economics advising","shared_requirement_reference_types":["major"],"core_fallback_label":"SAS Core Curriculum","core_intro":"The Rutgers-New Brunswick Core Curriculum is shared by SAS. Course planning progress is informational; confirm grade, residency, declaration, and transfer decisions with SAS advising.","program_type_sections":[{"type":"major","label":"Majors","singular":"Major"},{"type":"minor","label":"Minors","singular":"Minor"}]}',
  'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/list-of-majors-and-minors',
  'SAS Majors and Minors',
  'reviewed',
  strftime('%s','now') * 1000,
  20
)
ON CONFLICT(slug) DO UPDATE SET
  institution_slug=excluded.institution_slug,
  campus_slug=excluded.campus_slug,
  name=excluded.name,
  short_name=excluded.short_name,
  catalog_year=excluded.catalog_year,
  configuration_json=excluded.configuration_json,
  source_url=excluded.source_url,
  source_title=excluded.source_title,
  review_status=excluded.review_status,
  reviewed_at=excluded.reviewed_at,
  sort_order=excluded.sort_order;

INSERT INTO school_curriculum_modules (
  school_slug, module_type, curriculum_program_id, source_url,
  review_status, reviewed_at, sort_order
) VALUES (
  'sasnb',
  'core_curriculum',
  'rutgers-nb-core-curriculum',
  'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/core/about-sas-core',
  'reviewed',
  strftime('%s','now') * 1000,
  10
)
ON CONFLICT(school_slug, module_type) DO UPDATE SET
  curriculum_program_id=excluded.curriculum_program_id,
  source_url=excluded.source_url,
  review_status=excluded.review_status,
  reviewed_at=excluded.reviewed_at,
  sort_order=excluded.sort_order;

INSERT INTO programs (
  id, name, school_slug, program_slug, type, catalog_year,
  academic_program_code, degree_type, program_family_id, source_url,
  review_status, last_scraped_at, requirement_evidence_required
) VALUES
  (
    'sasnb-economics-major', 'Economics', 'sasnb', 'economics', 'major',
    'Spring 2026 worksheet', '220', 'B.A.', 'sasnb-economics-220',
    'https://economics.rutgers.edu/images/Economics_Major_Requirements_Worksheet.doc',
    'reviewed', strftime('%s','now') * 1000, 1
  ),
  (
    'sasnb-quantitative-economics-minor', 'Quantitative Economics', 'sasnb', 'quantitative-economics', 'minor',
    'Current official page (catalog year not stated)', '221', NULL, 'sasnb-quantitative-economics-221',
    'https://economics.rutgers.edu/academics/undergraduate/minors/minor-in-quantitative-economics',
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
    'sasnb-economics-major',
    'https://economics.rutgers.edu/images/Economics_Major_Requirements_Worksheet.doc',
    'Economics Major Requirements Worksheet', 'Spring 2026', 'program_requirements',
    strftime('%s','now') * 1000,
    'Official Department of Economics worksheet; last revised Spring 2026.'
  ),
  (
    'sasnb-economics-major',
    'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/economics',
    'Economics (Major, Minor) | BA', NULL, 'program_profile',
    strftime('%s','now') * 1000,
    'Official SAS profile identifies Economics as SAS program code 220 and B.A. major/minor.'
  ),
  (
    'sasnb-quantitative-economics-minor',
    'https://economics.rutgers.edu/academics/undergraduate/minors/minor-in-quantitative-economics',
    'Minor in Quantitative Economics', NULL, 'program_requirements',
    strftime('%s','now') * 1000,
    'Current official Department of Economics requirements page; no catalog-year boundary stated.'
  ),
  (
    'sasnb-quantitative-economics-minor',
    'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/economics',
    'Economics (Major, Minor) | BA', NULL, 'program_profile',
    strftime('%s','now') * 1000,
    'Official SAS profile records the Economics program family and published Economics-major restriction.'
  )
ON CONFLICT(program_id, source_url) DO UPDATE SET
  source_title=excluded.source_title,
  source_catalog_year=excluded.source_catalog_year,
  source_scope=excluded.source_scope,
  accessed_at=excluded.accessed_at,
  note=excluded.note;

DELETE FROM program_requirement_evidence
WHERE program_id IN ('sasnb-economics-major', 'sasnb-quantitative-economics-minor');

DELETE FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups
  WHERE program_id IN ('sasnb-economics-major', 'sasnb-quantitative-economics-minor')
);

DELETE FROM requirement_groups
WHERE program_id IN ('sasnb-economics-major', 'sasnb-quantitative-economics-minor');

DELETE FROM program_eligibility_rules
WHERE program_id IN ('sasnb-economics-major', 'sasnb-quantitative-economics-minor');

INSERT INTO requirement_groups (
  id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated
) VALUES
  ('sasnb-economics-major-economics-core', 'sasnb-economics-major', NULL, 'Economics core courses.', 'all', NULL, 10, 0),
  ('sasnb-economics-major-calculus', 'sasnb-economics-major', NULL, 'One approved Calculus I course.', 'min_courses', 1, 20, 0),
  ('sasnb-economics-major-statistics', 'sasnb-economics-major', NULL, 'One approved Statistics course.', 'min_courses', 1, 30, 0),
  ('sasnb-economics-major-electives', 'sasnb-economics-major', NULL, 'Seven Economics electives from the Spring 2026 worksheet.', 'min_courses', 7, 40, 0),
  ('sasnb-economics-major-upper-electives', 'sasnb-economics-major', NULL, 'At least four upper-level Economics electives.', 'min_courses', 4, 50, 0),
  ('sasnb-quantitative-economics-minor-core', 'sasnb-quantitative-economics-minor', NULL, 'Five required Economics courses.', 'all', NULL, 10, 0),
  ('sasnb-quantitative-economics-minor-upper-elective', 'sasnb-quantitative-economics-minor', NULL, 'One listed upper-level Economics elective.', 'min_courses', 1, 20, 0);

INSERT INTO requirement_courses (group_id, course_code, note, source_title, source_credits)
VALUES
  ('sasnb-economics-major-economics-core', '01:220:102', NULL, 'Introduction to Microeconomics', '3'),
  ('sasnb-economics-major-economics-core', '01:220:103', NULL, 'Introduction to Macroeconomics', '3'),
  ('sasnb-economics-major-economics-core', '01:220:320', NULL, 'Intermediate Microeconomics', '3'),
  ('sasnb-economics-major-economics-core', '01:220:321', NULL, 'Intermediate Macroeconomics', '3'),
  ('sasnb-economics-major-economics-core', '01:220:322', NULL, 'Econometrics', '3'),
  ('sasnb-economics-major-calculus', '01:640:130', NULL, 'Calculus I', '4'),
  ('sasnb-economics-major-calculus', '01:640:135', NULL, 'Calculus I', '4'),
  ('sasnb-economics-major-calculus', '01:640:151', NULL, 'Calculus I for Mathematical and Physical Sciences', '4'),
  ('sasnb-economics-major-statistics', '01:960:211', NULL, 'Statistics I', '3'),
  ('sasnb-economics-major-statistics', '01:960:285', NULL, 'Introductory Statistics for Business', '3'),
  ('sasnb-economics-major-statistics', '01:960:291', NULL, 'Statistical Methods', '3'),
  ('sasnb-economics-major-electives', '01:220:300', 'Lower-level elective.', 'International Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:301', 'Lower-level elective.', 'Money, Banking and the Financial System', '3'),
  ('sasnb-economics-major-electives', '01:220:390', 'Lower-level elective.', 'Choice and Strategy in Politics', '3'),
  ('sasnb-economics-major-electives', '01:220:395', 'Lower-level elective.', 'Law and Economics', '3'),
  ('sasnb-economics-major-electives', '14:540:343', 'Approved outside-department lower-level elective.', 'Engineering Economics', '3'),
  ('sasnb-economics-major-electives', '33:010:272', 'Approved outside-department lower-level elective.', 'Introduction to Financial Accounting', '3'),
  ('sasnb-economics-major-electives', '33:010:275', 'Approved outside-department lower-level elective.', 'Introduction to Managerial Accounting', '3'),
  ('sasnb-economics-major-electives', '01:220:402', 'Upper-level elective.', 'Labor Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:410', 'Upper-level elective.', 'Advanced Macroeconomic Theory', '3'),
  ('sasnb-economics-major-electives', '01:220:411', 'Upper-level elective.', 'Global Financial Crises', '3'),
  ('sasnb-economics-major-electives', '01:220:412', 'Upper-level elective.', 'Monetary Theory and Policy', '3'),
  ('sasnb-economics-major-electives', '01:220:413', 'Upper-level elective.', 'Financial Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:420', 'Upper-level elective.', 'Computational Methods for Research in Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:421', 'Upper-level elective.', 'Economic Forecasting and Big Data', '3'),
  ('sasnb-economics-major-electives', '01:220:422', 'Upper-level elective.', 'Advanced Econometrics for Micro Data', '3'),
  ('sasnb-economics-major-electives', '01:220:423', 'Upper-level elective.', 'Advanced Time Series and Financial Econometrics', '3'),
  ('sasnb-economics-major-electives', '01:220:424', 'Upper-level elective.', 'Machine Learning for Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:431', 'Upper-level elective.', 'Urban Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:432', 'Upper-level elective.', 'Environmental Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:433', 'Upper-level elective.', 'Health Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:435', 'Upper-level elective.', 'International Trade', '3'),
  ('sasnb-economics-major-electives', '01:220:436', 'Upper-level elective.', 'International Finance and Macroeconomics', '3'),
  ('sasnb-economics-major-electives', '01:220:438', 'Upper-level elective.', 'Education Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:439', 'Upper-level elective.', 'Economic Development', '3'),
  ('sasnb-economics-major-electives', '01:220:440', 'Upper-level elective.', 'Economics of Income Inequality and Discrimination', '3'),
  ('sasnb-economics-major-electives', '01:220:441', 'Upper-level elective.', 'Industrial Organization', '3'),
  ('sasnb-economics-major-electives', '01:220:460', 'Upper-level elective.', 'Public Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:463', 'Upper-level elective.', 'Economics of Taxation', '3'),
  ('sasnb-economics-major-electives', '01:220:477', 'Upper-level elective.', 'Economics of Population', '3'),
  ('sasnb-economics-major-electives', '01:220:480', 'Upper-level elective.', 'Behavioral and Experimental Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:481', 'Upper-level elective.', 'Economics of Uncertainty', '3'),
  ('sasnb-economics-major-electives', '01:220:482', 'Upper-level elective.', 'Game Theory and Economics', '3'),
  ('sasnb-economics-major-electives', '01:220:483', 'Upper-level elective.', 'Markets, Games, and Information', '3'),
  ('sasnb-economics-major-electives', '01:220:485', 'Upper-level elective.', 'Advanced Microeconomic Theory', '3'),
  ('sasnb-economics-major-electives', '01:220:493', 'Upper-level elective.', 'Honors Research Seminar I', '3'),
  ('sasnb-economics-major-electives', '01:220:494', 'Upper-level elective.', 'Honors Research Seminar II', '3'),
  ('sasnb-economics-major-electives', '01:220:495', 'Upper-level elective.', 'Seminar in Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:402', NULL, 'Labor Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:410', NULL, 'Advanced Macroeconomic Theory', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:411', NULL, 'Global Financial Crises', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:412', NULL, 'Monetary Theory and Policy', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:413', NULL, 'Financial Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:420', NULL, 'Computational Methods for Research in Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:421', NULL, 'Economic Forecasting and Big Data', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:422', NULL, 'Advanced Econometrics for Micro Data', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:423', NULL, 'Advanced Time Series and Financial Econometrics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:424', NULL, 'Machine Learning for Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:431', NULL, 'Urban Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:432', NULL, 'Environmental Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:433', NULL, 'Health Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:435', NULL, 'International Trade', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:436', NULL, 'International Finance and Macroeconomics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:438', NULL, 'Education Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:439', NULL, 'Economic Development', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:440', NULL, 'Economics of Income Inequality and Discrimination', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:441', NULL, 'Industrial Organization', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:460', NULL, 'Public Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:463', NULL, 'Economics of Taxation', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:477', NULL, 'Economics of Population', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:480', NULL, 'Behavioral and Experimental Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:481', NULL, 'Economics of Uncertainty', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:482', NULL, 'Game Theory and Economics', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:483', NULL, 'Markets, Games, and Information', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:485', NULL, 'Advanced Microeconomic Theory', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:493', NULL, 'Honors Research Seminar I', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:494', NULL, 'Honors Research Seminar II', '3'),
  ('sasnb-economics-major-upper-electives', '01:220:495', NULL, 'Seminar in Economics', '3'),
  ('sasnb-quantitative-economics-minor-core', '01:220:102', NULL, 'Introduction to Microeconomics', '3'),
  ('sasnb-quantitative-economics-minor-core', '01:220:103', NULL, 'Introduction to Macroeconomics', '3'),
  ('sasnb-quantitative-economics-minor-core', '01:220:320', NULL, 'Intermediate Microeconomics', '3'),
  ('sasnb-quantitative-economics-minor-core', '01:220:321', NULL, 'Intermediate Macroeconomics', '3'),
  ('sasnb-quantitative-economics-minor-core', '01:220:322', NULL, 'Econometrics', '3'),
  ('sasnb-quantitative-economics-minor-upper-elective', '01:220:410', NULL, 'Advanced Macroeconomic Theory', '3'),
  ('sasnb-quantitative-economics-minor-upper-elective', '01:220:420', NULL, 'Computational Methods for Research in Economics', '3'),
  ('sasnb-quantitative-economics-minor-upper-elective', '01:220:422', NULL, 'Advanced Cross-Sectional and Panel Econometrics', '3'),
  ('sasnb-quantitative-economics-minor-upper-elective', '01:220:423', NULL, 'Advanced Time Series and Financial Econometrics', '3'),
  ('sasnb-quantitative-economics-minor-upper-elective', '01:220:424', NULL, 'Machine Learning for Economics', '3'),
  ('sasnb-quantitative-economics-minor-upper-elective', '01:220:480', NULL, 'Behavioral and Experimental Economics', '3'),
  ('sasnb-quantitative-economics-minor-upper-elective', '01:220:481', NULL, 'Economics of Uncertainty', '3'),
  ('sasnb-quantitative-economics-minor-upper-elective', '01:220:482', NULL, 'Game Theory and Economics', '3'),
  ('sasnb-quantitative-economics-minor-upper-elective', '01:220:483', NULL, 'Markets, Games, and Information', '3'),
  ('sasnb-quantitative-economics-minor-upper-elective', '01:220:485', NULL, 'Advanced Microeconomic Theory', '3');

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'group:' || id,
  program_id,
  'group',
  id,
  NULL,
  CASE
    WHEN program_id = 'sasnb-economics-major'
      THEN 'https://economics.rutgers.edu/images/Economics_Major_Requirements_Worksheet.doc'
    ELSE 'https://economics.rutgers.edu/academics/undergraduate/minors/minor-in-quantitative-economics'
  END,
  CASE
    WHEN program_id = 'sasnb-economics-major' THEN 'Economics Major Requirements Worksheet'
    ELSE 'Minor in Quantitative Economics'
  END,
  CASE WHEN program_id = 'sasnb-economics-major' THEN 'Spring 2026' ELSE NULL END,
  strftime('%s','now') * 1000,
  CASE
    WHEN program_id = 'sasnb-economics-major'
      THEN 'Official Department of Economics worksheet; last revised Spring 2026.'
    ELSE 'Current official Department of Economics requirements page; no catalog-year boundary stated.'
  END,
  'reviewed'
FROM requirement_groups
WHERE program_id IN ('sasnb-economics-major', 'sasnb-quantitative-economics-minor');

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'course:' || requirement_courses.group_id || ':' || requirement_courses.course_code,
  requirement_groups.program_id,
  'course',
  requirement_courses.group_id,
  requirement_courses.course_code,
  CASE
    WHEN requirement_groups.program_id = 'sasnb-economics-major'
      THEN 'https://economics.rutgers.edu/images/Economics_Major_Requirements_Worksheet.doc'
    ELSE 'https://economics.rutgers.edu/academics/undergraduate/minors/minor-in-quantitative-economics'
  END,
  CASE
    WHEN requirement_groups.program_id = 'sasnb-economics-major' THEN 'Economics Major Requirements Worksheet'
    ELSE 'Minor in Quantitative Economics'
  END,
  CASE WHEN requirement_groups.program_id = 'sasnb-economics-major' THEN 'Spring 2026' ELSE NULL END,
  strftime('%s','now') * 1000,
  CASE
    WHEN requirement_groups.program_id = 'sasnb-economics-major'
      THEN 'Official Department of Economics worksheet; last revised Spring 2026.'
    ELSE 'Current official Department of Economics requirements page; no catalog-year boundary stated.'
  END,
  'reviewed'
FROM requirement_courses
INNER JOIN requirement_groups ON requirement_groups.id = requirement_courses.group_id
WHERE requirement_groups.program_id IN ('sasnb-economics-major', 'sasnb-quantitative-economics-minor');

INSERT INTO program_eligibility_rules (
  rule_key, program_id, condition_type, condition_value_json, decision,
  note, source_url, review_status, verified_at
) VALUES
  (
    'sasnb-economics-major-academic-review',
    'sasnb-economics-major',
    'advisor_confirmation',
    '{"topics":["minimum course grades","economics GPA","outside-department and non-New-Brunswick credit"]}',
    'requires_approval',
    'Confirm the published grade, Economics-GPA, and outside-department/Rutgers-New Brunswick credit rules with Economics advising before relying on this plan.',
    'https://economics.rutgers.edu/images/Economics_Major_Requirements_Worksheet.doc',
    'reviewed', strftime('%s','now') * 1000
  ),
  (
    'sasnb-quantitative-economics-minor-academic-review',
    'sasnb-quantitative-economics-minor',
    'advisor_confirmation',
    '{"topics":["minimum course grades","Calculus II prerequisite","outside-department and non-New-Brunswick credit"]}',
    'requires_approval',
    'Confirm the published grade, Calculus II prerequisite, and outside-department/Rutgers-New Brunswick credit rules with Economics advising before relying on this plan.',
    'https://economics.rutgers.edu/academics/undergraduate/minors/minor-in-quantitative-economics',
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

INSERT INTO program_combination_policies (
  policy_key, home_school_slug,
  program_a_id, program_a_school_slug, program_a_type,
  program_b_id, program_b_school_slug, program_b_type,
  same_program_family,
  decision, note, source_url, verified_at
) VALUES (
  'sasnb-economics-major-no-quantitative-economics-minor',
  'sasnb',
  'sasnb-economics-major', NULL, NULL,
  'sasnb-quantitative-economics-minor', NULL, NULL,
  0,
  'blocked',
  'Economics (220) majors may not minor in Quantitative Economics (221).',
  'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/economics',
  strftime('%s','now') * 1000
), (
  'sasnb-no-major-minor-same-program-family',
  'sasnb',
  NULL, 'sasnb', 'major',
  NULL, 'sasnb', 'minor',
  1,
  'blocked',
  'SAS students may not select a major and minor from the same academic program.',
  'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-restrictions',
  strftime('%s','now') * 1000
)
ON CONFLICT(policy_key) DO UPDATE SET
  home_school_slug=excluded.home_school_slug,
  program_a_id=excluded.program_a_id,
  program_a_school_slug=excluded.program_a_school_slug,
  program_a_type=excluded.program_a_type,
  program_b_id=excluded.program_b_id,
  program_b_school_slug=excluded.program_b_school_slug,
  program_b_type=excluded.program_b_type,
  same_program_family=excluded.same_program_family,
  decision=excluded.decision,
  note=excluded.note,
  source_url=excluded.source_url,
  verified_at=excluded.verified_at;
