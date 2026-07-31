-- Reviewed SAS New Brunswick Sociology minor (program code 920).

INSERT INTO programs (
  id, name, school_slug, program_slug, type, catalog_year,
  academic_program_code, degree_type, program_family_id, source_url,
  review_status, last_scraped_at, requirement_evidence_required
) VALUES (
  'sasnb-sociology-minor', 'Sociology', 'sasnb', 'sociology-minor', 'minor',
  'Current official departmental and SAS pages', '920', NULL, 'sasnb-sociology-920',
  'https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology',
  'reviewed', strftime('%s','now') * 1000, 1
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name, school_slug=excluded.school_slug, program_slug=excluded.program_slug,
  type=excluded.type, catalog_year=excluded.catalog_year, academic_program_code=excluded.academic_program_code,
  degree_type=excluded.degree_type, program_family_id=excluded.program_family_id, source_url=excluded.source_url,
  review_status=excluded.review_status, last_scraped_at=excluded.last_scraped_at,
  requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-sociology-minor','https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology',NULL,'program_requirements',strftime('%s','now')*1000,'Current department minor requirements page.'),
('sasnb-sociology-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/sociology','Sociology (Major, Minor) | BA',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms the Sociology program family and Criminal Justice course-counting restriction.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-sociology-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-sociology-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-sociology-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-sociology-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-sociology-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-sociology-minor-intro','sasnb-sociology-minor',NULL,'Introduction to Sociology.','all',NULL,10,0),
('sasnb-sociology-minor-method-or-theory','sasnb-sociology-minor',NULL,'One required Sociology research, statistics, or theory course.','one_of',NULL,20,0),
('sasnb-sociology-minor-method-311','sasnb-sociology-minor','sasnb-sociology-minor-method-or-theory','Introduction to Social Research.','all',NULL,10,0),
('sasnb-sociology-minor-method-312','sasnb-sociology-minor','sasnb-sociology-minor-method-or-theory','Introduction to Statistics in Sociology.','all',NULL,20,0),
('sasnb-sociology-minor-method-316','sasnb-sociology-minor','sasnb-sociology-minor-method-or-theory','Social Theory.','all',NULL,30,0),
('sasnb-sociology-minor-electives','sasnb-sociology-minor',NULL,'Four additional Sociology elective courses.','min_courses',4,30,0),
('sasnb-sociology-minor-electives-200','sasnb-sociology-minor','sasnb-sociology-minor-electives','At least one additional Sociology elective at the 200 level or higher.','min_courses',1,10,0),
('sasnb-sociology-minor-electives-300','sasnb-sociology-minor','sasnb-sociology-minor-electives','At least one additional Sociology elective at the 300 level or higher.','min_courses',1,20,0),
('sasnb-sociology-minor-electives-315','sasnb-sociology-minor','sasnb-sociology-minor-electives','At least one additional Sociology elective numbered 315 or higher.','min_courses',1,30,0);

INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) VALUES
('sasnb-sociology-minor-intro','01:920:101',NULL,'Introduction to Sociology','3'),
('sasnb-sociology-minor-method-311','01:920:311',NULL,'Introduction to Social Research','4'),
('sasnb-sociology-minor-method-312','01:920:312',NULL,'Introduction to Statistics in Sociology','4'),
('sasnb-sociology-minor-method-316','01:920:316',NULL,'Social Theory','4');

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-sociology-minor-electives','sasnb-sociology-minor-electives','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["920"],"course_number_min":100,"course_number_max":499,"minimum_credits":3,"exclude_course_codes":["01:920:101","01:920:311","01:920:312","01:920:316"],"label":"Additional Sociology courses worth at least three credits"}','https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology','reviewed',strftime('%s','now')*1000),
('sasnb-sociology-minor-electives-200','sasnb-sociology-minor-electives-200','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["920"],"course_number_min":200,"course_number_max":499,"minimum_credits":3,"exclude_course_codes":["01:920:101","01:920:311","01:920:312","01:920:316"],"label":"Additional 200-level-or-higher Sociology course worth at least three credits"}','https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology','reviewed',strftime('%s','now')*1000),
('sasnb-sociology-minor-electives-300','sasnb-sociology-minor-electives-300','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["920"],"course_number_min":300,"course_number_max":499,"minimum_credits":3,"exclude_course_codes":["01:920:101","01:920:311","01:920:312","01:920:316"],"label":"Additional 300-level-or-higher Sociology course worth at least three credits"}','https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology','reviewed',strftime('%s','now')*1000),
('sasnb-sociology-minor-electives-315','sasnb-sociology-minor-electives-315','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["920"],"course_number_min":315,"course_number_max":499,"minimum_credits":3,"exclude_course_codes":["01:920:101","01:920:311","01:920:312","01:920:316"],"label":"Additional Sociology course numbered 315 or higher and worth at least three credits"}','https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-sociology-minor','group',id,NULL,'https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology',NULL,strftime('%s','now')*1000,'Current Sociology minor requirement.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-sociology-minor';
INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'course:'||group_id||':'||course_code,'sasnb-sociology-minor','course',group_id,course_code,'https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology',NULL,strftime('%s','now')*1000,'Current Sociology minor fixed-course requirement.','reviewed'
FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-sociology-minor');

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-sociology-minor-academic-review','sasnb-sociology-minor','advisor_confirmation','{"topics":["only courses with a C+ grade or higher count toward the minor","at least three courses (10 credits) at Rutgers-New Brunswick","no more than 3 credits of Citizenship and Service Education may apply"]}','requires_approval','Confirm the C+ minimum grade, Rutgers-New Brunswick residency, and Citizenship and Service Education limits with Sociology advising before relying on this plan.', 'https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','reviewed',strftime('%s','now')*1000),
('sasnb-criminal-justice-major-sociology-minor-criminology-exclusion','sasnb-sociology-minor','advisor_confirmation','{"topics":["Criminal Justice majors may not use 01:920:222 Criminology toward the Sociology minor"]}','requires_approval','If you are also a Criminal Justice major, confirm that 01:920:222 Criminology is not being applied to this Sociology minor.', 'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/sociology','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
