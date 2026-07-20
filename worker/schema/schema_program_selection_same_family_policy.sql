-- Same-program-family selection policy (v1)
--
-- A school can prohibit a major/minor combination only when both selected
-- programs share the reviewed academic-program family. This is data-driven:
-- the evaluator never needs to name a particular SAS major or minor.
--
-- Apply to one environment at a time. For development:
--   npx wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/schema_program_selection_same_family_policy.sql

ALTER TABLE program_combination_policies ADD COLUMN same_program_family INTEGER NOT NULL DEFAULT 0
  CHECK (same_program_family IN (0, 1));
