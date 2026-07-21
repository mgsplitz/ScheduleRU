-- Source-backed program requirement imports (v1)
--
-- The official directory controls which paths appear in the menu. This
-- separate pipeline records the official requirement pages as D1 snapshots,
-- enabling reusable import adapters without storing a major-by-major catalog
-- manifest in frontend code or review SQL. Snapshot data is always draft-only:
-- it cannot mark a program reviewed or publish a degree audit by itself.

CREATE TABLE IF NOT EXISTS program_requirement_import_sources (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id),
  school_slug TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  adapter TEXT NOT NULL DEFAULT 'html_requirement_source_v1',
  source_kind TEXT NOT NULL DEFAULT 'profile' CHECK (source_kind IN ('profile', 'requirements_page')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  last_imported_at INTEGER,
  last_content_hash TEXT,
  last_error TEXT,
  UNIQUE(program_id, source_url)
);
CREATE INDEX IF NOT EXISTS idx_program_requirement_import_sources_school
  ON program_requirement_import_sources(school_slug, enabled);
CREATE INDEX IF NOT EXISTS idx_program_requirement_import_sources_kind
  ON program_requirement_import_sources(school_slug, source_kind, enabled);

CREATE TABLE IF NOT EXISTS program_requirement_source_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES program_requirement_import_sources(id),
  program_id TEXT NOT NULL REFERENCES programs(id),
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content_text TEXT NOT NULL,
  parsed_json TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  UNIQUE(source_id, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_program_requirement_source_snapshots_program
  ON program_requirement_source_snapshots(program_id, fetched_at DESC);

-- Generic, source-backed structural drafts. These rows are not requirement
-- groups and cannot be published: they give a reviewer the exact heading,
-- prose, and course codes from an official snapshot without hardcoding a
-- program-specific requirement file.
CREATE TABLE IF NOT EXISTS program_requirement_draft_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES program_requirement_import_sources(id),
  program_id TEXT NOT NULL REFERENCES programs(id),
  source_url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  extractor_version INTEGER NOT NULL,
  candidate_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(source_id, content_hash, extractor_version)
);
CREATE INDEX IF NOT EXISTS idx_program_requirement_draft_candidates_program
  ON program_requirement_draft_candidates(program_id, created_at DESC);

-- One bounded result for each generic second-level source lookup. This avoids
-- re-crawling overview pages that do not provide an explicitly labelled
-- major-requirements link, while keeping the result as private draft data.
CREATE TABLE IF NOT EXISTS program_requirement_source_discovery_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_source_id TEXT NOT NULL REFERENCES program_requirement_import_sources(id),
  program_id TEXT NOT NULL REFERENCES programs(id),
  discovery_kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('found', 'no_link', 'error')),
  discovered_source_url TEXT,
  checked_at INTEGER NOT NULL,
  note TEXT,
  UNIQUE(parent_source_id, discovery_kind)
);
CREATE INDEX IF NOT EXISTS idx_program_requirement_source_discovery_attempts_program
  ON program_requirement_source_discovery_attempts(program_id, discovery_kind);
