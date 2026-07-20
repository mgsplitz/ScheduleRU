-- Reviewed SAS New Brunswick Art History minor (program code 082).

INSERT INTO programs (id,name,school_slug,program_slug,type,catalog_year,academic_program_code,degree_type,program_family_id,source_url,review_status,last_scraped_at,requirement_evidence_required)
VALUES ('sasnb-art-history-minor','Art History','sasnb','art-history-minor','minor','Current official departmental and SAS pages','082',NULL,'sasnb-art-history-082','https://arthistory.rutgers.edu/academics/undergraduate-welcome/minor-requirements','reviewed',strftime('%s','now')*1000,1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-art-history-minor','https://arthistory.rutgers.edu/academics/undergraduate-welcome/minor-requirements','Art History Minor Requirements',NULL,'program_requirements',strftime('%s','now')*1000,'Current department minor requirements page.'),
('sasnb-art-history-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/art-history','Art History (Major, Minor) | BA',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms SAS ownership, program code 082, and no minor declaration requirement.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-art-history-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-art-history-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-art-history-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-art-history-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-art-history-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-art-history-minor-introductions','sasnb-art-history-minor',NULL,'Two Art History introduction courses.','min_courses',2,10,0),
('sasnb-art-history-minor-upper-level','sasnb-art-history-minor',NULL,'Four additional Art History courses at the 200 level or higher.','min_courses',4,20,0);

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-art-history-minor-introductions','sasnb-art-history-minor-introductions','{"version":1,"kind":"course_codes","include_course_codes":["01:082:105","01:082:106","01:082:107"],"label":"01:082:105, 106, or 107 Art History introduction"}','https://arthistory.rutgers.edu/academics/undergraduate-welcome/minor-requirements','Art History Minor Requirements','reviewed',strftime('%s','now')*1000),
('sasnb-art-history-minor-upper-level','sasnb-art-history-minor-upper-level','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["082"],"course_number_min":200,"course_number_max":499,"label":"Art History course numbered 200-499"}','https://arthistory.rutgers.edu/academics/undergraduate-welcome/minor-requirements','Art History Minor Requirements','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-art-history-minor','group',id,NULL,'https://arthistory.rutgers.edu/academics/undergraduate-welcome/minor-requirements','Art History Minor Requirements',NULL,strftime('%s','now')*1000,'Current Art History minor requirement.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-art-history-minor';

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-art-history-minor-academic-review','sasnb-art-history-minor','advisor_confirmation','{"topics":["a grade of C or better is required for every Art History course counted toward the minor","students outside SAS follow their home-school declaration process"]}','requires_approval','Confirm grade and any home-school declaration process with Art History advising before relying on this plan.','https://arthistory.rutgers.edu/academics/undergraduate-welcome/minor-requirements','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
