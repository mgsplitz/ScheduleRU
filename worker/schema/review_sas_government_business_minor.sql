-- Reviewed SAS New Brunswick Government and Business minor (program code 793).

INSERT INTO programs (
  id,name,school_slug,program_slug,type,catalog_year,
  academic_program_code,degree_type,program_family_id,source_url,
  review_status,last_scraped_at,requirement_evidence_required
) VALUES (
  'sasnb-government-business-minor','Government and Business','sasnb','government-and-business','minor','Current official departmental and SAS pages',
  '793',NULL,'sasnb-government-business-793','https://polisci.rutgers.edu/academics/undergraduate/minors-in-political-science/minor-in-government-and-business',
  'reviewed',strftime('%s','now')*1000,1
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,
  academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,
  source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,
  requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-government-business-minor','https://polisci.rutgers.edu/academics/undergraduate/minors-in-political-science/minor-in-government-and-business','Minor in Government and Business',NULL,'program_requirements',strftime('%s','now')*1000,'Current department requirements page with the fixed courses and reviewed elective list.'),
('sasnb-government-business-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/government-and-business','Government and Business (Minor)',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms SAS ownership, program code 793, and published program restrictions.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-government-business-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-government-business-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-government-business-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-government-business-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-government-business-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-government-business-minor-core','sasnb-government-business-minor',NULL,'Required Government and Business courses.','all',NULL,10,0),
('sasnb-government-business-minor-electives','sasnb-government-business-minor',NULL,'Four approved Government and Business electives.','min_courses',4,20,0),
('sasnb-government-business-minor-upper-electives','sasnb-government-business-minor','sasnb-government-business-minor-electives','At least three approved electives at the 300 level or higher.','min_courses',3,10,0);

INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) VALUES
('sasnb-government-business-minor-core','01:790:101',NULL,'Nature of Politics','3'),
('sasnb-government-business-minor-core','01:790:338',NULL,'Government and Business','3');

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-government-business-minor-electives','sasnb-government-business-minor-electives','{"version":1,"kind":"course_codes","include_course_codes":["01:790:102","01:790:103","01:790:104","01:790:106","01:790:304","01:790:305","01:790:306","01:790:308","01:790:318","01:790:320","01:790:327","01:790:330","01:790:332","01:790:335","01:790:341","01:790:347","01:790:350","01:790:356","01:790:357","01:790:362","01:790:481","01:790:482","01:790:488"],"label":"Approved Government and Business elective"}','https://polisci.rutgers.edu/academics/undergraduate/minors-in-political-science/minor-in-government-and-business','Minor in Government and Business','reviewed',strftime('%s','now')*1000),
('sasnb-government-business-minor-upper-electives','sasnb-government-business-minor-upper-electives','{"version":1,"kind":"course_codes","include_course_codes":["01:790:304","01:790:305","01:790:306","01:790:308","01:790:318","01:790:320","01:790:327","01:790:330","01:790:332","01:790:335","01:790:341","01:790:347","01:790:350","01:790:356","01:790:357","01:790:362","01:790:481","01:790:482","01:790:488"],"label":"Approved 300- or 400-level Government and Business elective"}','https://polisci.rutgers.edu/academics/undergraduate/minors-in-political-science/minor-in-government-and-business','Minor in Government and Business','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-government-business-minor','group',id,NULL,'https://polisci.rutgers.edu/academics/undergraduate/minors-in-political-science/minor-in-government-and-business','Minor in Government and Business',NULL,strftime('%s','now')*1000,'Current Government and Business minor requirement.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-government-business-minor';
INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'course:'||group_id||':'||course_code,'sasnb-government-business-minor','course',group_id,course_code,'https://polisci.rutgers.edu/academics/undergraduate/minors-in-political-science/minor-in-government-and-business','Minor in Government and Business',NULL,strftime('%s','now')*1000,'Current Government and Business minor fixed-course requirement.','reviewed'
FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-government-business-minor');

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-government-business-minor-academic-review','sasnb-government-business-minor','advisor_confirmation','{"topics":["Rutgers Business School students must complete the departmental RBS declaration process","additional courses beyond the published approved list require undergraduate-program-director permission"]}','requires_approval','Confirm any RBS declaration step and any requested course outside the published elective list with Political Science advising before relying on this plan.','https://polisci.rutgers.edu/academics/undergraduate/minors-in-political-science/minor-in-government-and-business','reviewed',strftime('%s','now')*1000)
,
('sasnb-government-business-minor-no-political-science','sasnb-government-business-minor','selected_program_must_not_include_any','["sasnb-political-science-minor"]','blocked','Government and Business minors may not also minor in Political Science.','https://polisci.rutgers.edu/academics/undergraduate/minors-in-political-science/minor-in-government-and-business','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;

INSERT INTO program_combination_policies (policy_key,home_school_slug,program_a_id,program_a_school_slug,program_a_type,program_b_id,program_b_school_slug,program_b_type,same_program_family,decision,note,source_url,verified_at)
VALUES ('sasnb-government-business-no-political-science','sasnb','sasnb-government-business-minor',NULL,NULL,'sasnb-political-science-minor',NULL,NULL,0,'blocked','Government and Business minors may not double minor in Political Science.','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/government-and-business',strftime('%s','now')*1000)
ON CONFLICT(policy_key) DO UPDATE SET home_school_slug=excluded.home_school_slug,program_a_id=excluded.program_a_id,program_a_school_slug=excluded.program_a_school_slug,program_a_type=excluded.program_a_type,program_b_id=excluded.program_b_id,program_b_school_slug=excluded.program_b_school_slug,program_b_type=excluded.program_b_type,same_program_family=excluded.same_program_family,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,verified_at=excluded.verified_at;
