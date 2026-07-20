-- Directory ownership and identity overrides for source-backed program imports.
-- Apply after schema_program_catalog_imports.sql:
--   npx wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/migrate_program_catalog_source_ownership.sql

-- The official SAS directory also lists programs owned by partner schools.
-- A source declares its allowed owner labels in data, so imports cannot
-- accidentally publish a partner-school program as an SAS program.
ALTER TABLE program_catalog_sources ADD COLUMN owner_labels_json TEXT;

-- Imports take a short source-level lease. This prevents an older import from
-- retiring records after a newer directory import has already finished.
ALTER TABLE program_catalog_sources ADD COLUMN import_token TEXT;
ALTER TABLE program_catalog_sources ADD COLUMN import_started_at INTEGER;

CREATE TABLE IF NOT EXISTS program_catalog_identity_overrides (
  catalog_source_id TEXT NOT NULL REFERENCES program_catalog_sources(id),
  program_slug TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('major', 'minor')),
  program_id TEXT NOT NULL,
  PRIMARY KEY (catalog_source_id, program_slug, type)
);

UPDATE program_catalog_sources
SET owner_labels_json = '["SAS","SAS/ SC&I"]'
WHERE id = 'sasnb-official-directory';

-- These IDs are referenced by reviewed combination policies and must remain
-- stable for both the policies and existing saved program selections.
INSERT INTO program_catalog_identity_overrides (
  catalog_source_id, program_slug, type, program_id
) VALUES
  ('sasnb-official-directory', 'criminal-justice', 'major', 'sasnb-criminal-justice-major'),
  ('sasnb-official-directory', 'health-and-society', 'minor', 'sasnb-health-and-society-minor')
ON CONFLICT(catalog_source_id, program_slug, type) DO UPDATE SET
  program_id = excluded.program_id;
