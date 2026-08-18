-- Stable, term-independent course identity used by planners and reviewed catalogs.
-- Section-bearing `courses` rows remain term-specific; this table is canonical metadata.
CREATE TABLE IF NOT EXISTS course_reference (
  course_code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  credits TEXT,
  source_kind TEXT NOT NULL,
  source_url TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_course_reference_title ON course_reference(title);
