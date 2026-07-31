-- Reviewed RBS requirement-course metadata completeness pass
--
-- Development-only review decision, 2026-07-19. Requirement rows must retain
-- a title and credit value even when the course is not offered in the current
-- term. The live course sync is term-specific, so it cannot be the only
-- metadata source for a reviewed degree requirement.
--
-- Sources: the official RBS-New Brunswick program pages and the current
-- 2025-26 RBS-NB catalog. The Global Business page previously listed the
-- graduate-RBS code 22:620:320. The current undergraduate catalog confirms
-- the correct New Brunswick course is 33:620:320.
--
-- Apply after the RBS areas-of-study seed and review batches:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/review_rbs_requirement_course_metadata.sql

-- Correct the stale Global Business elective code before backfilling metadata.
UPDATE requirement_courses
SET course_code = '33:620:320'
WHERE group_id = 'rbsnb-global-business-concentration-elective'
  AND course_code = '22:620:320';

UPDATE requirement_courses
SET source_title = CASE course_code
  WHEN '33:010:272' THEN 'Financial Accounting'
  WHEN '33:390:203' THEN 'Introduction to Finance'
  WHEN '33:620:301' THEN 'Introduction to Management'
  WHEN '33:630:301' THEN 'Introduction to Marketing'
  WHEN '33:799:301' THEN 'Introduction to Supply Chain Management'
  WHEN '33:136:287' THEN 'Introduction to Business Analytics'
  WHEN '33:136:385' THEN 'Statistical Methods'
  WHEN '33:136:386' THEN 'Operations Management'
END,
source_credits = '3'
WHERE group_id IN (
  'rbsnb-business-administration-minor-required',
  'rbsnb-business-administration-minor-choice'
);

UPDATE requirement_courses
SET source_title = CASE course_code
  WHEN '33:136:400' THEN 'Business Decision Analytics under Uncertainty'
  WHEN '33:136:485' THEN 'Time Series Modeling for Business'
  WHEN '33:136:494' THEN 'Data Mining for Business Intelligence'
  WHEN '33:136:450' THEN 'Investment Modeling With ''R'''
  WHEN '33:136:487' THEN 'Large-Scale Business Data Analysis'
  WHEN '33:136:486' THEN 'Optimization Modeling'
  WHEN '33:136:405' THEN 'Risk Modeling'
END,
source_credits = '3'
WHERE group_id IN (
  'rbsnb-business-analytics-concentration-required',
  'rbsnb-business-analytics-concentration-elective'
);

UPDATE requirement_courses
SET source_title = CASE course_code
  WHEN '33:382:103' THEN 'Accounting for Entrepreneurs & Small Businesses'
  WHEN '33:382:202' THEN 'Marketing for Entrepreneurs & Small Businesses'
  WHEN '33:382:203' THEN 'Finance for Entrepreneurs & Small Businesses'
  WHEN '33:382:302' THEN 'Introduction to Entrepreneurship'
  WHEN '33:382:303' THEN 'Managing Growing Ventures'
  WHEN '33:382:340' THEN 'Creativity, Innovation, & Entrepreneurship'
  WHEN '33:382:496' THEN 'Entrepreneurship Practicum'
  WHEN '33:620:475' THEN 'International Entrepreneurship'
  WHEN '33:382:355' THEN 'Managing Technological Innovation'
  WHEN '33:382:352' THEN 'Multicultural Market'
  WHEN '33:382:486' THEN 'Music Industry'
  WHEN '33:630:369' THEN 'New Product Planning'
  WHEN '33:382:310' THEN 'Social Entrepreneurship'
  WHEN '33:382:360' THEN 'Technology Ventures'
  WHEN '33:382:342' THEN 'Urban Entrepreneurship & Economic Development'
END,
source_credits = '3'
WHERE group_id IN (
  'rbsnb-entrepreneurship-minor-preliminary',
  'rbsnb-entrepreneurship-minor-required',
  'rbsnb-entrepreneurship-minor-elective',
  'rbsnb-entrepreneurship-concentration-required',
  'rbsnb-entrepreneurship-concentration-elective'
);

UPDATE requirement_courses
SET source_title = CASE course_code
  WHEN '33:390:380' THEN 'Investment Analysis'
  WHEN '33:390:400' THEN 'Corporate Finance'
  WHEN '33:390:420' THEN 'Derivatives'
END,
source_credits = '3'
WHERE group_id = 'rbsnb-finance-concentration-required';

-- The RBS source calls all three alternatives "Calculus I." The exact course
-- catalog supplies the clearer individual title and the correct 3/4 credits.
UPDATE requirement_courses
SET source_title = CASE course_code
  WHEN '01:198:170' THEN 'Computer Applications for Business'
  WHEN '01:220:102' THEN 'Introduction to Microeconomics'
  WHEN '01:220:103' THEN 'Introduction to Macroeconomics'
  WHEN '01:960:285' THEN 'Introductory Statistics for Business'
  WHEN '01:640:130' THEN 'Business Calculus'
  WHEN '01:640:135' THEN 'Calculus I for the Life and Social Sciences'
  WHEN '01:640:151' THEN 'Calculus I for Mathematical and Physical Sciences'
END,
source_credits = CASE course_code
  WHEN '01:640:130' THEN '3'
  WHEN '01:640:135' THEN '4'
  WHEN '01:640:151' THEN '4'
  ELSE '3'
END
WHERE group_id IN ('rbsnb-foundational-core-g1', 'rbsnb-foundational-core-g1-or1');

UPDATE requirement_courses
SET source_title = CASE course_code
  WHEN '33:620:402' THEN 'Global Management & Strategy'
  WHEN '33:620:369' THEN 'International Business'
  WHEN '33:620:320' THEN 'Cross-Cultural Management'
  WHEN '33:620:479' THEN 'Doing Business in Emerging Markets'
  WHEN '33:620:410' THEN 'Executive Leadership'
  WHEN '33:390:320' THEN 'Global Capital Markets'
  WHEN '33:390:375' THEN 'Global Money Markets & Institutions'
  WHEN '33:620:475' THEN 'International Entrepreneurship'
  WHEN '33:630:371' THEN 'International Marketing'
  WHEN '33:620:370' THEN 'Diversity, Equity, and Inclusion in Management and Organizations'
  WHEN '33:620:350' THEN 'Negotiations'
  WHEN '33:799:305' THEN 'Procurement and Global Sourcing Strategies'
END,
source_credits = '3'
WHERE group_id IN (
  'rbsnb-global-business-concentration-required',
  'rbsnb-global-business-concentration-elective'
);

UPDATE requirement_courses
SET source_title = CASE course_code
  WHEN '33:136:470' THEN 'Business Data Management'
  WHEN '33:136:388' THEN 'Foundations of Business Programming'
  WHEN '33:136:494' THEN 'Data Mining for Business Intelligence'
  WHEN '33:136:465' THEN 'Enterprise Architecture'
  WHEN '33:136:471' THEN 'Information System Security'
  WHEN '33:136:450' THEN 'Investment Modeling With ''R'''
END,
source_credits = '3'
WHERE group_id IN (
  'rbsnb-management-information-systems-concentration-required',
  'rbsnb-management-information-systems-concentration-elective'
);

UPDATE requirement_courses
SET source_title = CASE course_code
  WHEN '33:630:485' THEN 'Professional Selling'
  WHEN '33:630:401' THEN 'Sales Management'
  WHEN '33:620:350' THEN 'Negotiations'
  WHEN '33:630:368' THEN 'Retail Marketing'
  WHEN '33:630:369' THEN 'New Product Planning'
  WHEN '33:630:370' THEN 'Business to Business Marketing'
END,
source_credits = '3'
WHERE group_id IN (
  'rbsnb-professional-selling-concentration-required',
  'rbsnb-professional-selling-concentration-elective'
);

INSERT INTO program_sources
  (program_id, source_url, source_title, source_catalog_year, source_scope, accessed_at, note)
VALUES
  (
    'rbsnb-global-business-concentration',
    'https://newbrunswick-undergrad-25-26.catalogs.rutgers.edu/pages/tZghCvs9mjVhRGvNWqgC',
    '620 Global Business Concentration (RBS-NB)', '2025-26', 'program_requirements',
    strftime('%s','now') * 1000,
    'Current official undergraduate catalog used to correct the stale 22:620:320 code and preserve elective metadata.'
  )
ON CONFLICT(program_id, source_url) DO UPDATE SET
  source_title=excluded.source_title,
  source_catalog_year=excluded.source_catalog_year,
  source_scope=excluded.source_scope,
  accessed_at=excluded.accessed_at,
  note=excluded.note;
