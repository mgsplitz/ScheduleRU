-- Reviewed SAS New Brunswick Physics minor (program code 750).

INSERT INTO programs (
  id,name,school_slug,program_slug,type,catalog_year,
  academic_program_code,degree_type,program_family_id,source_url,
  review_status,last_scraped_at,requirement_evidence_required
) VALUES (
  'sasnb-physics-minor','Physics','sasnb','physics-minor','minor','Current official departmental and SAS pages',
  '750',NULL,'sasnb-physics-750','https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-physics',
  'reviewed',strftime('%s','now')*1000,1
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,
  academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,
  source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,
  requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-physics-minor','https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-physics','Physics Minor Requirements',NULL,'program_requirements',strftime('%s','now')*1000,'Current department minor requirements page.'),
('sasnb-physics-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/list-of-majors-and-minors','SAS Majors and Minors',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS list confirms Physics is an SAS minor.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-physics-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-physics-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-physics-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-physics-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-physics-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-physics-minor-introductory-physics','sasnb-physics-minor',NULL,'Standard General Physics lecture sequence.','all',NULL,10,0),
('sasnb-physics-minor-laboratories','sasnb-physics-minor',NULL,'One approved Physics laboratory sequence.','one_of',NULL,20,0),
('sasnb-physics-minor-laboratories-205','sasnb-physics-minor','sasnb-physics-minor-laboratories','General Physics Laboratory sequence: 205 and 206.','all',NULL,10,0),
('sasnb-physics-minor-laboratories-229','sasnb-physics-minor','sasnb-physics-minor-laboratories','Analytical Physics Laboratory sequence: 229 and 230.','all',NULL,20,0),
('sasnb-physics-minor-laboratories-275','sasnb-physics-minor','sasnb-physics-minor-laboratories','Classical Physics Laboratory sequence: 275 and 276.','all',NULL,30,0),
('sasnb-physics-minor-advanced','sasnb-physics-minor',NULL,'Twelve credits of 300- or 400-level Physics courses.','min_credits',12,30,0);

INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) VALUES
('sasnb-physics-minor-introductory-physics','01:750:203',NULL,'General Physics I','3'),
('sasnb-physics-minor-introductory-physics','01:750:204',NULL,'General Physics II','3'),
('sasnb-physics-minor-laboratories-205','01:750:205',NULL,'General Physics Laboratory I','1'),
('sasnb-physics-minor-laboratories-205','01:750:206',NULL,'General Physics Laboratory II','1'),
('sasnb-physics-minor-laboratories-229','01:750:229',NULL,'Analytical Physics IIA Laboratory','1'),
('sasnb-physics-minor-laboratories-229','01:750:230',NULL,'Analytical Physics IIB Laboratory','1'),
('sasnb-physics-minor-laboratories-275','01:750:275',NULL,'Classical Physics Laboratory I','2'),
('sasnb-physics-minor-laboratories-275','01:750:276',NULL,'Classical Physics Laboratory II','2');

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-physics-minor-advanced','sasnb-physics-minor-advanced-courses','{"version":1,"kind":"subject_level","school_codes":["01"],"subject_codes":["750"],"course_number_min":300,"course_number_max":499,"label":"300- or 400-level Physics course"}','https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-physics','Physics Minor Requirements','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-physics-minor','group',id,NULL,'https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-physics','Physics Minor Requirements',NULL,strftime('%s','now')*1000,'Current Physics minor fixed path or reviewed selector.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-physics-minor';
INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'course:'||group_id||':'||course_code,'sasnb-physics-minor','course',group_id,course_code,'https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-physics','Physics Minor Requirements',NULL,strftime('%s','now')*1000,'Current Physics minor fixed course requirement.','reviewed'
FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-physics-minor');

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-physics-minor-academic-review','sasnb-physics-minor','advisor_confirmation','{"topics":["01:750:203-204 or another officially equivalent physics sequence","all courses applied to the minor require a 2.0 GPA","no more than one D may count toward the minor","three of the four advanced elective courses must be taken at Rutgers-New Brunswick"]}','requires_approval','Confirm any equivalent introductory sequence, grades, and Rutgers-New Brunswick advanced-course residency with Physics advising before relying on this plan.','https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-physics','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
