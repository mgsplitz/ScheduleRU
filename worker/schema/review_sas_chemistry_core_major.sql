-- Reviewed SAS New Brunswick Chemistry Core Option B.A. (program code 160).

INSERT INTO programs (id,name,school_slug,program_slug,type,catalog_year,academic_program_code,degree_type,program_family_id,source_url,review_status,last_scraped_at,requirement_evidence_required)
VALUES ('sasnb-chemistry-core-ba','Chemistry - Core Option','sasnb','chemistry-core-option','major','Current official page','160','B.A.','sasnb-chemistry-160','https://chem.rutgers.edu/academics/undergraduate-program/major/78-chemistry-major-core','reviewed',strftime('%s','now')*1000,1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-chemistry-core-ba','https://chem.rutgers.edu/academics/undergraduate-program/major/78-chemistry-major-core','Chemistry Major - Core',NULL,'program_requirements',strftime('%s','now')*1000,'Current department Core Option requirements and scheduling notes.'),
('sasnb-chemistry-core-ba','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/chemistry-core-option','Chemistry - Core Option (Major) | BA',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms program code 160 and B.A. path.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-chemistry-core-ba';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-chemistry-core-ba');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-chemistry-core-ba');
DELETE FROM requirement_groups WHERE program_id='sasnb-chemistry-core-ba';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-chemistry-core-ba';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-chemistry-core-ba-general-chemistry','sasnb-chemistry-core-ba',NULL,'One approved General Chemistry lecture sequence.','one_of',NULL,10,0),
('sasnb-chemistry-core-ba-general-chemistry-161','sasnb-chemistry-core-ba','sasnb-chemistry-core-ba-general-chemistry','General Chemistry sequence: 161 and 162.','all',NULL,10,0),
('sasnb-chemistry-core-ba-general-chemistry-163','sasnb-chemistry-core-ba','sasnb-chemistry-core-ba-general-chemistry','General Chemistry sequence: 163 and 164.','all',NULL,20,0),
('sasnb-chemistry-core-ba-general-chemistry-lab','sasnb-chemistry-core-ba',NULL,'General Chemistry Laboratory.','all',NULL,20,0),
('sasnb-chemistry-core-ba-analytical-chemistry','sasnb-chemistry-core-ba',NULL,'Analytical Chemistry.','all',NULL,30,0),
('sasnb-chemistry-core-ba-organic-chemistry','sasnb-chemistry-core-ba',NULL,'One approved Organic Chemistry lecture sequence.','one_of',NULL,40,0),
('sasnb-chemistry-core-ba-organic-chemistry-307','sasnb-chemistry-core-ba','sasnb-chemistry-core-ba-organic-chemistry','Organic Chemistry sequence: 307 and 308.','all',NULL,10,0),
('sasnb-chemistry-core-ba-organic-chemistry-315','sasnb-chemistry-core-ba','sasnb-chemistry-core-ba-organic-chemistry','Organic Chemistry sequence: 315 and 316 (by invitation).','all',NULL,20,0),
('sasnb-chemistry-core-ba-organic-laboratories','sasnb-chemistry-core-ba',NULL,'Organic Chemistry Laboratories.','all',NULL,50,0),
('sasnb-chemistry-core-ba-physical-chemistry','sasnb-chemistry-core-ba',NULL,'One approved Physical Chemistry lecture sequence.','one_of',NULL,60,0),
('sasnb-chemistry-core-ba-physical-chemistry-327','sasnb-chemistry-core-ba','sasnb-chemistry-core-ba-physical-chemistry','Physical Chemistry sequence: 327 and 328.','all',NULL,10,0),
('sasnb-chemistry-core-ba-physical-chemistry-341','sasnb-chemistry-core-ba','sasnb-chemistry-core-ba-physical-chemistry','Physical Chemistry sequence: 341 and 342.','all',NULL,20,0),
('sasnb-chemistry-core-ba-experimental-physical-chemistry','sasnb-chemistry-core-ba',NULL,'Experimental Physical Chemistry.','all',NULL,70,0),
('sasnb-chemistry-core-ba-instrumental-analysis','sasnb-chemistry-core-ba',NULL,'Instrumental Analysis.','all',NULL,80,0),
('sasnb-chemistry-core-ba-inorganic-chemistry','sasnb-chemistry-core-ba',NULL,'Inorganic Chemistry.','all',NULL,90,0),
('sasnb-chemistry-core-ba-inorganic-second-course','sasnb-chemistry-core-ba',NULL,'One approved second Inorganic Chemistry course.','one_of',NULL,100,0),
('sasnb-chemistry-core-ba-inorganic-352','sasnb-chemistry-core-ba','sasnb-chemistry-core-ba-inorganic-second-course','Inorganic Chemistry 352.','all',NULL,10,0),
('sasnb-chemistry-core-ba-inorganic-353','sasnb-chemistry-core-ba','sasnb-chemistry-core-ba-inorganic-second-course','Inorganic Chemistry 353.','all',NULL,20,0),
('sasnb-chemistry-core-ba-seminar','sasnb-chemistry-core-ba',NULL,'Chemistry Seminars.','all',NULL,110,0),
('sasnb-chemistry-core-ba-calculus','sasnb-chemistry-core-ba',NULL,'Required Calculus courses.','all',NULL,120,0),
('sasnb-chemistry-core-ba-linear-or-differential','sasnb-chemistry-core-ba',NULL,'One approved Linear Algebra or Differential Equations course.','one_of',NULL,130,0),
('sasnb-chemistry-core-ba-linear-algebra','sasnb-chemistry-core-ba','sasnb-chemistry-core-ba-linear-or-differential','Linear Algebra.','all',NULL,10,0),
('sasnb-chemistry-core-ba-differential-equations','sasnb-chemistry-core-ba','sasnb-chemistry-core-ba-linear-or-differential','Elementary Differential Equations.','all',NULL,20,0),
('sasnb-chemistry-core-ba-physics','sasnb-chemistry-core-ba',NULL,'General Physics lectures and laboratories.','all',NULL,140,0);

INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) VALUES
('sasnb-chemistry-core-ba-general-chemistry-161','01:160:161',NULL,NULL,NULL),('sasnb-chemistry-core-ba-general-chemistry-161','01:160:162',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-general-chemistry-163','01:160:163',NULL,NULL,NULL),('sasnb-chemistry-core-ba-general-chemistry-163','01:160:164',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-general-chemistry-lab','01:160:171',NULL,NULL,NULL),('sasnb-chemistry-core-ba-analytical-chemistry','01:160:251',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-organic-chemistry-307','01:160:307',NULL,NULL,NULL),('sasnb-chemistry-core-ba-organic-chemistry-307','01:160:308',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-organic-chemistry-315','01:160:315',NULL,NULL,NULL),('sasnb-chemistry-core-ba-organic-chemistry-315','01:160:316',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-organic-laboratories','01:160:309',NULL,NULL,NULL),('sasnb-chemistry-core-ba-organic-laboratories','01:160:310',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-physical-chemistry-327','01:160:327',NULL,NULL,NULL),('sasnb-chemistry-core-ba-physical-chemistry-327','01:160:328',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-physical-chemistry-341','01:160:341',NULL,NULL,NULL),('sasnb-chemistry-core-ba-physical-chemistry-341','01:160:342',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-experimental-physical-chemistry','01:160:329',NULL,NULL,NULL),('sasnb-chemistry-core-ba-instrumental-analysis','01:160:348',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-inorganic-chemistry','01:160:351',NULL,NULL,NULL),('sasnb-chemistry-core-ba-inorganic-352','01:160:352',NULL,NULL,NULL),('sasnb-chemistry-core-ba-inorganic-353','01:160:353',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-seminar','01:160:491',NULL,NULL,NULL),('sasnb-chemistry-core-ba-seminar','01:160:492',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-calculus','01:640:151',NULL,NULL,NULL),('sasnb-chemistry-core-ba-calculus','01:640:152',NULL,NULL,NULL),('sasnb-chemistry-core-ba-calculus','01:640:251',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-linear-algebra','01:640:250',NULL,NULL,NULL),('sasnb-chemistry-core-ba-differential-equations','01:640:252',NULL,NULL,NULL),
('sasnb-chemistry-core-ba-physics','01:750:203',NULL,NULL,NULL),('sasnb-chemistry-core-ba-physics','01:750:204',NULL,NULL,NULL),('sasnb-chemistry-core-ba-physics','01:750:205',NULL,NULL,NULL),('sasnb-chemistry-core-ba-physics','01:750:206',NULL,NULL,NULL);

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-chemistry-core-ba','group',id,NULL,'https://chem.rutgers.edu/academics/undergraduate-program/major/78-chemistry-major-core','Chemistry Major - Core',NULL,strftime('%s','now')*1000,'Current official Core Option requirement or scheduling path.','reviewed'
FROM requirement_groups WHERE program_id='sasnb-chemistry-core-ba';
INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'course:'||group_id||':'||course_code,'sasnb-chemistry-core-ba','course',group_id,course_code,'https://chem.rutgers.edu/academics/undergraduate-program/major/78-chemistry-major-core','Chemistry Major - Core',NULL,strftime('%s','now')*1000,'Current official Core Option requirement or scheduling path.','reviewed'
FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-chemistry-core-ba');

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-chemistry-core-ba-academic-review','sasnb-chemistry-core-ba','advisor_confirmation','{"topics":["major declaration requires 01:160:159, 161, 163, or equivalent with a C or better","01:160:315/316 is by invitation","01:160:327 and 341 require 01:640:251 as a prerequisite","01:160:352 and 353 have published prerequisite and offering-term conditions"]}','requires_approval','Confirm declaration equivalencies, invitation-only enrollment, and course-sequencing details with Chemistry advising before relying on this plan.','https://chem.rutgers.edu/academics/undergraduate-program/major/78-chemistry-major-core','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
