-- Reviewed SAS New Brunswick Developmental Psychology minor (program code 835).

INSERT INTO programs (id,name,school_slug,program_slug,type,catalog_year,academic_program_code,degree_type,program_family_id,source_url,review_status,last_scraped_at,requirement_evidence_required)
VALUES ('sasnb-developmental-psychology-minor','Developmental Psychology','sasnb','developmental-psychology','minor','Current official departmental and SAS pages','835',NULL,'sasnb-developmental-psychology-835','https://psych.rutgers.edu/academics/undergraduate/major','reviewed',strftime('%s','now')*1000,1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-developmental-psychology-minor','https://psych.rutgers.edu/academics/undergraduate/major','Psychology Requirements',NULL,'program_requirements',strftime('%s','now')*1000,'Current department page includes the Developmental Psychology minor requirements and elective list.'),
('sasnb-developmental-psychology-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/developmental-psychology','Developmental Psychology (Minor)',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms SAS ownership, program code 835, and Psychology incompatibility.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-developmental-psychology-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-developmental-psychology-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-developmental-psychology-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-developmental-psychology-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-developmental-psychology-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-developmental-psychology-minor-core','sasnb-developmental-psychology-minor',NULL,'Required Psychology foundations.','all',NULL,10,0),
('sasnb-developmental-psychology-minor-electives','sasnb-developmental-psychology-minor',NULL,'Four approved Developmental Psychology electives.','min_courses',4,20,0),
('sasnb-developmental-psychology-minor-fieldwork-limit','sasnb-developmental-psychology-minor','sasnb-developmental-psychology-minor-electives','At most one Developmental Psychology fieldwork course.','max_courses',1,10,0);

INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) VALUES
('sasnb-developmental-psychology-minor-core','01:830:101',NULL,'General Psychology','3'),
('sasnb-developmental-psychology-minor-core','01:830:271',NULL,'Principles of Developmental Psychology','3');

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-developmental-psychology-minor-electives','sasnb-developmental-psychology-minor-developmental-electives','{"version":1,"kind":"course_codes","include_course_codes":["01:830:331","01:830:333","01:830:335","01:830:346","01:830:361","01:830:394","01:830:431","01:830:432","01:830:484"],"label":"Approved Developmental Psychology elective"}','https://psych.rutgers.edu/academics/undergraduate/major','Psychology Requirements','reviewed',strftime('%s','now')*1000),
('sasnb-developmental-psychology-minor-electives','sasnb-developmental-psychology-minor-fieldwork','{"version":1,"kind":"course_codes","include_course_codes":["01:830:380","01:830:381","01:830:382","01:830:383","01:830:388","01:830:389"],"label":"Approved Developmental Psychology fieldwork course"}','https://psych.rutgers.edu/academics/undergraduate/major','Psychology Requirements','reviewed',strftime('%s','now')*1000),
('sasnb-developmental-psychology-minor-fieldwork-limit','sasnb-developmental-psychology-minor-fieldwork-limit','{"version":1,"kind":"course_codes","include_course_codes":["01:830:380","01:830:381","01:830:382","01:830:383","01:830:388","01:830:389"],"label":"Developmental Psychology fieldwork course"}','https://psych.rutgers.edu/academics/undergraduate/major','Psychology Requirements','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-developmental-psychology-minor','group',id,NULL,'https://psych.rutgers.edu/academics/undergraduate/major','Psychology Requirements',NULL,strftime('%s','now')*1000,'Current Developmental Psychology minor requirement.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-developmental-psychology-minor';
INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'course:'||group_id||':'||course_code,'sasnb-developmental-psychology-minor','course',group_id,course_code,'https://psych.rutgers.edu/academics/undergraduate/major','Psychology Requirements',NULL,strftime('%s','now')*1000,'Current Developmental Psychology minor fixed-course requirement.','reviewed'
FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-developmental-psychology-minor');

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-developmental-psychology-minor-academic-review','sasnb-developmental-psychology-minor','advisor_confirmation','{"topics":["General Psychology requires a grade of C or better and all 01:830 courses require a 2.0 overall GPA","at least three of the six courses must be taken in the Rutgers-New Brunswick Psychology program","county or community-college transfer work is limited to General Psychology and Principles of Developmental Psychology","official cross-listed courses and approved transfer work require advising review"]}','requires_approval','Confirm grade, GPA, residency, transfer, and cross-listing rules with Psychology advising before relying on this plan.','https://psych.rutgers.edu/academics/undergraduate/major','reviewed',strftime('%s','now')*1000),
('sasnb-developmental-psychology-minor-no-psychology','sasnb-developmental-psychology-minor','selected_program_must_not_include_any','["sasnb-psychology-minor","sasnb-psychology-major"]','blocked','Developmental Psychology minors may not also major or minor in Psychology.','https://psych.rutgers.edu/academics/undergraduate/major','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
