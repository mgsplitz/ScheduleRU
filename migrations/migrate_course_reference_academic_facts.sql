-- Existing-database migration for stable, source-addressed prerequisite facts.
-- Apply once after confirming these columns are absent.

ALTER TABLE course_reference ADD COLUMN catalog_prereqs TEXT NOT NULL DEFAULT '';
ALTER TABLE course_reference ADD COLUMN catalog_restrictions TEXT NOT NULL DEFAULT '';
ALTER TABLE course_reference ADD COLUMN source_year INTEGER;
ALTER TABLE course_reference ADD COLUMN source_term TEXT;
