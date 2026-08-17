-- Searchable course attributes derived from reviewed curriculum definitions.
-- This file is structural only. The catalog publisher replaces rows whenever
-- it publishes a reviewed Core curriculum; no course content belongs here.
CREATE TABLE IF NOT EXISTS course_requirement_attributes (
  program_id TEXT NOT NULL REFERENCES programs(id),
  group_id TEXT NOT NULL REFERENCES requirement_groups(id),
  course_code TEXT NOT NULL,
  attribute_code TEXT NOT NULL,
  PRIMARY KEY (program_id, group_id, course_code, attribute_code)
);

CREATE INDEX IF NOT EXISTS idx_course_requirement_attributes_course
  ON course_requirement_attributes(course_code, attribute_code);
CREATE INDEX IF NOT EXISTS idx_course_requirement_attributes_attribute
  ON course_requirement_attributes(attribute_code, course_code);
