-- RBS-New Brunswick minors and concentrations: source-backed DRAFT import
--
-- This file intentionally seeds only `unreviewed` programs and rules. Public
-- API routes exclude them, so applying it to the development database creates
-- a review queue without publishing a degree-audit claim. The RBS pages used
-- here do not state a catalog year, so `catalog_year` remains NULL rather
-- than guessing that their current web content belongs to a specific year.
--
-- Apply only after schema_program_provenance_and_eligibility.sql, and only to
-- the development D1 database until each row is reviewed:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/seed_rbs_areas_of_study_draft.sql

INSERT INTO programs (id, name, school_slug, program_slug, type, catalog_year, source_url, review_status, last_scraped_at)
VALUES
  ('rbsnb-business-administration-minor', 'Business Administration', 'rbsnb', 'business-administration-minor', 'minor', NULL, 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-administration-minor', 'unreviewed', strftime('%s','now') * 1000),
  ('rbsnb-entrepreneurship-minor', 'Entrepreneurship', 'rbsnb', 'entrepreneurship-minor', 'minor', NULL, 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-minor', 'unreviewed', strftime('%s','now') * 1000),
  ('rbsnb-business-analytics-concentration', 'Business Analytics', 'rbsnb', 'business-analytics-concentration', 'concentration', NULL, 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-analytics-concentration', 'unreviewed', strftime('%s','now') * 1000),
  ('rbsnb-entrepreneurship-concentration', 'Entrepreneurship', 'rbsnb', 'entrepreneurship-concentration', 'concentration', NULL, 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-concentration', 'unreviewed', strftime('%s','now') * 1000),
  ('rbsnb-finance-concentration', 'Finance', 'rbsnb', 'finance-concentration', 'concentration', NULL, 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/finance-concentration', 'unreviewed', strftime('%s','now') * 1000),
  ('rbsnb-fixed-income-credit-analysis-concentration', 'Fixed Income and Credit Analysis', 'rbsnb', 'fixed-income-credit-analysis-concentration', 'concentration', NULL, 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/fixed-income-credit-analysis-concentration', 'unreviewed', strftime('%s','now') * 1000),
  ('rbsnb-global-business-concentration', 'Global Business', 'rbsnb', 'global-business-concentration', 'concentration', NULL, 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/global-business-concentration', 'unreviewed', strftime('%s','now') * 1000),
  ('rbsnb-leadership-skills-concentration', 'Leadership Skills', 'rbsnb', 'leadership-skills-concentration', 'concentration', NULL, 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/leadership-skills-concentration', 'unreviewed', strftime('%s','now') * 1000),
  ('rbsnb-management-information-systems-concentration', 'Management Information Systems', 'rbsnb', 'management-information-systems-concentration', 'concentration', NULL, 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/management-information-systems-concentration', 'unreviewed', strftime('%s','now') * 1000),
  ('rbsnb-professional-selling-concentration', 'Professional Selling', 'rbsnb', 'professional-selling-concentration', 'concentration', NULL, 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/professional-selling-concentration', 'unreviewed', strftime('%s','now') * 1000),
  ('rbsnb-real-estate-concentration', 'Real Estate', 'rbsnb', 'real-estate-concentration', 'concentration', NULL, 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/real-estate-concentration', 'unreviewed', strftime('%s','now') * 1000)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,
  school_slug=excluded.school_slug,
  program_slug=excluded.program_slug,
  type=excluded.type,
  catalog_year=excluded.catalog_year,
  source_url=excluded.source_url,
  review_status='unreviewed',
  last_scraped_at=excluded.last_scraped_at;

INSERT INTO program_sources (program_id, source_url, source_title, source_catalog_year, source_scope, accessed_at, note)
VALUES
  ('rbsnb-business-administration-minor', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-administration-minor', 'RBS New Brunswick Business Administration Minor', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Official page; catalog year is not stated.'),
  ('rbsnb-entrepreneurship-minor', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-minor', 'RBS New Brunswick Entrepreneurship Minor', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Official page; catalog year is not stated.'),
  ('rbsnb-business-analytics-concentration', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-analytics-concentration', 'RBS New Brunswick Business Analytics Concentration', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Official page refers to its concentration courses as certificate courses in a policy note.'),
  ('rbsnb-entrepreneurship-concentration', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-concentration', 'RBS New Brunswick Entrepreneurship Concentration', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Official page refers to its concentration courses as certificate courses in a policy note.'),
  ('rbsnb-finance-concentration', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/finance-concentration', 'RBS New Brunswick Finance Concentration', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Official page refers to its concentration courses as certificate courses in a policy note.'),
  ('rbsnb-fixed-income-credit-analysis-concentration', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/fixed-income-credit-analysis-concentration', 'RBS New Brunswick Fixed Income and Credit Analysis Concentration', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Official page calls this a concentration; the current concentrations landing page says it is for Finance majors only.'),
  ('rbsnb-global-business-concentration', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/global-business-concentration', 'RBS New Brunswick Global Business Concentration', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Official page refers to its concentration courses as certificate courses in a policy note.'),
  ('rbsnb-leadership-skills-concentration', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/leadership-skills-concentration', 'RBS New Brunswick Leadership Skills Concentration', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Official page refers to its concentration courses as certificate courses in a policy note.'),
  ('rbsnb-management-information-systems-concentration', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/management-information-systems-concentration', 'RBS New Brunswick Management Information Systems Concentration', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Official page refers to its concentration courses as certificate courses in a policy note.'),
  ('rbsnb-professional-selling-concentration', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/professional-selling-concentration', 'RBS New Brunswick Professional Selling Concentration', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Page says completion produces a Professional Selling Certification on the transcript; modeled as a concentration pending title reconciliation.'),
  ('rbsnb-real-estate-concentration', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/real-estate-concentration', 'RBS New Brunswick Real Estate Concentration', NULL, 'program_requirements', strftime('%s','now') * 1000, 'Official page refers to its concentration courses as certificate courses in a policy note.')
ON CONFLICT(program_id, source_url) DO UPDATE SET
  source_title=excluded.source_title,
  source_catalog_year=excluded.source_catalog_year,
  source_scope=excluded.source_scope,
  accessed_at=excluded.accessed_at,
  note=excluded.note;

-- This seed is a replaceable import snapshot. Before writing the current
-- source interpretation, remove only requirement/policy rows owned by these
-- eleven explicitly named development drafts. This avoids stale rows when a
-- source is corrected. Do not rerun this snapshot after manually reviewing a
-- program; create a dated reviewed migration instead.
DELETE FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups
  WHERE program_id IN (
    'rbsnb-business-administration-minor', 'rbsnb-entrepreneurship-minor',
    'rbsnb-business-analytics-concentration', 'rbsnb-entrepreneurship-concentration',
    'rbsnb-finance-concentration', 'rbsnb-fixed-income-credit-analysis-concentration',
    'rbsnb-global-business-concentration', 'rbsnb-leadership-skills-concentration',
    'rbsnb-management-information-systems-concentration', 'rbsnb-professional-selling-concentration',
    'rbsnb-real-estate-concentration'
  )
);
DELETE FROM requirement_groups
WHERE program_id IN (
  'rbsnb-business-administration-minor', 'rbsnb-entrepreneurship-minor',
  'rbsnb-business-analytics-concentration', 'rbsnb-entrepreneurship-concentration',
  'rbsnb-finance-concentration', 'rbsnb-fixed-income-credit-analysis-concentration',
  'rbsnb-global-business-concentration', 'rbsnb-leadership-skills-concentration',
  'rbsnb-management-information-systems-concentration', 'rbsnb-professional-selling-concentration',
  'rbsnb-real-estate-concentration'
);
DELETE FROM requirement_raw_notes
WHERE program_id IN (
  'rbsnb-business-administration-minor', 'rbsnb-entrepreneurship-minor',
  'rbsnb-business-analytics-concentration', 'rbsnb-entrepreneurship-concentration',
  'rbsnb-finance-concentration', 'rbsnb-fixed-income-credit-analysis-concentration',
  'rbsnb-global-business-concentration', 'rbsnb-leadership-skills-concentration',
  'rbsnb-management-information-systems-concentration', 'rbsnb-professional-selling-concentration',
  'rbsnb-real-estate-concentration'
);
DELETE FROM program_eligibility_rules
WHERE program_id IN (
  'rbsnb-business-administration-minor', 'rbsnb-entrepreneurship-minor',
  'rbsnb-business-analytics-concentration', 'rbsnb-entrepreneurship-concentration',
  'rbsnb-finance-concentration', 'rbsnb-fixed-income-credit-analysis-concentration',
  'rbsnb-global-business-concentration', 'rbsnb-leadership-skills-concentration',
  'rbsnb-management-information-systems-concentration', 'rbsnb-professional-selling-concentration',
  'rbsnb-real-estate-concentration'
);

-- The detail pages list exact course trees. These are hand-entered, so the
-- import is deliberately marked manual (auto_generated = 0) and stays hidden
-- until source/curriculum-year review is complete.
INSERT INTO requirement_groups (id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated)
VALUES
  ('rbsnb-business-administration-minor-required', 'rbsnb-business-administration-minor', NULL, 'Required courses', 'all', NULL, 1, 0),
  ('rbsnb-business-administration-minor-choice', 'rbsnb-business-administration-minor', NULL, 'Business analytics / methods choice', 'min_courses', 1, 2, 0),
  ('rbsnb-entrepreneurship-minor-preliminary', 'rbsnb-entrepreneurship-minor', NULL, 'Preliminary Core Requirements', 'all', NULL, 1, 0),
  ('rbsnb-entrepreneurship-minor-required', 'rbsnb-entrepreneurship-minor', NULL, 'Entrepreneurship Core Requirements', 'all', NULL, 2, 0),
  ('rbsnb-entrepreneurship-minor-elective', 'rbsnb-entrepreneurship-minor', NULL, 'Entrepreneurship elective', 'min_courses', 1, 3, 0),
  ('rbsnb-business-analytics-concentration-required', 'rbsnb-business-analytics-concentration', NULL, 'Core requirements', 'all', NULL, 1, 0),
  ('rbsnb-business-analytics-concentration-elective', 'rbsnb-business-analytics-concentration', NULL, 'Business Analytics elective', 'min_courses', 1, 2, 0),
  ('rbsnb-entrepreneurship-concentration-required', 'rbsnb-entrepreneurship-concentration', NULL, 'Entrepreneurship Core Requirements', 'all', NULL, 1, 0),
  ('rbsnb-entrepreneurship-concentration-elective', 'rbsnb-entrepreneurship-concentration', NULL, 'Entrepreneurship elective', 'min_courses', 1, 2, 0),
  ('rbsnb-finance-concentration-required', 'rbsnb-finance-concentration', NULL, 'Required courses', 'all', NULL, 1, 0),
  ('rbsnb-fixed-income-credit-analysis-concentration-required', 'rbsnb-fixed-income-credit-analysis-concentration', NULL, 'Required courses', 'all', NULL, 1, 0),
  ('rbsnb-fixed-income-credit-analysis-concentration-elective', 'rbsnb-fixed-income-credit-analysis-concentration', NULL, 'Finance elective', 'min_courses', 1, 2, 0),
  ('rbsnb-global-business-concentration-required', 'rbsnb-global-business-concentration', NULL, 'Required courses', 'all', NULL, 1, 0),
  ('rbsnb-global-business-concentration-elective', 'rbsnb-global-business-concentration', NULL, 'Global Business elective', 'min_courses', 1, 2, 0),
  ('rbsnb-leadership-skills-concentration-required', 'rbsnb-leadership-skills-concentration', NULL, 'Required course', 'all', NULL, 1, 0),
  ('rbsnb-leadership-skills-concentration-primary-elective', 'rbsnb-leadership-skills-concentration', NULL, 'Select at least one primary elective', 'min_courses', 1, 2, 0),
  ('rbsnb-management-information-systems-concentration-required', 'rbsnb-management-information-systems-concentration', NULL, 'Required courses', 'all', NULL, 1, 0),
  ('rbsnb-management-information-systems-concentration-elective', 'rbsnb-management-information-systems-concentration', NULL, 'Management Information Systems elective', 'min_courses', 1, 2, 0),
  ('rbsnb-professional-selling-concentration-required', 'rbsnb-professional-selling-concentration', NULL, 'Required courses', 'all', NULL, 1, 0),
  ('rbsnb-professional-selling-concentration-elective', 'rbsnb-professional-selling-concentration', NULL, 'Professional Selling elective', 'min_courses', 1, 2, 0)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name, rule=excluded.rule, count=excluded.count,
  sort_order=excluded.sort_order, auto_generated=excluded.auto_generated;

INSERT INTO requirement_courses (group_id, course_code, note)
VALUES
  ('rbsnb-business-administration-minor-required', '33:010:272', 'Grade of C or better required by the official minor page.'),
  ('rbsnb-business-administration-minor-required', '33:390:203', 'Prerequisite: 33:010:272.'),
  ('rbsnb-business-administration-minor-required', '33:620:301', ''),
  ('rbsnb-business-administration-minor-required', '33:630:301', ''),
  ('rbsnb-business-administration-minor-required', '33:799:301', ''),
  ('rbsnb-business-administration-minor-choice', '33:136:287', ''),
  ('rbsnb-business-administration-minor-choice', '33:136:385', 'Prerequisite: Calculus.'),
  ('rbsnb-business-administration-minor-choice', '33:136:386', 'Prerequisite: Calculus.'),
  ('rbsnb-entrepreneurship-minor-preliminary', '33:382:103', ''),
  ('rbsnb-entrepreneurship-minor-preliminary', '33:382:203', ''),
  ('rbsnb-entrepreneurship-minor-preliminary', '33:382:202', ''),
  ('rbsnb-entrepreneurship-minor-required', '33:382:302', ''),
  ('rbsnb-entrepreneurship-minor-required', '33:382:303', ''),
  ('rbsnb-entrepreneurship-minor-elective', '33:382:340', ''),
  ('rbsnb-entrepreneurship-minor-elective', '33:382:496', ''),
  ('rbsnb-entrepreneurship-minor-elective', '33:620:475', ''),
  ('rbsnb-entrepreneurship-minor-elective', '33:382:355', ''),
  ('rbsnb-entrepreneurship-minor-elective', '33:382:352', ''),
  ('rbsnb-entrepreneurship-minor-elective', '33:382:486', ''),
  ('rbsnb-entrepreneurship-minor-elective', '33:630:369', ''),
  ('rbsnb-entrepreneurship-minor-elective', '33:382:310', ''),
  ('rbsnb-entrepreneurship-minor-elective', '33:382:360', ''),
  ('rbsnb-entrepreneurship-minor-elective', '33:382:342', ''),
  ('rbsnb-business-analytics-concentration-required', '33:136:400', ''),
  ('rbsnb-business-analytics-concentration-required', '33:136:485', ''),
  ('rbsnb-business-analytics-concentration-elective', '33:136:494', ''),
  ('rbsnb-business-analytics-concentration-elective', '33:136:450', ''),
  ('rbsnb-business-analytics-concentration-elective', '33:136:487', ''),
  ('rbsnb-business-analytics-concentration-elective', '33:136:486', ''),
  ('rbsnb-business-analytics-concentration-elective', '33:136:405', ''),
  ('rbsnb-entrepreneurship-concentration-required', '33:382:302', ''),
  ('rbsnb-entrepreneurship-concentration-required', '33:382:303', ''),
  ('rbsnb-entrepreneurship-concentration-elective', '33:382:340', ''),
  ('rbsnb-entrepreneurship-concentration-elective', '33:382:496', ''),
  ('rbsnb-entrepreneurship-concentration-elective', '33:620:475', ''),
  ('rbsnb-entrepreneurship-concentration-elective', '33:382:355', ''),
  ('rbsnb-entrepreneurship-concentration-elective', '33:382:352', ''),
  ('rbsnb-entrepreneurship-concentration-elective', '33:382:486', ''),
  ('rbsnb-entrepreneurship-concentration-elective', '33:630:369', ''),
  ('rbsnb-entrepreneurship-concentration-elective', '33:382:310', ''),
  ('rbsnb-entrepreneurship-concentration-elective', '33:382:360', ''),
  ('rbsnb-entrepreneurship-concentration-elective', '33:382:342', ''),
  ('rbsnb-finance-concentration-required', '33:390:380', ''),
  ('rbsnb-finance-concentration-required', '33:390:400', ''),
  ('rbsnb-finance-concentration-required', '33:390:420', 'Prerequisite: 33:390:380.'),
  ('rbsnb-fixed-income-credit-analysis-concentration-required', '33:390:380', ''),
  ('rbsnb-fixed-income-credit-analysis-concentration-required', '33:390:400', ''),
  ('rbsnb-fixed-income-credit-analysis-concentration-required', '33:390:420', 'Prerequisite: 33:390:380.'),
  ('rbsnb-fixed-income-credit-analysis-concentration-required', '33:390:385', 'Prerequisite: 33:390:400.'),
  ('rbsnb-fixed-income-credit-analysis-concentration-required', '33:390:490', 'Prerequisite: 33:390:380.'),
  ('rbsnb-fixed-income-credit-analysis-concentration-required', '33:390:491', 'Prerequisite: 33:390:380.'),
  ('rbsnb-global-business-concentration-required', '33:620:402', ''),
  ('rbsnb-global-business-concentration-required', '33:620:369', ''),
  ('rbsnb-global-business-concentration-elective', '22:620:320', ''),
  ('rbsnb-global-business-concentration-elective', '33:620:479', ''),
  ('rbsnb-global-business-concentration-elective', '33:620:410', ''),
  ('rbsnb-global-business-concentration-elective', '33:390:320', ''),
  ('rbsnb-global-business-concentration-elective', '33:390:375', ''),
  ('rbsnb-global-business-concentration-elective', '33:620:475', ''),
  ('rbsnb-global-business-concentration-elective', '33:630:371', ''),
  ('rbsnb-global-business-concentration-elective', '33:620:370', ''),
  ('rbsnb-global-business-concentration-elective', '33:620:350', ''),
  ('rbsnb-global-business-concentration-elective', '33:799:305', ''),
  ('rbsnb-leadership-skills-concentration-required', '33:620:410', ''),
  ('rbsnb-leadership-skills-concentration-primary-elective', '33:620:362', ''),
  ('rbsnb-leadership-skills-concentration-primary-elective', '33:620:350', ''),
  ('rbsnb-management-information-systems-concentration-required', '33:136:470', ''),
  ('rbsnb-management-information-systems-concentration-required', '33:136:388', ''),
  ('rbsnb-management-information-systems-concentration-elective', '33:136:494', ''),
  ('rbsnb-management-information-systems-concentration-elective', '33:136:465', ''),
  ('rbsnb-management-information-systems-concentration-elective', '33:136:471', ''),
  ('rbsnb-management-information-systems-concentration-elective', '33:136:450', ''),
  ('rbsnb-professional-selling-concentration-required', '33:630:485', ''),
  ('rbsnb-professional-selling-concentration-required', '33:630:401', ''),
  ('rbsnb-professional-selling-concentration-elective', '33:620:350', ''),
  ('rbsnb-professional-selling-concentration-elective', '33:630:368', ''),
  ('rbsnb-professional-selling-concentration-elective', '33:630:369', ''),
  ('rbsnb-professional-selling-concentration-elective', '33:630:370', '')
ON CONFLICT(group_id, course_code) DO UPDATE SET note=excluded.note;

-- Elective list not enumerated on the official Fixed Income page; it is kept
-- as a group with no children rather than inventing a list of finance courses.
INSERT INTO requirement_raw_notes (program_id, section_name, raw_text, resolved)
VALUES
  ('rbsnb-fixed-income-credit-analysis-concentration', 'Finance elective', 'Choose one additional finance elective. The official page does not enumerate the approved elective list.', 0),
  ('rbsnb-real-estate-concentration', 'Path logic', 'Non-Finance path: 33:851:350, 33:851:380, 33:851:470, 33:851:432; 33:390:300 precedes 33:851:380. Finance path: 33:851:350, 33:390:435, 33:851:470, 33:851:432; page names 33:390:310 as the prerequisite for 33:390:435, but the Finance concentration page says 33:390:310 is no longer offered. The current schema cannot express this mutually exclusive path safely; do not mark reviewed until reconciled.', 0),
  ('rbsnb-leadership-skills-concentration', 'Three-course rule', 'Take 33:620:410 and at least one of 33:620:362 or 33:620:350. If only one primary elective is selected, take one of 33:620:320, 33:620:370, 33:620:430, or 33:620:330. 33:620:320 and 33:620:430 require 33:620:301; 33:620:330 requires 33:620:301 plus junior or senior standing. The current schema cannot make the third group conditional.', 0),
  ('rbsnb-business-administration-minor', 'Formal admission', 'Requires application/admission, good academic standing with GPA 2.0+, pre-calculus completion or placement, and Statistics I or one listed approved substitute. The minor page also limits transfer-course use.', 0),
  ('rbsnb-entrepreneurship-minor', 'Formal admission', 'For non-RBS students; the page says students may not double minor in Business Administration and Entrepreneurship.', 0),
  ('rbsnb-business-analytics-concentration', 'Formal declaration', 'RBS-New Brunswick students only; BAIT majors may not declare this concentration; RBS-NB Undergraduate Programs Office contact is required to enroll in the courses.', 0),
  ('rbsnb-management-information-systems-concentration', 'Formal declaration', 'RBS-New Brunswick students only; BAIT majors may not declare this concentration; RBS-NB Undergraduate Programs Office contact is required to enroll in the courses.', 0),
  ('rbsnb-finance-concentration', 'Formal declaration', 'Finance majors may not declare this concentration. A B or better in 33:390:300 is required to declare and take additional finance-department courses.', 0),
  ('rbsnb-fixed-income-credit-analysis-concentration', 'Formal declaration', 'The current concentrations landing page labels this Finance-majors-only. A B or better in 33:390:300 is required to declare according to the detail page.', 0),
  ('rbsnb-global-business-concentration', 'Formal declaration', 'Leadership and Management majors may not declare this concentration.', 0),
  ('rbsnb-entrepreneurship-concentration', 'Formal declaration', 'Leadership and Management majors may not declare this concentration. The source says management majors may do it but may not double-count elective credits; this wording needs reconciliation with the named-major restriction.', 0),
  ('rbsnb-leadership-skills-concentration', 'Formal declaration', 'Leadership and Management majors may not declare this concentration.', 0),
  ('rbsnb-professional-selling-concentration', 'Overlap policy', 'Marketing majors may declare it and these courses count as major electives, an exception to the no-overlap statement. This requires a specific reviewed double-count exception before publication.', 0),
  ('rbsnb-real-estate-concentration', 'Overlap policy', 'The Finance path says 33:390:435 counts simultaneously as a concentration requirement and a Finance-major elective, an exception to the no-overlap statement. This requires a specific reviewed double-count exception before publication.', 0);

INSERT INTO program_eligibility_rules (rule_key, program_id, condition_type, condition_value_json, decision, note, source_url, review_status, verified_at)
VALUES
  ('rbsnb-ba-minor-non-rbs-only', 'rbsnb-business-administration-minor', 'home_school_must_not_be_one_of', '["rbsnb"]', 'blocked', 'The Business Administration minor is for non-RBS students.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-administration-minor', 'unreviewed', NULL),
  ('rbsnb-ent-minor-non-rbs-only', 'rbsnb-entrepreneurship-minor', 'home_school_must_not_be_one_of', '["rbsnb"]', 'blocked', 'The Entrepreneurship minor is for non-RBS students.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-minor', 'unreviewed', NULL),
  ('rbsnb-ba-minor-no-ent-minor', 'rbsnb-business-administration-minor', 'selected_program_must_not_include_any', '["rbsnb-entrepreneurship-minor"]', 'blocked', 'Students may not double minor in Business Administration and Entrepreneurship.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-administration-minor', 'unreviewed', NULL),
  ('rbsnb-ent-minor-no-ba-minor', 'rbsnb-entrepreneurship-minor', 'selected_program_must_not_include_any', '["rbsnb-business-administration-minor"]', 'blocked', 'Students may not double minor in Business Administration and Entrepreneurship.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-minor', 'unreviewed', NULL),
  ('rbsnb-ba-minor-admission', 'rbsnb-business-administration-minor', 'application_required', '{}', 'requires_approval', 'Formal admission is required; the source also specifies GPA, math, statistics, and transfer-course conditions.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-administration-minor', 'unreviewed', NULL),
  ('rbsnb-business-analytics-concentration-rbs-only', 'rbsnb-business-analytics-concentration', 'home_school_must_be_one_of', '["rbsnb"]', 'blocked', 'This concentration is for students in the RBS undergraduate New Brunswick program.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-analytics-concentration', 'unreviewed', NULL),
  ('rbsnb-entrepreneurship-concentration-rbs-only', 'rbsnb-entrepreneurship-concentration', 'home_school_must_be_one_of', '["rbsnb"]', 'blocked', 'This concentration is for RBS students.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-concentration', 'unreviewed', NULL),
  ('rbsnb-finance-concentration-rbs-only', 'rbsnb-finance-concentration', 'home_school_must_be_one_of', '["rbsnb"]', 'blocked', 'This concentration is for RBS students.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/finance-concentration', 'unreviewed', NULL),
  ('rbsnb-fixed-income-credit-analysis-concentration-rbs-only', 'rbsnb-fixed-income-credit-analysis-concentration', 'home_school_must_be_one_of', '["rbsnb"]', 'blocked', 'This concentration is listed by RBS New Brunswick for its undergraduate students.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/concentrations', 'unreviewed', NULL),
  ('rbsnb-global-business-concentration-rbs-only', 'rbsnb-global-business-concentration', 'home_school_must_be_one_of', '["rbsnb"]', 'blocked', 'This concentration is for RBS students.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/global-business-concentration', 'unreviewed', NULL),
  ('rbsnb-leadership-skills-concentration-rbs-only', 'rbsnb-leadership-skills-concentration', 'home_school_must_be_one_of', '["rbsnb"]', 'blocked', 'This concentration is for RBS students.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/leadership-skills-concentration', 'unreviewed', NULL),
  ('rbsnb-mis-concentration-rbs-only', 'rbsnb-management-information-systems-concentration', 'home_school_must_be_one_of', '["rbsnb"]', 'blocked', 'This concentration is for students in the RBS undergraduate New Brunswick program.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/management-information-systems-concentration', 'unreviewed', NULL),
  ('rbsnb-professional-selling-concentration-rbs-only', 'rbsnb-professional-selling-concentration', 'home_school_must_be_one_of', '["rbsnb"]', 'blocked', 'This concentration is for RBS students.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/professional-selling-concentration', 'unreviewed', NULL),
  ('rbsnb-real-estate-concentration-rbs-only', 'rbsnb-real-estate-concentration', 'home_school_must_be_one_of', '["rbsnb"]', 'blocked', 'This concentration is for current undergraduate RBS students.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/real-estate-concentration', 'unreviewed', NULL),
  ('rbsnb-finance-concentration-no-finance-major', 'rbsnb-finance-concentration', 'selected_program_must_not_include_any', '["rbsnb-finance"]', 'blocked', 'Finance majors may not declare the Finance concentration.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/finance-concentration', 'unreviewed', NULL),
  ('rbsnb-business-analytics-concentration-no-bait', 'rbsnb-business-analytics-concentration', 'selected_program_must_not_include_any', '["rbsnb-bait"]', 'blocked', 'BAIT majors may not declare the Business Analytics concentration.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-analytics-concentration', 'unreviewed', NULL),
  ('rbsnb-mis-concentration-no-bait', 'rbsnb-management-information-systems-concentration', 'selected_program_must_not_include_any', '["rbsnb-bait"]', 'blocked', 'BAIT majors may not declare the Management Information Systems concentration.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/management-information-systems-concentration', 'unreviewed', NULL),
  ('rbsnb-global-business-concentration-no-lm', 'rbsnb-global-business-concentration', 'selected_program_must_not_include_any', '["rbsnb-leadership-management"]', 'blocked', 'Leadership and Management majors may not declare the Global Business concentration.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/global-business-concentration', 'unreviewed', NULL),
  ('rbsnb-entrepreneurship-concentration-no-lm', 'rbsnb-entrepreneurship-concentration', 'selected_program_must_not_include_any', '["rbsnb-leadership-management"]', 'blocked', 'Leadership and Management majors may not declare the Entrepreneurship concentration.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-concentration', 'unreviewed', NULL),
  ('rbsnb-leadership-skills-concentration-no-lm', 'rbsnb-leadership-skills-concentration', 'selected_program_must_not_include_any', '["rbsnb-leadership-management"]', 'blocked', 'Leadership and Management majors may not declare the Leadership Skills concentration.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/leadership-skills-concentration', 'unreviewed', NULL),
  ('rbsnb-fixed-income-credit-analysis-finance-only', 'rbsnb-fixed-income-credit-analysis-concentration', 'selected_program_must_include_one_of', '["rbsnb-finance"]', 'blocked', 'The current RBS concentrations landing page describes Fixed Income and Credit Analysis as for Finance majors only.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/concentrations', 'unreviewed', NULL),
  ('rbsnb-finance-concentration-grade', 'rbsnb-finance-concentration', 'minimum_course_grade', '{"course_code":"33:390:300","minimum_grade":"B"}', 'requires_approval', 'A B or better in Financial Management is required to declare.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/finance-concentration', 'unreviewed', NULL),
  ('rbsnb-fixed-income-credit-analysis-grade', 'rbsnb-fixed-income-credit-analysis-concentration', 'minimum_course_grade', '{"course_code":"33:390:300","minimum_grade":"B"}', 'requires_approval', 'A B or better in Financial Management is required to declare.', 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/fixed-income-credit-analysis-concentration', 'unreviewed', NULL)
ON CONFLICT(rule_key) DO UPDATE SET
  program_id=excluded.program_id,
  condition_type=excluded.condition_type,
  condition_value_json=excluded.condition_value_json,
  decision=excluded.decision,
  note=excluded.note,
  source_url=excluded.source_url,
  review_status='unreviewed',
  verified_at=NULL;
