-- Reviewed SAS New Brunswick Physics - General Option B.A. (program code 750).
--
-- The department explicitly leaves introductory/calc equivalencies and the
-- coherent 18-credit science-and-math sequence to adviser review. This seed
-- therefore automates only the finite requirement paths published as such.

INSERT INTO programs (
  id, name, school_slug, program_slug, type, catalog_year,
  academic_program_code, degree_type, program_family_id, source_url,
  review_status, last_scraped_at, requirement_evidence_required
) VALUES (
  'sasnb-physics-general-ba', 'Physics - General Option', 'sasnb', 'physics-general-option', 'major',
  'Current official departmental and SAS pages', '750', 'B.A.', 'sasnb-physics-750',
  'https://physics.rutgers.edu/academics/undergraduate-program/majors/major-in-physics',
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
  program_id, source_url, source_title, source_catalog_year, source_scope, accessed_at, note
) VALUES
  (
    'sasnb-physics-general-ba',
    'https://physics.rutgers.edu/academics/undergraduate-program/majors/major-in-physics',
    'Physics Major Requirements', NULL, 'program_requirements', strftime('%s','now') * 1000,
    'Current department page; the General Option lists the complete fixed course paths and separately identifies adviser-reviewed equivalencies and electives.'
  ),
  (
    'sasnb-physics-general-ba',
    'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/physics-general-option',
    'Physics - General Option (Major) | BA', NULL, 'program_profile', strftime('%s','now') * 1000,
    'Current SAS profile confirms SAS ownership, program code 750, B.A. degree type, and credit-intensive status.'
  )
ON CONFLICT(program_id, source_url) DO UPDATE SET
  source_title=excluded.source_title,
  source_catalog_year=excluded.source_catalog_year,
  source_scope=excluded.source_scope,
  accessed_at=excluded.accessed_at,
  note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id = 'sasnb-physics-general-ba';
DELETE FROM requirement_course_selectors WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-physics-general-ba'
);
DELETE FROM requirement_courses WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-physics-general-ba'
);
DELETE FROM requirement_groups WHERE program_id = 'sasnb-physics-general-ba';
DELETE FROM program_eligibility_rules WHERE program_id = 'sasnb-physics-general-ba';

INSERT INTO requirement_groups (
  id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated
) VALUES
  (
    'sasnb-physics-general-ba-introductory-physics', 'sasnb-physics-general-ba', NULL,
    'General Physics lecture sequence.', 'all', NULL, 10, 0
  ),
  (
    'sasnb-physics-general-ba-laboratories', 'sasnb-physics-general-ba', NULL,
    'One approved Physics laboratory sequence.', 'one_of', NULL, 20, 0
  ),
  (
    'sasnb-physics-general-ba-laboratories-205', 'sasnb-physics-general-ba', 'sasnb-physics-general-ba-laboratories',
    'General Physics Laboratory sequence: 205 and 206.', 'all', NULL, 10, 0
  ),
  (
    'sasnb-physics-general-ba-laboratories-229', 'sasnb-physics-general-ba', 'sasnb-physics-general-ba-laboratories',
    'Analytical Physics Laboratory sequence: 229 and 230.', 'all', NULL, 20, 0
  ),
  (
    'sasnb-physics-general-ba-laboratories-275', 'sasnb-physics-general-ba', 'sasnb-physics-general-ba-laboratories',
    'Classical Physics Laboratory sequence: 275 and 276.', 'all', NULL, 30, 0
  ),
  (
    'sasnb-physics-general-ba-advanced-core', 'sasnb-physics-general-ba', NULL,
    'Required advanced Physics courses.', 'all', NULL, 30, 0
  ),
  (
    'sasnb-physics-general-ba-advanced-labs', 'sasnb-physics-general-ba', NULL,
    'One approved advanced Physics laboratory pair.', 'one_of', NULL, 40, 0
  ),
  (
    'sasnb-physics-general-ba-advanced-labs-326', 'sasnb-physics-general-ba', 'sasnb-physics-general-ba-advanced-labs',
    'Advanced Physics laboratory pair: 326 and 327.', 'all', NULL, 10, 0
  ),
  (
    'sasnb-physics-general-ba-advanced-labs-345', 'sasnb-physics-general-ba', 'sasnb-physics-general-ba-advanced-labs',
    'Advanced Physics laboratory pair: 345 and 346.', 'all', NULL, 20, 0
  ),
  (
    'sasnb-physics-general-ba-additional-advanced', 'sasnb-physics-general-ba', NULL,
    'One additional 300- or 400-level Physics course.', 'min_courses', 1, 50, 0
  );

INSERT INTO requirement_courses (group_id, course_code, note, source_title, source_credits)
VALUES
  ('sasnb-physics-general-ba-introductory-physics', '01:750:203', NULL, 'General Physics I', '3'),
  ('sasnb-physics-general-ba-introductory-physics', '01:750:204', NULL, 'General Physics II', '3'),
  ('sasnb-physics-general-ba-laboratories-205', '01:750:205', NULL, 'General Physics Laboratory I', '1'),
  ('sasnb-physics-general-ba-laboratories-205', '01:750:206', NULL, 'General Physics Laboratory II', '1'),
  ('sasnb-physics-general-ba-laboratories-229', '01:750:229', NULL, 'Analytical Physics IIA Laboratory', '1'),
  ('sasnb-physics-general-ba-laboratories-229', '01:750:230', NULL, 'Analytical Physics IIB Laboratory', '1'),
  ('sasnb-physics-general-ba-laboratories-275', '01:750:275', NULL, 'Classical Physics Laboratory I', '2'),
  ('sasnb-physics-general-ba-laboratories-275', '01:750:276', NULL, 'Classical Physics Laboratory II', '2'),
  ('sasnb-physics-general-ba-advanced-core', '01:750:313', NULL, 'Modern Physics', '3'),
  ('sasnb-physics-general-ba-advanced-core', '01:750:323', NULL, 'Advanced General Physics I', '3'),
  ('sasnb-physics-general-ba-advanced-core', '01:750:324', NULL, 'Advanced General Physics II', '3'),
  ('sasnb-physics-general-ba-advanced-labs-326', '01:750:326', NULL, 'Introduction to Computer-Based Experimentation and Physics Computing', '4'),
  ('sasnb-physics-general-ba-advanced-labs-326', '01:750:327', NULL, 'Modern Instrumentation', '3'),
  ('sasnb-physics-general-ba-advanced-labs-345', '01:750:345', NULL, 'Computational Astrophysics', '3'),
  ('sasnb-physics-general-ba-advanced-labs-345', '01:750:346', NULL, 'Observational Astronomy', '3');

INSERT INTO requirement_course_selectors (
  group_id, selector_key, selector_json, source_url, source_label, review_status, reviewed_at
) VALUES (
  'sasnb-physics-general-ba-additional-advanced',
  'sasnb-physics-general-ba-additional-advanced-physics',
  '{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["750"],"course_number_min":300,"course_number_max":489,"exclude_course_codes":["01:750:313","01:750:323","01:750:324","01:750:326","01:750:327","01:750:345","01:750:346"],"label":"Additional 300- or 400-level Physics course, excluding the required advanced courses and 490-level courses"}',
  'https://physics.rutgers.edu/academics/undergraduate-program/majors/major-in-physics',
  'Physics Major Requirements', 'reviewed', strftime('%s','now') * 1000
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
  'sasnb-physics-general-ba',
  'group',
  id,
  NULL,
  'https://physics.rutgers.edu/academics/undergraduate-program/majors/major-in-physics',
  'Physics Major Requirements',
  NULL,
  strftime('%s','now') * 1000,
  'Current General Option fixed course path or reviewed bounded selector.',
  'reviewed'
FROM requirement_groups
WHERE program_id = 'sasnb-physics-general-ba';

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'course:' || requirement_courses.group_id || ':' || requirement_courses.course_code,
  'sasnb-physics-general-ba',
  'course',
  requirement_courses.group_id,
  requirement_courses.course_code,
  'https://physics.rutgers.edu/academics/undergraduate-program/majors/major-in-physics',
  'Physics Major Requirements',
  NULL,
  strftime('%s','now') * 1000,
  'Current General Option fixed course requirement.',
  'reviewed'
FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-physics-general-ba'
);

INSERT INTO program_eligibility_rules (
  rule_key, program_id, condition_type, condition_value_json, decision,
  note, source_url, review_status, verified_at
) VALUES (
  'sasnb-physics-general-ba-academic-review',
  'sasnb-physics-general-ba',
  'advisor_confirmation',
  '{"topics":["01:750:203-204 or any other equivalent sequence","Two terms of any calculus sequence","18 additional credits of natural science or mathematics forming an adviser-approved coherent sequence","C average in physics and mathematics courses","four of the six advanced Physics courses at Rutgers-New Brunswick","at least 15 credits of physics courses at the 300-level or higher applied to the major at Rutgers-New Brunswick"]}',
  'requires_approval',
  'Confirm any other equivalent sequence, Two terms of any calculus sequence, the 18 additional credits, C average, and Rutgers-New Brunswick residency requirements with Physics advising before relying on this plan.',
  'https://physics.rutgers.edu/academics/undergraduate-program/majors/major-in-physics',
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
