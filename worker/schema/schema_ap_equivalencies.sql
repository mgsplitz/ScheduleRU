-- AP equivalency table (v1)
--
-- This file is structural only. Reviewed AP equivalency rows are maintained
-- in the validated reference-data snapshot and published transactionally.
CREATE TABLE IF NOT EXISTS ap_equivalencies (
  id TEXT NOT NULL,
  exam_name TEXT NOT NULL,
  minimum_score INTEGER NOT NULL CHECK (minimum_score BETWEEN 1 AND 5),
  maximum_score INTEGER NOT NULL CHECK (maximum_score BETWEEN minimum_score AND 5),
  credits REAL NOT NULL CHECK (credits >= 0),
  equivalent_course_codes_json TEXT NOT NULL DEFAULT '[]',
  fulfills_requirement_ids_json TEXT NOT NULL DEFAULT '[]',
  catalog_year TEXT NOT NULL,
  campus TEXT NOT NULL DEFAULT 'NB',
  source_url TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('draft','reviewed','retired')),
  reviewed_at TEXT,
  PRIMARY KEY (id, catalog_year, campus)
);
