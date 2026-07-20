-- Reviewed SAS New Brunswick Sociology B.A. (program code 920).

INSERT INTO programs (
  id, name, school_slug, program_slug, type, catalog_year,
  academic_program_code, degree_type, program_family_id, source_url,
  review_status, last_scraped_at, requirement_evidence_required
) VALUES (
  'sasnb-sociology-ba', 'Sociology', 'sasnb', 'sociology', 'major',
  'Current official departmental and SAS pages', '920', 'B.A.', 'sasnb-sociology-920',
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
('sasnb-sociology-ba','https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology',NULL,'program_requirements',strftime('%s','now')*1000,'Current department requirements page; the current major is the version with five fixed courses and six electives.'),
('sasnb-sociology-ba','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/sociology','Sociology (Major, Minor) | BA',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms SAS ownership, program code 920, degree type, and the Health and Society minor restriction.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-sociology-ba';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-sociology-ba');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-sociology-ba');
DELETE FROM requirement_groups WHERE program_id='sasnb-sociology-ba';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-sociology-ba';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-sociology-ba-core','sasnb-sociology-ba',NULL,'Five required Sociology courses.','all',NULL,10,0),
('sasnb-sociology-ba-electives','sasnb-sociology-ba',NULL,'Six additional Sociology elective courses.','min_courses',6,20,0),
('sasnb-sociology-ba-upper-electives','sasnb-sociology-ba','sasnb-sociology-ba-electives','At least three additional Sociology electives at the 300 level or higher.','min_courses',3,10,0);

INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) VALUES
('sasnb-sociology-ba-core','01:920:101',NULL,'Introduction to Sociology','3'),
('sasnb-sociology-ba-core','01:920:215',NULL,'Six Great Reads: Explorations in Sociology','3'),
('sasnb-sociology-ba-core','01:920:311',NULL,'Introduction to Social Research','4'),
('sasnb-sociology-ba-core','01:920:312',NULL,'Introduction to Statistics in Sociology','4'),
('sasnb-sociology-ba-core','01:920:316',NULL,'Social Theory','4');

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-sociology-ba-electives','sasnb-sociology-ba-electives','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["920"],"course_number_min":100,"course_number_max":499,"minimum_credits":3,"exclude_course_codes":["01:920:101","01:920:215","01:920:311","01:920:312","01:920:316"],"label":"Additional Sociology courses worth at least three credits"}','https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology','reviewed',strftime('%s','now')*1000),
('sasnb-sociology-ba-upper-electives','sasnb-sociology-ba-upper-electives','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["920"],"course_number_min":300,"course_number_max":499,"minimum_credits":3,"exclude_course_codes":["01:920:101","01:920:215","01:920:311","01:920:312","01:920:316"],"label":"Additional 300- or 400-level Sociology courses worth at least three credits"}','https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-sociology-ba','group',id,NULL,'https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology',NULL,strftime('%s','now')*1000,'Current Sociology major requirement.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-sociology-ba';
INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'course:'||group_id||':'||course_code,'sasnb-sociology-ba','course',group_id,course_code,'https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','Major or Minor in Sociology',NULL,strftime('%s','now')*1000,'Current Sociology major fixed-course requirement.','reviewed'
FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-sociology-ba');

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-sociology-ba-academic-review','sasnb-sociology-ba','advisor_confirmation','{"topics":["major declaration requires 01:920:101 and one of 01:920:311, 312, 313, 314, 316, or 215 with grades of C or better","three any-level elective courses must be in different thematic categories","only courses with a C grade or higher count toward the major","at least six courses (21 credits) at Rutgers-New Brunswick","no more than 6 independent-study credits and no more than 3 Citizenship and Service Education credits may apply"]}','requires_approval','Confirm declaration, thematic-category, grade, Rutgers-New Brunswick residency, and limited independent-study/Citizenship and Service Education credit rules with Sociology advising before relying on this plan.','https://sociology.rutgers.edu/academics/undergraduate/major-or-minor-in-sociology','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;

INSERT INTO program_combination_policies (policy_key,home_school_slug,program_a_id,program_a_school_slug,program_a_type,program_b_id,program_b_school_slug,program_b_type,same_program_family,decision,note,source_url,verified_at)
VALUES ('sasnb-sociology-major-no-health-and-society-minor','sasnb','sasnb-sociology-ba',NULL,NULL,'sasnb-health-and-society-minor',NULL,NULL,0,'blocked','Sociology (920) majors may not minor in Health and Society (502).','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/sociology',strftime('%s','now')*1000)
ON CONFLICT(policy_key) DO UPDATE SET home_school_slug=excluded.home_school_slug,program_a_id=excluded.program_a_id,program_a_school_slug=excluded.program_a_school_slug,program_a_type=excluded.program_a_type,program_b_id=excluded.program_b_id,program_b_school_slug=excluded.program_b_school_slug,program_b_type=excluded.program_b_type,same_program_family=excluded.same_program_family,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,verified_at=excluded.verified_at;
