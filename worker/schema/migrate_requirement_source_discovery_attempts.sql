-- Adds private, bounded second-level source discovery records. These rows
-- track source lookup outcomes only and cannot publish a program audit.
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
