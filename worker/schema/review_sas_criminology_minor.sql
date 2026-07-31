-- Reviewed SAS New Brunswick Criminology minor (program code 204).

INSERT INTO programs (id,name,school_slug,program_slug,type,catalog_year,academic_program_code,degree_type,program_family_id,source_url,review_status,last_scraped_at,requirement_evidence_required)
VALUES ('sasnb-criminology-minor','Criminology','sasnb','criminology','minor','Current official page','204',NULL,'sasnb-criminology-204','https://sociology.rutgers.edu/images/stories/stories/pdfs/Criminology_Minor_Requirement_form1.pdf','reviewed',strftime('%s','now')*1000,1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-criminology-minor','https://sociology.rutgers.edu/images/stories/stories/pdfs/Criminology_Minor_Requirement_form1.pdf','Criminology Minor Requirements',NULL,'program_requirements',strftime('%s','now')*1000,'Current departmental checklist; no catalog-year boundary stated.'),
('sasnb-criminology-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/criminology','Criminology (Minor)',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms program code 204 and the Criminal Justice incompatibility.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-criminology-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-criminology-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-criminology-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-criminology-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-criminology-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-criminology-minor-core','sasnb-criminology-minor',NULL,'Six required Criminology courses.','all',NULL,10,0),
('sasnb-criminology-minor-sociology-elective','sasnb-criminology-minor',NULL,'One approved Sociology elective.','min_courses',1,20,0),
('sasnb-criminology-minor-criminal-justice-elective','sasnb-criminology-minor',NULL,'One other three-credit Criminal Justice elective.','min_courses',1,30,0);

INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) VALUES
('sasnb-criminology-minor-core','01:202:201',NULL,'Introduction to Criminal Justice','3'),
('sasnb-criminology-minor-core','01:830:101',NULL,'Introduction to Psychology','3'),
('sasnb-criminology-minor-core','01:830:340',NULL,'Abnormal Psychology','3'),
('sasnb-criminology-minor-core','01:920:101',NULL,'Introduction to Sociology','3'),
('sasnb-criminology-minor-core','01:920:222',NULL,'Criminology','3'),
('sasnb-criminology-minor-core','01:920:306',NULL,'Race Relations','3'),
('sasnb-criminology-minor-sociology-elective','01:920:304',NULL,'Sociology of Deviant Behavior','3'),
('sasnb-criminology-minor-sociology-elective','01:920:307',NULL,'Sociology of Mental Illness','3'),
('sasnb-criminology-minor-sociology-elective','01:920:349',NULL,'Law and Society','3');

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-criminology-minor-criminal-justice-elective','sasnb-criminology-minor-criminal-justice-elective','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["202"],"course_number_min":100,"course_number_max":499,"minimum_credits":3,"exclude_course_codes":["01:202:201"],"label":"Another three-credit Criminal Justice course"}','https://sociology.rutgers.edu/images/stories/stories/pdfs/Criminology_Minor_Requirement_form1.pdf','Criminology Minor Requirements','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-criminology-minor','group',id,NULL,'https://sociology.rutgers.edu/images/stories/stories/pdfs/Criminology_Minor_Requirement_form1.pdf','Criminology Minor Requirements',NULL,strftime('%s','now')*1000,'Current official Criminology minor requirement.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-criminology-minor';
INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'course:'||group_id||':'||course_code,'sasnb-criminology-minor','course',group_id,course_code,'https://sociology.rutgers.edu/images/stories/stories/pdfs/Criminology_Minor_Requirement_form1.pdf','Criminology Minor Requirements',NULL,strftime('%s','now')*1000,'Current official Criminology minor requirement.','reviewed'
FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-criminology-minor');

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-criminology-minor-academic-review','sasnb-criminology-minor','advisor_confirmation','{"topics":["grade of C or better in each course toward the minor"]}','requires_approval','Confirm the published grade requirement with Criminology advising before relying on this plan.','https://sociology.rutgers.edu/images/stories/stories/pdfs/Criminology_Minor_Requirement_form1.pdf','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;

INSERT INTO program_combination_policies (policy_key,home_school_slug,program_a_id,program_a_school_slug,program_a_type,program_b_id,program_b_school_slug,program_b_type,same_program_family,decision,note,source_url,verified_at)
VALUES ('sasnb-criminal-justice-major-no-criminology-minor','sasnb','sasnb-criminal-justice-major',NULL,NULL,'sasnb-criminology-minor',NULL,NULL,0,'blocked','Criminal Justice (202) majors may not minor in Criminology (204).','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/criminology',strftime('%s','now')*1000)
ON CONFLICT(policy_key) DO UPDATE SET home_school_slug=excluded.home_school_slug,program_a_id=excluded.program_a_id,program_a_school_slug=excluded.program_a_school_slug,program_a_type=excluded.program_a_type,program_b_id=excluded.program_b_id,program_b_school_slug=excluded.program_b_school_slug,program_b_type=excluded.program_b_type,same_program_family=excluded.same_program_family,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,verified_at=excluded.verified_at;
