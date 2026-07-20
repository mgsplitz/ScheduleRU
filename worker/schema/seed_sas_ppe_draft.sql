-- Non-public SAS PPE source draft
--
-- This source transcription deliberately remains unreviewed. The requirement
-- evidence gate keeps the program out of every public route until each fact
-- has been independently reviewed.

INSERT INTO programs (
  id, name, school_slug, program_slug, type, academic_program_code,
  source_url, review_status, requirement_evidence_required
) VALUES (
  'sasnb-ppe-minor', 'Philosophy, Politics, and Economics (PPE)', 'sasnb',
  'philosophy-politics-economics-ppe', 'minor', '792',
  'https://philosophy.rutgers.edu/minor-in-philosophy-politics-and-economics',
  'unreviewed', 1
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,
  school_slug=excluded.school_slug,
  program_slug=excluded.program_slug,
  type=excluded.type,
  academic_program_code=excluded.academic_program_code,
  source_url=excluded.source_url,
  review_status='unreviewed',
  requirement_evidence_required=1;

INSERT INTO program_sources (
  program_id, source_url, source_title, source_catalog_year, source_scope,
  accessed_at, note
)
VALUES
  (
    'sasnb-ppe-minor',
    'https://philosophy.rutgers.edu/minor-in-philosophy-politics-and-economics',
    'Minor in Philosophy, Politics, and Economics (PPE)', NULL,
    'program_requirements', strftime('%s','now') * 1000,
    'Current department page; no catalog-year boundary stated.'
  ),
  (
    'sasnb-ppe-minor',
    'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/philosophy-politics-and-economics-ppe',
    'Philosophy, Politics, and Economics (PPE)', NULL,
    'program_profile', strftime('%s','now') * 1000,
    'Current department page; no catalog-year boundary stated.'
  )
ON CONFLICT(program_id, source_url) DO UPDATE SET
  source_title=excluded.source_title,
  source_catalog_year=excluded.source_catalog_year,
  source_scope=excluded.source_scope,
  accessed_at=excluded.accessed_at,
  note=excluded.note;

-- Rebuild only the development draft owned by this program. Keep the program
-- and its two provenance records stable while replacing the source snapshot.
DELETE FROM program_requirement_evidence
WHERE program_id = 'sasnb-ppe-minor';

DELETE FROM requirement_courses
WHERE group_id IN (
  SELECT id FROM requirement_groups WHERE program_id = 'sasnb-ppe-minor'
);

DELETE FROM requirement_groups
WHERE program_id = 'sasnb-ppe-minor';

DELETE FROM requirement_raw_notes
WHERE program_id = 'sasnb-ppe-minor';

DELETE FROM program_eligibility_rules
WHERE program_id = 'sasnb-ppe-minor';

INSERT INTO requirement_groups (
  id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated
)
VALUES
  (
    'sasnb-ppe-philosophy', 'sasnb-ppe-minor', NULL,
    'Philosophy component; incomplete because the source allows case-by-case courses.',
    'min_courses', 3, 10, 0
  ),
  (
    'sasnb-ppe-political-theory', 'sasnb-ppe-minor', NULL,
    'One Political Theory course.', 'min_courses', 1, 20, 0
  ),
  (
    'sasnb-ppe-political-policy', 'sasnb-ppe-minor', NULL,
    'Two Policy or Group Relations courses.', 'min_courses', 2, 30, 0
  ),
  (
    'sasnb-ppe-economics-foundations', 'sasnb-ppe-minor', NULL,
    'Both Economics introductions.', 'all', NULL, 40, 0
  ),
  (
    'sasnb-ppe-economics-elective', 'sasnb-ppe-minor', NULL,
    'One listed Economics elective.', 'min_courses', 1, 50, 0
  );

INSERT INTO requirement_courses (group_id, course_code)
VALUES
  ('sasnb-ppe-philosophy', '01:730:107'),
  ('sasnb-ppe-philosophy', '01:730:249'),
  ('sasnb-ppe-philosophy', '01:730:250'),
  ('sasnb-ppe-philosophy', '01:730:251'),
  ('sasnb-ppe-philosophy', '01:730:255'),
  ('sasnb-ppe-philosophy', '01:730:330'),
  ('sasnb-ppe-philosophy', '01:730:341'),
  ('sasnb-ppe-philosophy', '01:730:342'),
  ('sasnb-ppe-philosophy', '01:730:343'),
  ('sasnb-ppe-philosophy', '01:730:345'),
  ('sasnb-ppe-philosophy', '01:730:347'),
  ('sasnb-ppe-philosophy', '01:730:358'),
  ('sasnb-ppe-philosophy', '01:730:371'),
  ('sasnb-ppe-philosophy', '01:730:441'),
  ('sasnb-ppe-philosophy', '01:730:442'),
  ('sasnb-ppe-philosophy', '01:730:445'),
  ('sasnb-ppe-philosophy', '01:730:450'),
  ('sasnb-ppe-philosophy', '01:730:459'),
  ('sasnb-ppe-philosophy', '01:730:470'),
  ('sasnb-ppe-political-theory', '01:790:101'),
  ('sasnb-ppe-political-theory', '01:790:365'),
  ('sasnb-ppe-political-theory', '01:790:371'),
  ('sasnb-ppe-political-theory', '01:790:372'),
  ('sasnb-ppe-political-theory', '01:790:373'),
  ('sasnb-ppe-political-theory', '01:790:374'),
  ('sasnb-ppe-political-theory', '01:790:375'),
  ('sasnb-ppe-political-theory', '01:790:376'),
  ('sasnb-ppe-political-theory', '01:790:472'),
  ('sasnb-ppe-political-theory', '01:790:473'),
  ('sasnb-ppe-political-theory', '01:790:477'),
  ('sasnb-ppe-political-policy', '01:790:305'),
  ('sasnb-ppe-political-policy', '01:790:318'),
  ('sasnb-ppe-political-policy', '01:790:319'),
  ('sasnb-ppe-political-policy', '01:790:320'),
  ('sasnb-ppe-political-policy', '01:790:322'),
  ('sasnb-ppe-political-policy', '01:790:323'),
  ('sasnb-ppe-political-policy', '01:790:330'),
  ('sasnb-ppe-political-policy', '01:790:333'),
  ('sasnb-ppe-political-policy', '01:790:334'),
  ('sasnb-ppe-political-policy', '01:790:335'),
  ('sasnb-ppe-political-policy', '01:790:338'),
  ('sasnb-ppe-political-policy', '01:790:350'),
  ('sasnb-ppe-political-policy', '01:790:355'),
  ('sasnb-ppe-political-policy', '01:790:358'),
  ('sasnb-ppe-political-policy', '01:790:360'),
  ('sasnb-ppe-political-policy', '01:790:363'),
  ('sasnb-ppe-political-policy', '01:790:364'),
  ('sasnb-ppe-political-policy', '01:790:386'),
  ('sasnb-ppe-political-policy', '01:790:401'),
  ('sasnb-ppe-political-policy', '01:790:404'),
  ('sasnb-ppe-economics-foundations', '01:220:102'),
  ('sasnb-ppe-economics-foundations', '01:220:103'),
  ('sasnb-ppe-economics-elective', '01:220:120'),
  ('sasnb-ppe-economics-elective', '01:220:327'),
  ('sasnb-ppe-economics-elective', '01:220:331'),
  ('sasnb-ppe-economics-elective', '01:220:390'),
  ('sasnb-ppe-economics-elective', '01:220:395'),
  ('sasnb-ppe-economics-elective', '01:220:402'),
  ('sasnb-ppe-economics-elective', '01:220:417'),
  ('sasnb-ppe-economics-elective', '01:220:432'),
  ('sasnb-ppe-economics-elective', '01:220:460'),
  ('sasnb-ppe-economics-elective', '01:220:463'),
  ('sasnb-ppe-economics-elective', '01:220:482');

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'group:' || id,
  'sasnb-ppe-minor',
  'group',
  id,
  NULL,
  'https://philosophy.rutgers.edu/minor-in-philosophy-politics-and-economics',
  'Minor in Philosophy, Politics, and Economics (PPE)',
  NULL,
  strftime('%s','now') * 1000,
  'Current department page; no catalog-year boundary stated.',
  'unreviewed'
FROM requirement_groups
WHERE program_id = 'sasnb-ppe-minor';

INSERT INTO program_requirement_evidence (
  entity_key, program_id, entity_type, group_id, course_code, source_url,
  source_title, source_catalog_year, accessed_at, reviewer_note, review_status
)
SELECT
  'course:' || requirement_courses.group_id || ':' || requirement_courses.course_code,
  'sasnb-ppe-minor',
  'course',
  requirement_courses.group_id,
  requirement_courses.course_code,
  'https://philosophy.rutgers.edu/minor-in-philosophy-politics-and-economics',
  'Minor in Philosophy, Politics, and Economics (PPE)',
  NULL,
  strftime('%s','now') * 1000,
  'Current department page; no catalog-year boundary stated.',
  'unreviewed'
FROM requirement_courses
INNER JOIN requirement_groups
  ON requirement_groups.id = requirement_courses.group_id
WHERE requirement_groups.program_id = 'sasnb-ppe-minor';

INSERT INTO requirement_raw_notes (program_id, section_name, raw_text, resolved)
VALUES
  (
    'sasnb-ppe-minor', 'Ambiguous course notation',
    '01:730:105/106 appears as slash notation on the current department page. This draft does not infer whether it represents one course, two courses, or a choice.',
    0
  ),
  (
    'sasnb-ppe-minor', 'Case-by-case Philosophy approvals',
    'The current department page permits other Philosophy courses on a case-by-case basis. No automatic mapping is available from this source.',
    0
  ),
  (
    'sasnb-ppe-minor', 'Cross-listed courses',
    'The current department page states that courses that are cross listed may be used to satisfy only one requirement, without a course map.',
    0
  ),
  (
    'sasnb-ppe-minor', 'Grade requirement',
    'The current department page requires a grade of C or better for all minor courses.',
    0
  ),
  (
    'sasnb-ppe-minor', 'Rutgers-New Brunswick residency',
    'The current department page permits only one course (three credits) in each field from outside Rutgers University-New Brunswick.',
    0
  );
