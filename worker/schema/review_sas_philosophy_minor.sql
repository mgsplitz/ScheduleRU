-- Reviewed SAS New Brunswick Philosophy minor (program code 730).

INSERT INTO programs (id,name,school_slug,program_slug,type,catalog_year,academic_program_code,degree_type,program_family_id,source_url,review_status,last_scraped_at,requirement_evidence_required)
VALUES ('sasnb-philosophy-minor','Philosophy','sasnb','philosophy-minor','minor','Current official page','730',NULL,'sasnb-philosophy-730','https://philosophy.rutgers.edu/minor','reviewed',strftime('%s','now')*1000,1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-philosophy-minor','https://philosophy.rutgers.edu/minor','Philosophy Minor',NULL,'program_requirements',strftime('%s','now')*1000,'Current department requirements page; no catalog-year boundary stated.'),
('sasnb-philosophy-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/philosophy','Philosophy (Major, Minor) | BA',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms program code 730 and the Philosophy major/minor family.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-philosophy-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-philosophy-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-philosophy-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-philosophy-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-philosophy-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-philosophy-minor-total','sasnb-philosophy-minor',NULL,'Six Philosophy courses of at least three credits.','min_courses',6,10,0),
('sasnb-philosophy-minor-upper-level','sasnb-philosophy-minor','sasnb-philosophy-minor-total','At least three Philosophy courses at the 300 or 400 level.','min_courses',3,10,0);

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-philosophy-minor-total','sasnb-philosophy-minor-courses','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["730"],"course_number_min":100,"course_number_max":499,"minimum_credits":3,"label":"Philosophy courses numbered 100-499 and worth at least three credits"}','https://philosophy.rutgers.edu/minor','Philosophy Minor','reviewed',strftime('%s','now')*1000),
('sasnb-philosophy-minor-upper-level','sasnb-philosophy-minor-upper-level-courses','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["730"],"course_number_min":300,"course_number_max":499,"minimum_credits":3,"label":"300- and 400-level Philosophy courses worth at least three credits"}','https://philosophy.rutgers.edu/minor','Philosophy Minor','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-philosophy-minor','group',id,NULL,'https://philosophy.rutgers.edu/minor','Philosophy Minor',NULL,strftime('%s','now')*1000,'Current official Philosophy minor requirement.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-philosophy-minor';

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-philosophy-minor-academic-review','sasnb-philosophy-minor','advisor_confirmation','{"topics":["no more than two transfer courses toward the minor","no more than one D toward the minor"]}','requires_approval','Confirm transfer-credit and grade decisions with Philosophy advising before relying on this plan.','https://philosophy.rutgers.edu/minor','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
