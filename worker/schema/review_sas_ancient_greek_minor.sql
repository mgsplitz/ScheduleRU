-- Reviewed SAS New Brunswick Ancient Greek minor (program code 491; subject 490).

INSERT INTO programs (id,name,school_slug,program_slug,type,catalog_year,academic_program_code,degree_type,program_family_id,source_url,review_status,last_scraped_at,requirement_evidence_required)
VALUES ('sasnb-ancient-greek-minor','Greek - Ancient','sasnb','ancient-greek-minor','minor','Current official departmental and SAS pages','491',NULL,'sasnb-ancient-greek-491','https://classics.rutgers.edu/academics/undergraduate/majors-minors','reviewed',strftime('%s','now')*1000,1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-ancient-greek-minor','https://classics.rutgers.edu/academics/undergraduate/majors-minors','Classics Majors & Minors',NULL,'program_requirements',strftime('%s','now')*1000,'Current Classics department minor requirements page.'),
('sasnb-ancient-greek-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/list-of-majors-and-minors','SAS Majors and Minors',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS list confirms Ancient Greek is an SAS minor.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-ancient-greek-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-ancient-greek-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-ancient-greek-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-ancient-greek-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-ancient-greek-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-ancient-greek-minor-total','sasnb-ancient-greek-minor',NULL,'Six Ancient Greek language courses.','min_courses',6,10,0),
('sasnb-ancient-greek-minor-upper-level','sasnb-ancient-greek-minor','sasnb-ancient-greek-minor-total','At least three Ancient Greek language courses at the 300 level or higher.','min_courses',3,10,0);

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-ancient-greek-minor-total','sasnb-ancient-greek-minor-courses','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["490"],"course_number_min":100,"course_number_max":499,"label":"Rutgers-New Brunswick Ancient Greek course"}','https://classics.rutgers.edu/academics/undergraduate/majors-minors','Classics Majors & Minors','reviewed',strftime('%s','now')*1000),
('sasnb-ancient-greek-minor-upper-level','sasnb-ancient-greek-minor-upper-courses','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["490"],"course_number_min":300,"course_number_max":499,"label":"300- or 400-level Rutgers-New Brunswick Ancient Greek course"}','https://classics.rutgers.edu/academics/undergraduate/majors-minors','Classics Majors & Minors','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-ancient-greek-minor','group',id,NULL,'https://classics.rutgers.edu/academics/undergraduate/majors-minors','Classics Majors & Minors',NULL,strftime('%s','now')*1000,'Current Ancient Greek minor requirement.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-ancient-greek-minor';

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-ancient-greek-minor-academic-review','sasnb-ancient-greek-minor','advisor_confirmation','{"topics":["a grade of C or better is required for every course counted toward the minor"]}','requires_approval','Confirm the published course-grade rule with Classics advising before relying on this plan.','https://classics.rutgers.edu/academics/undergraduate/majors-minors','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
