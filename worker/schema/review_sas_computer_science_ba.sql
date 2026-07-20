-- Reviewed SAS New Brunswick Computer Science B.A. (program code 198).

INSERT INTO programs (id,name,school_slug,program_slug,type,catalog_year,academic_program_code,degree_type,program_family_id,source_url,review_status,last_scraped_at,requirement_evidence_required)
VALUES ('sasnb-computer-science-ba','Computer Science','sasnb','computer-science-ba','major','Current official page (Spring 2027 sequence transition announced)','198','B.A.','sasnb-computer-science-198','https://www.cs.rutgers.edu/academics/undergraduate/cs-degrees/b-a-degree','reviewed',strftime('%s','now')*1000,1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,school_slug=excluded.school_slug,program_slug=excluded.program_slug,type=excluded.type,catalog_year=excluded.catalog_year,academic_program_code=excluded.academic_program_code,degree_type=excluded.degree_type,program_family_id=excluded.program_family_id,source_url=excluded.source_url,review_status=excluded.review_status,last_scraped_at=excluded.last_scraped_at,requirement_evidence_required=excluded.requirement_evidence_required;

INSERT INTO program_sources (program_id,source_url,source_title,source_catalog_year,source_scope,accessed_at,note) VALUES
('sasnb-computer-science-ba','https://www.cs.rutgers.edu/academics/undergraduate/cs-degrees/b-a-degree','Requirements for the B.A. in Computer Science',NULL,'program_requirements',strftime('%s','now')*1000,'Current official CS requirements page; no catalog-year boundary stated.'),
('sasnb-computer-science-ba','https://www.cs.rutgers.edu/academics/undergraduate/electives','Computer Science undergraduate electives',NULL,'elective_list',strftime('%s','now')*1000,'Current official designated-elective list.'),
('sasnb-computer-science-ba','https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/computer-science-b-a','Computer Science (Major) | BA',NULL,'program_profile',strftime('%s','now')*1000,'Current SAS profile confirms program code 198 and B.A. path.')
ON CONFLICT(program_id,source_url) DO UPDATE SET source_title=excluded.source_title,source_catalog_year=excluded.source_catalog_year,source_scope=excluded.source_scope,accessed_at=excluded.accessed_at,note=excluded.note;

DELETE FROM program_requirement_evidence WHERE program_id='sasnb-computer-science-ba';
DELETE FROM requirement_course_selectors WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-computer-science-ba');
DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-computer-science-ba');
DELETE FROM requirement_groups WHERE program_id='sasnb-computer-science-ba';
DELETE FROM program_eligibility_rules WHERE program_id='sasnb-computer-science-ba';

INSERT INTO requirement_groups (id,program_id,parent_group_id,name,rule,count,sort_order,auto_generated) VALUES
('sasnb-computer-science-ba-core','sasnb-computer-science-ba',NULL,'Required Computer Science courses.','all',NULL,10,0),
('sasnb-computer-science-ba-mathematics','sasnb-computer-science-ba',NULL,'Required Mathematics courses.','all',NULL,20,0),
('sasnb-computer-science-ba-electives','sasnb-computer-science-ba',NULL,'Five designated Computer Science and related electives.','min_courses',5,30,0),
('sasnb-computer-science-ba-cs-electives','sasnb-computer-science-ba','sasnb-computer-science-ba-electives','At least three Computer Science electives.','min_courses',3,10,0),
('sasnb-computer-science-ba-upper-cs-electives','sasnb-computer-science-ba','sasnb-computer-science-ba-electives','At least two 300- or 400-level Computer Science electives.','min_courses',2,20,0),
('sasnb-computer-science-ba-independent-study','sasnb-computer-science-ba','sasnb-computer-science-ba-electives','At most one independent-study elective.','max',1,30,0);

INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) VALUES
('sasnb-computer-science-ba-core','01:198:111',NULL,NULL,NULL),('sasnb-computer-science-ba-core','01:198:112',NULL,NULL,NULL),('sasnb-computer-science-ba-core','01:198:205',NULL,NULL,NULL),('sasnb-computer-science-ba-core','01:198:206',NULL,NULL,NULL),('sasnb-computer-science-ba-core','01:198:211',NULL,NULL,NULL),('sasnb-computer-science-ba-core','01:198:344',NULL,NULL,NULL),
('sasnb-computer-science-ba-mathematics','01:640:151',NULL,NULL,NULL),('sasnb-computer-science-ba-mathematics','01:640:152',NULL,NULL,NULL),('sasnb-computer-science-ba-mathematics','01:640:250',NULL,NULL,NULL);

WITH elective(code) AS (VALUES
('01:198:210'),('01:198:213'),('01:198:214'),('01:198:314'),('01:198:323'),('01:198:324'),('01:198:334'),('01:198:336'),('01:198:352'),('01:198:411'),('01:198:415'),('01:198:416'),('01:198:417'),('01:198:419'),('01:198:424'),('01:198:425'),('01:198:428'),('01:198:431'),('01:198:437'),('01:198:439'),('01:198:440'),('01:198:442'),('01:198:443'),('01:198:444'),('01:198:445'),('01:198:452'),('01:198:460'),('01:198:461'),('01:198:462'),('01:198:493'),('01:198:494'),
('14:332:376'),('14:332:423'),('14:332:424'),('14:332:443'),('14:332:451'),('14:332:452'),('14:332:453'),('14:332:456'),('14:332:472'),('01:640:338'),('01:640:348'),('01:640:354'),('01:640:428'),('01:640:454'),('01:640:461'),('01:730:315'),('01:730:407'),('01:730:408'),('01:730:329'),('01:730:424'),('01:615:441'),('01:960:384'),('01:960:463'),('01:960:476'),('01:960:486'))
INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) SELECT 'sasnb-computer-science-ba-electives',code,NULL,NULL,NULL FROM elective;
WITH elective(code) AS (SELECT course_code FROM requirement_courses WHERE group_id='sasnb-computer-science-ba-electives')
INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) SELECT 'sasnb-computer-science-ba-cs-electives',code,NULL,NULL,NULL FROM elective WHERE code LIKE '01:198:%';
WITH elective(code) AS (SELECT course_code FROM requirement_courses WHERE group_id='sasnb-computer-science-ba-electives')
INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) SELECT 'sasnb-computer-science-ba-upper-cs-electives',code,NULL,NULL,NULL FROM elective WHERE code LIKE '01:198:3%' OR code LIKE '01:198:4%';
INSERT INTO requirement_courses (group_id,course_code,note,source_title,source_credits) VALUES ('sasnb-computer-science-ba-independent-study','01:198:493',NULL,NULL,NULL),('sasnb-computer-science-ba-independent-study','01:198:494',NULL,NULL,NULL);

INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'group:'||id,'sasnb-computer-science-ba','group',id,NULL,'https://www.cs.rutgers.edu/academics/undergraduate/cs-degrees/b-a-degree','Requirements for the B.A. in Computer Science',NULL,strftime('%s','now')*1000,'Current official CS requirements and elective pages; no catalog-year boundary stated.','reviewed' FROM requirement_groups WHERE program_id='sasnb-computer-science-ba';
INSERT INTO program_requirement_evidence (entity_key,program_id,entity_type,group_id,course_code,source_url,source_title,source_catalog_year,accessed_at,reviewer_note,review_status)
SELECT 'course:'||group_id||':'||course_code,'sasnb-computer-science-ba','course',group_id,course_code,
  CASE WHEN group_id LIKE 'sasnb-computer-science-ba-electives%' OR group_id='sasnb-computer-science-ba-independent-study' THEN 'https://www.cs.rutgers.edu/academics/undergraduate/electives' ELSE 'https://www.cs.rutgers.edu/academics/undergraduate/cs-degrees/b-a-degree' END,
  CASE WHEN group_id LIKE 'sasnb-computer-science-ba-electives%' OR group_id='sasnb-computer-science-ba-independent-study' THEN 'Computer Science undergraduate electives' ELSE 'Requirements for the B.A. in Computer Science' END,
  NULL,strftime('%s','now')*1000,'Current official source for the named B.A. requirement or designated elective.','reviewed'
FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id='sasnb-computer-science-ba');

INSERT INTO program_eligibility_rules (rule_key,program_id,condition_type,condition_value_json,decision,note,source_url,review_status,verified_at) VALUES
('sasnb-computer-science-ba-academic-review','sasnb-computer-science-ba','advisor_confirmation','{"topics":["C-or-better declaration courses and approved substitutions","no more than one D toward the major","seven-course Rutgers-New Brunswick CS residency","All CS electives required for the BA/BS degree must be completed in the last 10 years from the date of the undergraduate degree.","independent-study arrangement approval","Spring 2027 introductory-sequence transition"]}','requires_approval','Confirm published declaration, grade, residency, elective-age, independent-study, and Spring 2027 transition conditions with Computer Science advising before relying on this plan.','https://www.cs.rutgers.edu/academics/undergraduate/cs-degrees/b-a-degree','reviewed',strftime('%s','now')*1000)
ON CONFLICT(rule_key) DO UPDATE SET program_id=excluded.program_id,condition_type=excluded.condition_type,condition_value_json=excluded.condition_value_json,decision=excluded.decision,note=excluded.note,source_url=excluded.source_url,review_status=excluded.review_status,verified_at=excluded.verified_at;
