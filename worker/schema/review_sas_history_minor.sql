-- Reviewed SAS New Brunswick History minor (program code 510).

INSERT INTO programs (
  id,name,school_slug,program_slug,type,catalog_year,
  academic_program_code,degree_type,program_family_id,source_url,
  review_status,last_scraped_at,requirement_evidence_required
) VALUES (
  'sasnb-history-minor','History','sasnb','history-minor','minor','Current official departmental and SAS pages',
  '510',NULL,'sasnb-history-510','https://history.rutgers.edu/academics/undergraduate/minor-requirements',
  'reviewed',strftime('%s','now')*1000,1
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,
  academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,
  source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,
  requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-history-minor','https://history.rutgers.edu/academics/undergraduate/minor-requirements','History Minor Requirements',NULL,'program_requirements',strftime('%s','now')*1000,'Current department minor requirements page.'),
('sasnb-history-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/history','History (Major/ Minor) BA',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms SAS ownership and program code 510.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-history-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-history-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-history-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-history-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-history-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-history-minor-total','sasnb-history-minor',NULL,'Six History courses worth three credits each.','min_courses',6,10,0),
('sasnb-history-minor-upper','sasnb-history-minor','sasnb-history-minor-total','At least three of the six courses at the 300 or 400 level.','min_courses',3,10,0);

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-history-minor-total','sasnb-history-minor-courses','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["506","508","510","512"],"course_number_min":100,"course_number_max":499,"minimum_credits":3,"label":"Three-credit History courses"}','https://history.rutgers.edu/academics/undergraduate/minor-requirements','History Minor Requirements','reviewed',strftime('%s','now')*1000),
('sasnb-history-minor-upper','sasnb-history-minor-upper-courses','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["506","508","510","512"],"course_number_min":300,"course_number_max":499,"minimum_credits":3,"label":"Three-credit 300- or 400-level History courses"}','https://history.rutgers.edu/academics/undergraduate/minor-requirements','History Minor Requirements','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-history-minor','group',id,NULL,'https://history.rutgers.edu/academics/undergraduate/minor-requirements','History Minor Requirements',NULL,strftime('%s','now')*1000,'Current History minor requirement.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-history-minor';

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-history-minor-academic-review','sasnb-history-minor','advisor_confirmation','{"topics":["all courses applied to the minor require a grade of C or better","no more than two transfer courses may apply","no more than two courses used for another department major or minor may also fulfill the History minor"]}','requires_approval','Confirm grade, transfer-credit, and cross-major/minor course-counting limits with History advising before relying on this plan.','https://history.rutgers.edu/academics/undergraduate/minor-requirements','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
