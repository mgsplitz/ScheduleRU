-- Reviewed RBS areas-of-study batch 3, sourced from the current 2025-26
-- Rutgers catalog. This enables only the programs whose paths and overlap
-- policies can now be represented exactly. Fixed Income remains unreviewed:
-- Rutgers has not published its approved finance-elective list.
--
-- Prerequisite migration:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/schema_requirement_context_and_overlap_exceptions.sql
--
-- Then apply this reviewed data:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/review_rbs_programs_batch_3.sql

-- Rebuild only the two mutually exclusive Real Estate paths. This makes the
-- path depend on the selected major rather than asking a Finance major to
-- manually choose from a misleading list.
DELETE FROM requirement_courses
WHERE group_id IN (
  'rbsnb-real-estate-concentration-finance-path',
  'rbsnb-real-estate-concentration-other-rbs-path'
);
DELETE FROM requirement_group_conditions
WHERE group_id IN (
  'rbsnb-real-estate-concentration-finance-path',
  'rbsnb-real-estate-concentration-other-rbs-path'
);
DELETE FROM requirement_groups
WHERE id IN (
  'rbsnb-real-estate-concentration-finance-path',
  'rbsnb-real-estate-concentration-other-rbs-path'
);

INSERT INTO requirement_groups
  (id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated)
VALUES
  ('rbsnb-real-estate-concentration-finance-path', 'rbsnb-real-estate-concentration', NULL, 'Finance-major path', 'all', NULL, 1, 0),
  ('rbsnb-real-estate-concentration-other-rbs-path', 'rbsnb-real-estate-concentration', NULL, 'Other RBS-major path', 'all', NULL, 1, 0);

INSERT INTO requirement_group_conditions
  (group_id, condition_type, condition_value_json, note, source_url, review_status)
VALUES
  (
    'rbsnb-real-estate-concentration-finance-path',
    'selected_program_must_include_one_of', '["rbsnb-finance"]',
    'This four-course path applies when Finance is one of the selected majors.',
    'https://newbrunswick-undergrad-25-26.catalogs.rutgers.edu/pages/UJZs3d8utgfwF9wxIaoR', 'reviewed'
  ),
  (
    'rbsnb-real-estate-concentration-other-rbs-path',
    'selected_program_must_not_include_any', '["rbsnb-finance"]',
    'This four-course path applies to RBS majors other than Finance.',
    'https://newbrunswick-undergrad-25-26.catalogs.rutgers.edu/pages/UJZs3d8utgfwF9wxIaoR', 'reviewed'
  );

INSERT INTO requirement_courses (group_id, course_code, note, source_title, source_credits)
VALUES
  ('rbsnb-real-estate-concentration-finance-path', '33:851:350', 'Not open to first-year students.', 'Real Estate Law', '3'),
  ('rbsnb-real-estate-concentration-finance-path', '33:390:435', 'Pre-req: 33:390:300. Finance majors only; junior or senior standing required.', 'Real Estate Finance and Mortgage-Backed Securities', '3'),
  ('rbsnb-real-estate-concentration-finance-path', '33:851:470', 'Pre-req: 33:390:435.', 'Commercial Debt Markets', '3'),
  ('rbsnb-real-estate-concentration-finance-path', '33:851:432', 'Pre-reqs: 33:851:350, 33:390:435.', 'Real Estate Development', '3'),
  ('rbsnb-real-estate-concentration-other-rbs-path', '33:851:350', 'Not open to first-year students.', 'Real Estate Law', '3'),
  ('rbsnb-real-estate-concentration-other-rbs-path', '33:851:380', 'Pre-req: 33:390:300.', 'Essentials of Real Estate Finance', '3'),
  ('rbsnb-real-estate-concentration-other-rbs-path', '33:851:470', 'Pre-req: 33:851:380.', 'Commercial Debt Markets', '3'),
  ('rbsnb-real-estate-concentration-other-rbs-path', '33:851:432', 'Pre-reqs: 33:851:350, 33:851:380.', 'Real Estate Development', '3');

-- These are exceptions to the RBS-wide no-overlap rule, not broad waivers.
-- The application checks both named programs and the exact approved code.
INSERT INTO double_count_exceptions
  (program_a, program_b, allowed_course_codes_json, note, source_url, review_status, verified_at)
VALUES
  (
    'rbsnb-marketing', 'rbsnb-professional-selling-concentration',
    '["33:630:401","33:630:485","33:630:370","33:630:368","33:620:350","33:630:369"]',
    'Marketing majors may declare Professional Selling. Its two required courses and one approved elective count as Marketing-major electives; this is the published exception to the normal RBS no-overlap rule.',
    'https://newbrunswick-undergrad-25-26.catalogs.rutgers.edu/pages/xCxv7911FeYjTcoZJR3X',
    'reviewed', strftime('%s','now') * 1000
  ),
  (
    'rbsnb-finance', 'rbsnb-real-estate-concentration',
    '["33:390:435"]',
    'For Finance majors, 33:390:435 Real Estate Finance and Mortgage-Backed Securities counts both as the Real Estate concentration requirement and as a Finance-major elective. No other Real Estate concentration course is included in this exception.',
    'https://newbrunswick-undergrad-25-26.catalogs.rutgers.edu/pages/UJZs3d8utgfwF9wxIaoR',
    'reviewed', strftime('%s','now') * 1000
  )
ON CONFLICT(program_a, program_b) DO UPDATE SET
  allowed_course_codes_json=excluded.allowed_course_codes_json,
  note=excluded.note,
  source_url=excluded.source_url,
  review_status=excluded.review_status,
  verified_at=excluded.verified_at;

-- The current catalog's named Leadership & Management exclusion resolves the
-- older broad sentence about management majors. Keep the specific rule.
UPDATE programs
SET review_status='reviewed'
WHERE id IN (
  'rbsnb-entrepreneurship-concentration',
  'rbsnb-professional-selling-concentration',
  'rbsnb-real-estate-concentration'
);

UPDATE program_eligibility_rules
SET review_status='reviewed', verified_at=strftime('%s','now') * 1000
WHERE rule_key IN (
  'rbsnb-entrepreneurship-concentration-rbs-only',
  'rbsnb-entrepreneurship-concentration-no-lm',
  'rbsnb-professional-selling-concentration-rbs-only',
  'rbsnb-real-estate-concentration-rbs-only'
);

DELETE FROM requirement_raw_notes
WHERE program_id IN (
  'rbsnb-entrepreneurship-concentration',
  'rbsnb-professional-selling-concentration',
  'rbsnb-real-estate-concentration',
  'rbsnb-fixed-income-credit-analysis-concentration'
) AND section_name IN ('Formal declaration', 'Overlap policy', 'Path logic', 'Finance elective');

INSERT INTO requirement_raw_notes (program_id, section_name, raw_text, resolved)
VALUES
  (
    'rbsnb-entrepreneurship-concentration', 'Formal declaration',
    'The current 2025-26 RBS catalog says Leadership and Management majors may not declare the Entrepreneurship concentration. The earlier generic management-major sentence is superseded by this named restriction.', 1
  ),
  (
    'rbsnb-professional-selling-concentration', 'Overlap policy',
    'The current 2025-26 RBS catalog permits Marketing majors to declare Professional Selling and says its listed concentration courses count as Marketing-major electives. The reviewed course-specific exception records the six published course options.', 1
  ),
  (
    'rbsnb-real-estate-concentration', 'Path logic',
    'The current 2025-26 RBS catalog supplies a Finance-major path and an other-RBS-major path. Both use 33:390:300 as the prerequisite for the path finance course. The reviewed data selects the correct path from the chosen major and permits only 33:390:435 to overlap with the Finance major.', 1
  ),
  (
    'rbsnb-fixed-income-credit-analysis-concentration', 'Finance elective',
    'The current 2025-26 RBS catalog confirms that only Finance majors may declare this concentration and that it becomes part of the Finance major program, but it still does not enumerate the approved additional Finance elective or its overlap treatment. The program remains unreviewed until RBS publishes or confirms those details.', 0
  );
