-- Adds generic, source-backed draft candidates to an existing requirement
-- import database. Candidate rows never populate published audit tables.
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
