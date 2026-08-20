-- Reviewed course families for which a student may receive credit for only a
-- bounded number of members. These are academic facts, not requirement
-- substitutions: a program may list several members even though a plan must
-- never recommend all of them.

CREATE TABLE IF NOT EXISTS course_credit_exclusion_policies (
  policy_key TEXT PRIMARY KEY,
  campus_slug TEXT NOT NULL,
  catalog_year TEXT,
  max_courses INTEGER NOT NULL CHECK (max_courses >= 1),
  note TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_date TEXT,
  review_status TEXT NOT NULL CHECK (review_status IN ('draft','reviewed','stale')),
  reviewed_at INTEGER
);

CREATE TABLE IF NOT EXISTS course_credit_exclusion_members (
  policy_key TEXT NOT NULL REFERENCES course_credit_exclusion_policies(policy_key),
  course_code TEXT NOT NULL,
  PRIMARY KEY (policy_key, course_code)
);

CREATE INDEX IF NOT EXISTS idx_course_credit_exclusion_members_course
  ON course_credit_exclusion_members(course_code, policy_key);
