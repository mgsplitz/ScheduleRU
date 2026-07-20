-- Reviewed prerequisite records for courses that can be absent from the
-- selected-term Schedule of Classes feed. Apply after
-- schema_course_eligibility_conditions.sql, development first:
--
--   npx wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/reviewed_course_prerequisites.sql

INSERT INTO course_eligibility_reviews (
  course_code, campus_slug, catalog_year, review_status, no_known_conditions,
  source_url, source_label, source_date, reviewed_at, note
)
VALUES
  (
    '01:220:481', 'sasnb', 'Current department page (catalog year not stated)',
    'reviewed', 0,
    'https://economics.rutgers.edu/academics/undergraduate/course-descriptions/course-details/223-upper-level-electives/861-01-220-481-economics-of-uncertainty-3',
    'Rutgers Economics: Economics of Uncertainty', '2026-07-19', strftime('%s','now') * 1000,
    'Department page lists Intermediate Microeconomic Analysis, one statistics option, and one Calculus II option.'
  ),
  (
    '33:136:405', 'rbsnb', 'Current RBS concentration page (catalog year not stated)',
    'reviewed', 0,
    'https://www.business.rutgers.edu/undergraduate-new-brunswick/business-analytics-concentration',
    'RBS New Brunswick Business Analytics Concentration', '2026-07-19', strftime('%s','now') * 1000,
    'The RBS concentration page lists 33:136:386 as the prerequisite for Risk Modeling.'
  )
ON CONFLICT(course_code) DO UPDATE SET
  campus_slug=excluded.campus_slug,
  catalog_year=excluded.catalog_year,
  review_status=excluded.review_status,
  no_known_conditions=excluded.no_known_conditions,
  source_url=excluded.source_url,
  source_label=excluded.source_label,
  source_date=excluded.source_date,
  reviewed_at=excluded.reviewed_at,
  note=excluded.note;

INSERT INTO course_eligibility_conditions (
  course_code, condition_key, condition_type, condition_value_json,
  review_status, source_url, source_label, source_date, reviewed_at
)
VALUES
  (
    '01:220:481', 'intermediate-microeconomic-analysis', 'prerequisite_course',
    '{"any_of_course_codes":["01:220:320"]}', 'reviewed',
    'https://economics.rutgers.edu/academics/undergraduate/course-descriptions/course-details/223-upper-level-electives/861-01-220-481-economics-of-uncertainty-3',
    'Rutgers Economics: Economics of Uncertainty', '2026-07-19', strftime('%s','now') * 1000
  ),
  (
    '01:220:481', 'statistics', 'prerequisite_course',
    '{"any_of_course_codes":["01:960:211","01:960:285"]}', 'reviewed',
    'https://economics.rutgers.edu/academics/undergraduate/course-descriptions/course-details/223-upper-level-electives/861-01-220-481-economics-of-uncertainty-3',
    'Rutgers Economics: Economics of Uncertainty', '2026-07-19', strftime('%s','now') * 1000
  ),
  (
    '01:220:481', 'calculus-ii', 'prerequisite_course',
    '{"any_of_course_codes":["01:640:136","01:640:152"]}', 'reviewed',
    'https://economics.rutgers.edu/academics/undergraduate/course-descriptions/course-details/223-upper-level-electives/861-01-220-481-economics-of-uncertainty-3',
    'Rutgers Economics: Economics of Uncertainty', '2026-07-19', strftime('%s','now') * 1000
  ),
  (
    '33:136:405', 'operations-management', 'prerequisite_course',
    '{"any_of_course_codes":["33:136:386"]}', 'reviewed',
    'https://www.business.rutgers.edu/undergraduate-new-brunswick/business-analytics-concentration',
    'RBS New Brunswick Business Analytics Concentration', '2026-07-19', strftime('%s','now') * 1000
  )
ON CONFLICT(course_code, condition_key) DO UPDATE SET
  condition_type=excluded.condition_type,
  condition_value_json=excluded.condition_value_json,
  review_status=excluded.review_status,
  source_url=excluded.source_url,
  source_label=excluded.source_label,
  source_date=excluded.source_date,
  reviewed_at=excluded.reviewed_at;
