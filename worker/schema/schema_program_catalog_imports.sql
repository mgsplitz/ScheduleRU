-- Source-backed program directory imports (v1)
--
-- Program names and paths are imported from official school directories into
-- D1. The repository stores only a small source configuration, never a copy
-- of every program or requirement policy.

CREATE TABLE IF NOT EXISTS program_catalog_sources (
  id TEXT PRIMARY KEY,
  school_slug TEXT NOT NULL,
  directory_url TEXT NOT NULL,
  profile_path TEXT NOT NULL,
  catalog_year TEXT,
  source_title TEXT NOT NULL,
  adapter TEXT NOT NULL DEFAULT 'html_program_directory_v1',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  last_imported_at INTEGER,
  last_content_hash TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_program_catalog_sources_school
  ON program_catalog_sources(school_slug, enabled);

ALTER TABLE programs ADD COLUMN catalog_source_id TEXT;
ALTER TABLE programs ADD COLUMN catalog_listed_at INTEGER;
ALTER TABLE programs ADD COLUMN catalog_active INTEGER NOT NULL DEFAULT 0
  CHECK (catalog_active IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_programs_catalog_public
  ON programs(catalog_source_id, catalog_active, review_status);

-- A source configuration is not a curriculum snapshot. The import endpoint
-- reads this official directory and stores the current entries in D1.
INSERT INTO program_catalog_sources (
  id, school_slug, directory_url, profile_path, catalog_year, source_title,
  adapter, enabled
) VALUES (
  'sasnb-official-directory',
  'sasnb',
  'https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/list-of-majors-and-minors',
  '/majors-and-core-curriculum/major/major-minor-details/',
  'Official SAS directory',
  'SAS Majors and Minors',
  'html_program_directory_v1',
  1
)
ON CONFLICT(id) DO UPDATE SET
  school_slug = excluded.school_slug,
  directory_url = excluded.directory_url,
  profile_path = excluded.profile_path,
  catalog_year = excluded.catalog_year,
  source_title = excluded.source_title,
  adapter = excluded.adapter,
  enabled = excluded.enabled;
