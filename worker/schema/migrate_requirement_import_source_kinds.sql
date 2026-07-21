-- One-time migration for databases that already have
-- program_requirement_import_sources from schema_program_requirement_imports.sql.
ALTER TABLE program_requirement_import_sources
  ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'profile';
CREATE INDEX IF NOT EXISTS idx_program_requirement_import_sources_kind
  ON program_requirement_import_sources(school_slug, source_kind, enabled);
