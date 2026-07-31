-- Requirement display families (v1)
--
-- A school can have one shared requirement with reviewed variants. For
-- example, every RBS-NB major has a Business Core, but Accounting replaces
-- two generic Core courses with its required accounting versions. A display
-- family prevents the UI from showing both copies while keeping every
-- requirement tree source-backed and auditable.
--
-- Run once after schema_programs.sql, against the intended environment:
--   npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/migrate_requirement_display_families.sql

ALTER TABLE requirement_groups ADD COLUMN display_family TEXT;
ALTER TABLE requirement_groups ADD COLUMN display_priority INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_reqgroups_display_family
  ON requirement_groups(display_family, display_priority);

UPDATE requirement_groups
SET display_family = 'rbsnb-business-core',
    display_priority = CASE
      WHEN program_id = 'rbsnb-accounting' THEN 100
      ELSE 10
    END
WHERE name = 'Business Core'
  AND program_id IN (
    'rbsnb-accounting',
    'rbsnb-bait',
    'rbsnb-finance',
    'rbsnb-leadership-management',
    'rbsnb-marketing',
    'rbsnb-supply-chain-management'
  );
