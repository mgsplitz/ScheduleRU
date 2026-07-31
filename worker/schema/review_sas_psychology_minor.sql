-- Reviewed SAS New Brunswick Psychology minor (program code 830).

INSERT INTO programs (id,name,school_slug,program_slug,type,catalog_year,academic_program_code,degree_type,program_family_id,source_url,review_status,last_scraped_at,requirement_evidence_required)
VALUES ('sasnb-psychology-minor','Psychology','sasnb','psychology-minor','minor','Current official departmental and SAS pages','830',NULL,'sasnb-psychology-830','https://psych.rutgers.edu/academics/undergraduate/major','reviewed',strftime('%s','now')*1000,1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-psychology-minor','https://psych.rutgers.edu/academics/undergraduate/major','Psychology Requirements',NULL,'program_requirements',strftime('%s','now')*1000,'Current department page includes the Psychology and Developmental Psychology minor requirements.'),
('sasnb-psychology-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/psychology','Psychology (Major, Minor) | BA',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms SAS ownership, program code 830, and no minor declaration requirement.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-psychology-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-psychology-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-psychology-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-psychology-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-psychology-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-psychology-minor-intro','sasnb-psychology-minor',NULL,'General Psychology.','all',NULL,10,0),
('sasnb-psychology-minor-electives','sasnb-psychology-minor',NULL,'Five additional Psychology courses worth at least three credits each.','min_courses',5,20,0),
('sasnb-psychology-minor-200-limit','sasnb-psychology-minor','sasnb-psychology-minor-electives','No more than two additional Psychology courses at the 200 level.','max_courses',2,10,0);

INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) VALUES
('sasnb-psychology-minor-intro','01:830:101',NULL,'General Psychology','3');

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-psychology-minor-electives','sasnb-psychology-minor-electives','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["830"],"course_number_min":100,"course_number_max":499,"minimum_credits":3,"exclude_course_codes":["01:830:101"],"label":"Additional Rutgers-New Brunswick Psychology course worth at least three credits"}','https://psych.rutgers.edu/academics/undergraduate/major','Psychology Requirements','reviewed',strftime('%s','now')*1000),
('sasnb-psychology-minor-200-limit','sasnb-psychology-minor-200-courses','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["830"],"course_number_min":200,"course_number_max":299,"minimum_credits":3,"exclude_course_codes":["01:830:101"],"label":"200-level Psychology course counted among the additional courses"}','https://psych.rutgers.edu/academics/undergraduate/major','Psychology Requirements','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-psychology-minor','group',id,NULL,'https://psych.rutgers.edu/academics/undergraduate/major','Psychology Requirements',NULL,strftime('%s','now')*1000,'Current Psychology minor requirement.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-psychology-minor';
INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'course:'||group_id||':'||course_code,'sasnb-psychology-minor','course',group_id,course_code,'https://psych.rutgers.edu/academics/undergraduate/major','Psychology Requirements',NULL,strftime('%s','now')*1000,'Current Psychology minor fixed-course requirement.','reviewed'
FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-psychology-minor');

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-psychology-minor-academic-review','sasnb-psychology-minor','advisor_confirmation','{"topics":["General Psychology requires a grade of C or better and all 01:830 courses require a 2.0 overall GPA","at least three of the six courses must be taken in the Rutgers-New Brunswick Psychology program","county or community-college transfer work is limited to General Psychology and two additional electives","no more than one experiential course may count","official cross-listed courses and approved transfer work require advising review"]}','requires_approval','Confirm grade, GPA, residency, transfer, experiential-course, and cross-listing rules with Psychology advising before relying on this plan.','https://psych.rutgers.edu/academics/undergraduate/major','reviewed',strftime('%s','now')*1000),
('sasnb-psychology-minor-no-developmental-psychology','sasnb-psychology-minor','selected_program_must_not_include_any','["sasnb-developmental-psychology-minor"]','blocked','Psychology and Developmental Psychology minors may not both be selected.','https://psych.rutgers.edu/academics/undergraduate/major','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
