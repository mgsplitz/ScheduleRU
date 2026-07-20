-- Reviewed SAS New Brunswick Statistics minor (program code 960).

INSERT INTO programs (id,name,school_slug,program_slug,type,catalog_year,academic_program_code,degree_type,program_family_id,source_url,review_status,last_scraped_at,requirement_evidence_required)
VALUES ('sasnb-statistics-minor','Statistics','sasnb','statistics-minor','minor','Current official page','960',NULL,'sasnb-statistics-960','https://statistics.rutgers.edu/minor','reviewed',strftime('%s','now')*1000,1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-statistics-minor','https://statistics.rutgers.edu/minor','Statistics Minor',NULL,'program_requirements',strftime('%s','now')*1000,'Current department requirements page; no catalog-year boundary stated.'),
('sasnb-statistics-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/statistics','Statistics (Major, Minor) | BA',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms program code 960 and the Statistics major/minor family.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-statistics-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-statistics-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-statistics-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-statistics-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-statistics-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-statistics-minor-required','sasnb-statistics-minor',NULL,'One required Statistics course.','min_courses',1,10,0),
('sasnb-statistics-minor-additional','sasnb-statistics-minor',NULL,'Six additional approved Statistics courses.','min_courses',6,20,0),
('sasnb-statistics-minor-advanced','sasnb-statistics-minor','sasnb-statistics-minor-additional','At least three of the additional courses from the approved advanced list.','min_courses',3,10,0);

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-statistics-minor-required','sasnb-statistics-minor-required-courses','{"version":1,"kind":"course_codes","include_course_codes":["01:960:295","01:960:390"],"label":"01:960:295 or 01:960:390"}','https://statistics.rutgers.edu/minor','Statistics Minor','reviewed',strftime('%s','now')*1000),
('sasnb-statistics-minor-additional','sasnb-statistics-minor-statistics-courses','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["960"],"course_number_min":100,"course_number_max":499,"exclude_course_codes":["01:960:295","01:960:390"],"label":"Additional Statistics courses, excluding the required 01:960:295/390 choice"}','https://statistics.rutgers.edu/minor','Statistics Minor','reviewed',strftime('%s','now')*1000),
('sasnb-statistics-minor-additional','sasnb-statistics-minor-approved-outside-courses','{"version":1,"kind":"course_codes","include_course_codes":["01:198:142","01:640:477","01:640:481"],"label":"Additional approved Computer Science or Mathematics course"}','https://statistics.rutgers.edu/minor','Statistics Minor','reviewed',strftime('%s','now')*1000),
('sasnb-statistics-minor-advanced','sasnb-statistics-minor-advanced-statistics','{"version":1,"kind":"course_codes","include_course_codes":["01:960:365","01:960:381","01:960:382","01:960:463","01:960:467","01:960:476","01:960:483","01:960:486","01:960:490"],"label":"Approved advanced Statistics course"}','https://statistics.rutgers.edu/minor','Statistics Minor','reviewed',strftime('%s','now')*1000),
('sasnb-statistics-minor-advanced','sasnb-statistics-minor-advanced-mathematics','{"version":1,"kind":"course_codes","include_course_codes":["01:640:477","01:640:481"],"label":"Approved advanced Mathematics course"}','https://statistics.rutgers.edu/minor','Statistics Minor','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-statistics-minor','group',id,NULL,'https://statistics.rutgers.edu/minor','Statistics Minor',NULL,strftime('%s','now')*1000,'Current official Statistics minor requirement.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-statistics-minor';

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-statistics-minor-academic-review','sasnb-statistics-minor','advisor_confirmation','{"topics":["no one course can fulfill two Statistics minor requirements","at most two D grades toward the minor"]}','requires_approval','Confirm the published course-allocation and grade rules with Statistics advising before relying on this plan.','https://statistics.rutgers.edu/minor','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
