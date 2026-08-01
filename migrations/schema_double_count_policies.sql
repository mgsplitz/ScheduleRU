-- School-wide double-count policy table (v2)
--
-- Pair-specific overrides remain in double_count_rules. This table stores a
-- per-student school-wide cap for a program pairing scope. A missing row means
-- no reviewed school-wide restriction; it must not be interpreted as zero.
--
-- This file is structural only. Reviewed policy rows are maintained in the
-- validated reference-data snapshot and published transactionally.
CREATE TABLE IF NOT EXISTS double_count_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_slug TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'major_major'
    CHECK (scope IN ('major_major', 'major_concentration')),
  max_shared_courses INTEGER CHECK (
    max_shared_courses IS NULL OR max_shared_courses >= 0
  ),
  note TEXT,
  source_url TEXT,
  verified_at INTEGER,
  UNIQUE(school_slug, scope)
);

CREATE INDEX IF NOT EXISTS idx_dcpolicies_school
  ON double_count_policies(school_slug);
