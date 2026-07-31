-- Reviewed RBS-New Brunswick programs, batch 2: Leadership Skills
--
-- Development-only review decision, 2026-07-19. The official detail page
-- requires Executive Leadership plus two electives, including at least one
-- of the two primary electives. The generic nested-constraint evaluator
-- enforces that source rule without a one-off exception.
--
-- Apply only after the original RBS areas-of-study draft seed and batch 1:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/review_rbs_programs_batch_2.sql

INSERT INTO requirement_groups
  (id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated)
VALUES
  (
    'rbsnb-leadership-skills-concentration-electives',
    'rbsnb-leadership-skills-concentration', NULL,
    'Leadership Skills electives (choose 2)', 'min_courses', 2, 2, 0
  )
ON CONFLICT(id) DO UPDATE SET
  parent_group_id=excluded.parent_group_id,
  name=excluded.name,
  rule=excluded.rule,
  count=excluded.count,
  sort_order=excluded.sort_order,
  auto_generated=excluded.auto_generated;

UPDATE requirement_groups
SET parent_group_id = 'rbsnb-leadership-skills-concentration-electives',
    name = 'At least one primary elective',
    rule = 'min_courses',
    count = 1,
    sort_order = 1,
    auto_generated = 0
WHERE id = 'rbsnb-leadership-skills-concentration-primary-elective';

INSERT INTO requirement_courses
  (group_id, course_code, note, source_title, source_credits)
VALUES
  ('rbsnb-leadership-skills-concentration-required', '33:620:410', '', 'Executive Leadership', '3'),
  ('rbsnb-leadership-skills-concentration-electives', '33:620:362', '', 'Effective Leadership Communications', '3'),
  ('rbsnb-leadership-skills-concentration-electives', '33:620:350', '', 'Negotiations', '3'),
  ('rbsnb-leadership-skills-concentration-electives', '33:620:320', 'Prerequisite: 33:620:301.', 'Cross-Cultural Management', '3'),
  ('rbsnb-leadership-skills-concentration-electives', '33:620:370', '', 'Diversity, Equity, and Inclusion in Management and Organizations', '3'),
  ('rbsnb-leadership-skills-concentration-electives', '33:620:430', 'Prerequisite: 33:620:301.', 'Team Building and Group Processes', '3'),
  ('rbsnb-leadership-skills-concentration-electives', '33:620:330', 'Prerequisites: 33:620:301 and junior or senior standing.', 'Women Leading in Business', '3'),
  ('rbsnb-leadership-skills-concentration-primary-elective', '33:620:362', '', 'Effective Leadership Communications', '3'),
  ('rbsnb-leadership-skills-concentration-primary-elective', '33:620:350', '', 'Negotiations', '3')
ON CONFLICT(group_id, course_code) DO UPDATE SET
  note=excluded.note,
  source_title=excluded.source_title,
  source_credits=excluded.source_credits;

INSERT INTO program_eligibility_rules
  (rule_key, program_id, condition_type, condition_value_json, decision, note, source_url, review_status, verified_at)
VALUES
  (
    'rbsnb-leadership-skills-concentration-declaration-timing',
    'rbsnb-leadership-skills-concentration',
    'advisor_confirmation', '{}', 'requires_approval',
    'Confirm declaration timing with RBS. The concentrations page says 45 completed college credits; the RBS policies page also describes completing all six pre-business eligibility courses and declaring a major by the end of sophomore spring.',
    'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/policies-procedures',
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

UPDATE program_eligibility_rules
SET review_status = 'reviewed', verified_at = strftime('%s','now') * 1000
WHERE program_id = 'rbsnb-leadership-skills-concentration';

UPDATE requirement_raw_notes
SET raw_text = 'Take 33:620:410 plus two electives, including at least one of 33:620:362 or 33:620:350. The reviewed requirement tree models this total-plus-subset rule. 33:620:320 and 33:620:430 require 33:620:301; 33:620:330 requires 33:620:301 plus junior or senior standing.',
    resolved = 1
WHERE program_id = 'rbsnb-leadership-skills-concentration'
  AND section_name = 'Three-course rule';

UPDATE requirement_raw_notes
SET resolved = 1
WHERE program_id = 'rbsnb-leadership-skills-concentration';

UPDATE programs
SET review_status = 'reviewed',
    catalog_year = 'Current RBS page (catalog year not stated)'
WHERE id = 'rbsnb-leadership-skills-concentration';
