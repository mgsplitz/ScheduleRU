-- Reviewed RBS-New Brunswick programs, batch 1
--
-- Development-only review decision, 2026-07-19. These six programs have
-- complete course trees and non-conflicting official RBS detail pages. The
-- source pages do not publish an applicable catalog year, so the reviewed
-- program label says that openly instead of assigning a guessed year.
--
-- Apply only after the RBS areas-of-study draft seed:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/review_rbs_programs_batch_1.sql

INSERT INTO program_eligibility_rules
  (rule_key, program_id, condition_type, condition_value_json, decision, note, source_url, review_status, verified_at)
VALUES
  (
    'rbsnb-business-analytics-concentration-office-contact',
    'rbsnb-business-analytics-concentration',
    'advisor_confirmation', '{}', 'requires_approval',
    'The RBS-NB Undergraduate Programs Office must be contacted to enroll in these courses.',
    'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-analytics-concentration',
    'reviewed', strftime('%s','now') * 1000
  ),
  (
    'rbsnb-mis-concentration-office-contact',
    'rbsnb-management-information-systems-concentration',
    'advisor_confirmation', '{}', 'requires_approval',
    'The RBS-NB Undergraduate Programs Office must be contacted to enroll in these courses.',
    'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/management-information-systems-concentration',
    'reviewed', strftime('%s','now') * 1000
  )
ON CONFLICT(rule_key) DO UPDATE SET
  condition_type=excluded.condition_type,
  condition_value_json=excluded.condition_value_json,
  decision=excluded.decision,
  note=excluded.note,
  source_url=excluded.source_url,
  review_status=excluded.review_status,
  verified_at=excluded.verified_at;

-- Superseded during the first development review run. Keep exactly one
-- concise Business Administration formal-admission note in the UI.
DELETE FROM program_eligibility_rules
WHERE rule_key = 'rbsnb-ba-minor-formal-admission';

UPDATE program_eligibility_rules
SET condition_type = 'advisor_confirmation',
    condition_value_json = '{"minimum_gpa":2.0,"math":"C or better in 01:640:115 or placement out","statistics":"C or better in 01:960:211 or a listed substitute"}',
    decision = 'requires_approval',
    note = 'Formal admission is required: 2.0 GPA, C or better in pre-calculus (or placement out), and C or better in Statistics I or a listed substitute. Transfer-course limits also apply.',
    source_url = 'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-administration-minor',
    review_status = 'reviewed',
    verified_at = strftime('%s','now') * 1000
WHERE rule_key = 'rbsnb-ba-minor-admission';

UPDATE program_eligibility_rules
SET review_status = 'reviewed', verified_at = strftime('%s','now') * 1000
WHERE program_id IN (
  'rbsnb-business-administration-minor',
  'rbsnb-entrepreneurship-minor',
  'rbsnb-business-analytics-concentration',
  'rbsnb-finance-concentration',
  'rbsnb-global-business-concentration',
  'rbsnb-management-information-systems-concentration'
);

UPDATE requirement_raw_notes
SET resolved = 1
WHERE program_id IN (
  'rbsnb-business-administration-minor',
  'rbsnb-entrepreneurship-minor',
  'rbsnb-business-analytics-concentration',
  'rbsnb-finance-concentration',
  'rbsnb-global-business-concentration',
  'rbsnb-management-information-systems-concentration'
);

UPDATE programs
SET review_status = 'reviewed',
    catalog_year = 'Current RBS page (catalog year not stated)'
WHERE id IN (
  'rbsnb-business-administration-minor',
  'rbsnb-entrepreneurship-minor',
  'rbsnb-business-analytics-concentration',
  'rbsnb-finance-concentration',
  'rbsnb-global-business-concentration',
  'rbsnb-management-information-systems-concentration'
);
