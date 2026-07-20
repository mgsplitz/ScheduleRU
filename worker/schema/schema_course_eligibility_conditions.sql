-- Reviewed course eligibility facts (v1)
--
-- A missing review row means ScheduleRU has not verified whether the course
-- has eligibility conditions. It is deliberately different from a reviewed
-- row with no_known_conditions = 1, which means the source was checked and
-- did not list a condition this evaluator supports.

CREATE TABLE IF NOT EXISTS course_eligibility_reviews (
  course_code TEXT PRIMARY KEY,
  campus_slug TEXT NOT NULL,
  catalog_year TEXT,
  review_status TEXT NOT NULL CHECK (review_status IN ('draft','reviewed','stale')),
  no_known_conditions INTEGER NOT NULL DEFAULT 0 CHECK (no_known_conditions IN (0,1)),
  source_url TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_date TEXT,
  reviewed_at INTEGER,
  note TEXT
);

CREATE TABLE IF NOT EXISTS course_eligibility_conditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL REFERENCES course_eligibility_reviews(course_code),
  condition_key TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('prerequisite_course','corequisite_course','minimum_prior_credits','minimum_plan_year')),
  condition_value_json TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('draft','reviewed','stale')),
  source_url TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_date TEXT,
  reviewed_at INTEGER,
  UNIQUE(course_code, condition_key)
);

CREATE INDEX IF NOT EXISTS idx_course_eligibility_conditions_course
  ON course_eligibility_conditions(course_code, review_status);
