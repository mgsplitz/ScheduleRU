# Refactor foundation verification

## Milestone result

The first incremental refactor milestone establishes a professional catalog
boundary without changing the deployed application or production data.

Completed:

- npm workspaces and pinned TypeScript/Wrangler tooling;
- repository and directory ownership instructions;
- contract-version-1 generic program definitions;
- fail-closed runtime validation with path-addressed issues;
- deterministic, program-scoped D1 publication in one transactional batch;
- bearer-authenticated, development-only validation/publication routes;
- local validation and safe development publication commands;
- a reusable catalog-only work-window handoff.

No named Rutgers program is encoded in the new package, publisher, API route,
or CLI.

## Verification evidence

From `codex/refactor-foundation`:

```text
npm test
  catalog and CLI: 21 passed, 0 failed
  legacy and Worker: 340 passed, 0 failed

npm run typecheck
  passed

npx wrangler deploy --dry-run --env dev
  passed; development bindings selected

git diff --check
  passed
```

The legacy suite began this milestone with 333 passing tests. Its seven new
catalog-admin tests account for the increase to 340; no prior test was removed.

## Compatibility surface

The following remain intentionally unchanged and deployable:

- root `index.html` and browser logic modules;
- existing public Worker routes and schedule assistant;
- browser `localStorage` schema;
- production and development D1 databases;
- existing program-specific reviewed SQL;
- current Pages and Worker deployment configuration.

The new route is additive. Publication requires the existing admin secret in a
bearer header and `ENVIRONMENT = "development"`. Production configuration is
explicitly marked `production`, so the route rejects its write request before
preparing D1 statements.

## Rollback

The milestone consists of isolated commits after production commit `2cdc254`.
The current application does not depend on catalog definitions being
published, so the branch can be abandoned without a data rollback. No remote
environment was mutated.

## Next conversion milestone

1. Build a legacy catalog exporter against a database initialized from the
   current structural and reviewed SQL.
2. Export every reviewed program into contract-version-1 definitions.
3. Validate every exported definition.
4. Publish definitions to development D1.
5. Compare `/api/programs`, individual requirement trees, policies, selectors,
   evidence, and eligibility responses before and after conversion.
6. Add an ordered structural migration runner.
7. Remove program-specific reviewed SQL only after full parity.

That conversion is the gate before frontend and planner package extraction.
