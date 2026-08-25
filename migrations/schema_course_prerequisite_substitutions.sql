-- Reviewed directed substitutions used only when satisfying course prerequisites.
-- Academic content is published through the reference-data bundle, never seeded here.

CREATE TABLE IF NOT EXISTS course_prerequisite_substitutions (
  required_course_code TEXT NOT NULL,
  satisfying_course_code TEXT NOT NULL,
  campus_slug TEXT NOT NULL,
  catalog_year TEXT,
  note TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_date TEXT,
  review_status TEXT NOT NULL CHECK (review_status IN ('draft','reviewed','stale')),
  reviewed_at INTEGER,
  CHECK (required_course_code <> satisfying_course_code),
  PRIMARY KEY (required_course_code, satisfying_course_code)
);

CREATE INDEX IF NOT EXISTS idx_course_prerequisite_substitutions_satisfying
  ON course_prerequisite_substitutions(satisfying_course_code, required_course_code);
