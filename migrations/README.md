# D1 structural migrations

This directory is the only repository boundary for SQL. Files create or alter
database structure; reviewed academic content is restored through the catalog,
reference-data, and catalog-source contracts.

Run commands from `worker/` so Wrangler loads the correct project:

```sh
npx wrangler d1 execute rutgers_courses_dev \
  --env dev \
  --remote \
  --file=../migrations/<file>.sql
```

Production execution requires explicit approval.

## New development database

Apply the two base schemas first:

1. `schema.sql`
2. `schema_programs.sql`

Then apply the additive files needed by the current application:

1. `schema_requirement_course_metadata.sql`
2. `schema_program_catalog_imports.sql`
3. `migrate_program_catalog_source_ownership.sql`
4. `schema_program_requirement_imports.sql`
5. `migrate_requirement_draft_candidates.sql`
6. `migrate_requirement_source_discovery_attempts.sql`
7. `schema_program_provenance_and_eligibility.sql`
8. `schema_program_requirement_evidence.sql`
9. `schema_requirement_course_selectors.sql`
10. `schema_requirement_course_equivalencies.sql`
11. `schema_shared_requirement_sets.sql`
12. `schema_curriculum_modules.sql`
13. `schema_school_profiles.sql`
14. `schema_program_selection_policies.sql`
15. `schema_program_selection_same_family_policy.sql`
16. `schema_double_count_policies.sql`
17. `schema_course_eligibility_conditions.sql`
18. `schema_ap_equivalencies.sql`

`schema_requirement_context_and_overlap_exceptions.sql` is retained for older
databases; its tables are already present in the current base program schema.

After structure is ready, restore the reviewed data snapshots through their
development-only contributor commands. SQL must not be used to seed catalog or
policy content.

## Existing databases

The following compatibility migrations add columns that the current base
schemas already contain:

- `migrate_program_academic_metadata.sql`
- `migrate_requirement_display_families.sql`
- `migrate_requirement_import_source_kinds.sql`

Apply an existing-database migration only after checking the target schema.
SQLite `ALTER TABLE ... ADD COLUMN` is intentionally not replay-safe when the
column already exists.
