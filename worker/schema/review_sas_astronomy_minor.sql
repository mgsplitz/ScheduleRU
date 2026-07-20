-- Reviewed SAS New Brunswick Astronomy minor (program code 100).

INSERT INTO programs (
  id,name,school_slug,program_slug,type,catalog_year,
  academic_program_code,degree_type,program_family_id,source_url,
  review_status,last_scraped_at,requirement_evidence_required
) VALUES (
  'sasnb-astronomy-minor','Astronomy','sasnb','astronomy-minor','minor','Current official departmental and SAS pages',
  '100',NULL,'sasnb-astronomy-100','https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-astronomy',
  'reviewed',strftime('%s','now')*1000,1
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,
  academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,
  source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,
  requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-astronomy-minor','https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-astronomy','Astronomy Minor Requirements',NULL,'program_requirements',strftime('%s','now')*1000,'Current department minor requirements page.'),
('sasnb-astronomy-minor','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/astrophysics','Astrophysics (Major) | BS',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS Astrophysics profile confirms the Astronomy minor program code 100 and its Astrophysics incompatibility.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-astronomy-minor';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-astronomy-minor');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-astronomy-minor');
DELETE FROM requirement_group_conditions WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-astronomy-minor');
DELETE FROM requirement_groups WHERE program_id='sasnb-astronomy-minor';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-astronomy-minor';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-astronomy-minor-introductory-physics','sasnb-astronomy-minor',NULL,'Standard General Physics lecture sequence.','all',NULL,10,0),
('sasnb-astronomy-minor-laboratories','sasnb-astronomy-minor',NULL,'One approved Physics laboratory sequence.','one_of',NULL,20,0),
('sasnb-astronomy-minor-laboratories-205','sasnb-astronomy-minor','sasnb-astronomy-minor-laboratories','General Physics Laboratory sequence: 205 and 206.','all',NULL,10,0),
('sasnb-astronomy-minor-laboratories-229','sasnb-astronomy-minor','sasnb-astronomy-minor-laboratories','Analytical Physics Laboratory sequence: 229 and 230.','all',NULL,20,0),
('sasnb-astronomy-minor-laboratories-275','sasnb-astronomy-minor','sasnb-astronomy-minor-laboratories','Classical Physics Laboratory sequence: 275 and 276.','all',NULL,30,0),
('sasnb-astronomy-minor-astronomy-core','sasnb-astronomy-minor',NULL,'Required Astronomy courses.','all',NULL,30,0),
('sasnb-astronomy-minor-advanced','sasnb-astronomy-minor',NULL,'Two approved astronomy laboratory or upper-level courses.','min_courses',2,40,0);

INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) VALUES
('sasnb-astronomy-minor-introductory-physics','01:750:203',NULL,'General Physics I','3'),
('sasnb-astronomy-minor-introductory-physics','01:750:204',NULL,'General Physics II','3'),
('sasnb-astronomy-minor-laboratories-205','01:750:205',NULL,'General Physics Laboratory I','1'),
('sasnb-astronomy-minor-laboratories-205','01:750:206',NULL,'General Physics Laboratory II','1'),
('sasnb-astronomy-minor-laboratories-229','01:750:229',NULL,'Analytical Physics IIA Laboratory','1'),
('sasnb-astronomy-minor-laboratories-229','01:750:230',NULL,'Analytical Physics IIB Laboratory','1'),
('sasnb-astronomy-minor-laboratories-275','01:750:275',NULL,'Classical Physics Laboratory I','2'),
('sasnb-astronomy-minor-laboratories-275','01:750:276',NULL,'Classical Physics Laboratory II','2'),
('sasnb-astronomy-minor-astronomy-core','01:750:341',NULL,'Introduction to Astrophysics','3'),
('sasnb-astronomy-minor-astronomy-core','01:750:342',NULL,'Introduction to Astrophysics II','3');

INSERT INTO requirement_course_selectors (group_id,selector_key,selector_json,source_url,source_label,review_status,reviewed_at) VALUES
('sasnb-astronomy-minor-advanced','sasnb-astronomy-minor-advanced-courses','{"version":1,"kind":"course_codes","include_course_codes":["01:750:345","01:750:346","01:750:441","01:750:442","01:750:443","01:750:444"],"label":"Approved astronomy laboratory or upper-level course"}','https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-astronomy','Astronomy Minor Requirements','reviewed',strftime('%s','now')*1000)
ON CONFLICT(group_id,selector_key) DO UPDATE SET selector_json=excluded.selector_json,source_url=excluded.source_url,source_label=excluded.source_label,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at;

INSERT INTO requirement_group_conditions (group_id,condition_type,condition_value_json,note,source_url,review_status) VALUES
('sasnb-astronomy-minor-introductory-physics','selected_program_must_not_include_any','["sasnb-physics-general-ba","sasnb-physics-applied-bs","sasnb-physics-planetary-bs","sasnb-physics-professional-bs","sasnb-physics-minor"]','Physics majors and minors need only the Astronomy-specific courses for the Astronomy minor.','https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-astronomy','reviewed'),
('sasnb-astronomy-minor-laboratories','selected_program_must_not_include_any','["sasnb-physics-general-ba","sasnb-physics-applied-bs","sasnb-physics-planetary-bs","sasnb-physics-professional-bs","sasnb-physics-minor"]','Physics majors and minors need only the Astronomy-specific courses for the Astronomy minor.','https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-astronomy','reviewed')
ON CONFLICT(group_id,condition_type,condition_value_json) DO UPDATE SET note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status;

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-astronomy-minor','group',id,NULL,'https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-astronomy','Astronomy Minor Requirements',NULL,strftime('%s','now')*1000,'Current Astronomy minor fixed path or reviewed selector.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-astronomy-minor';
INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'course:'||group_id||':'||course_code,'sasnb-astronomy-minor','course',group_id,course_code,'https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-astronomy','Astronomy Minor Requirements',NULL,strftime('%s','now')*1000,'Current Astronomy minor fixed course requirement.','reviewed'
FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-astronomy-minor');

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-astronomy-minor-academic-review','sasnb-astronomy-minor','advisor_confirmation','{"topics":["01:750:203-204 or another officially equivalent physics sequence","all courses applied to the minor require a 2.0 GPA","no more than one D may count toward the minor","three of the four 300-level courses must be taken at Rutgers-New Brunswick","Astronomy courses used for this minor may not also satisfy a Physics major or minor"]}','requires_approval','Confirm any equivalent physics sequence, grades, residency, and the no-double-counting rule with Physics and Astronomy advising before relying on this plan.','https://physics.rutgers.edu/academics/undergraduate-program/minors/minor-in-astronomy','reviewed',strftime('%s','now')*1000),
('sasnb-astronomy-minor-no-astrophysics','sasnb-astronomy-minor','selected_program_must_not_include_any','["sasnb-astrophysics-bs"]','blocked','Astrophysics majors may not minor in Astronomy.','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/astrophysics','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
