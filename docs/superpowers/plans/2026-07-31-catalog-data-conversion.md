# Catalog Data Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace program-specific reviewed SQL content with validated generic catalog definitions while proving development API parity.

**Architecture:** Export reviewed D1 rows through a program-neutral repository adapter, validate them through `@scheduleru/catalog`, and produce a deterministic JSON Lines snapshot. Republish through the existing development-only transactional boundary and compare normalized public API responses before deleting legacy content scripts.

**Tech Stack:** Node.js 26, TypeScript, Node test runner, Cloudflare Workers, D1, JSON Lines.

## Global Constraints

- Work from verified `dev` commit `4368d67`.
- Do not mutate or deploy production.
- Do not add named-program behavior to code.
- Do not remove a legacy data source before exported parity is proven.
- Preserve all current public API and planner behavior.
- Keep the existing dirty `dev` checkout untouched.

---

### Task 1: Complete the generic rule contract

**Files:**
- Modify: `packages/catalog/src/model.ts`
- Modify: `packages/catalog/src/validation.ts`
- Modify: `packages/catalog/test/validation.test.ts`

**Interfaces:**
- Produces: support for `max_credits` and `min_distinct_children`.
- Produces: legacy export normalization from `max` to `max_courses`.

- [ ] Write failing tests for the complete rule/count vocabulary.
- [ ] Verify the tests fail for the two missing rule kinds.
- [ ] Implement program-neutral rule validation.
- [ ] Run catalog, type, and legacy tests.
- [ ] Commit as `feat: complete generic requirement vocabulary`.

### Task 2: D1 program-definition exporter

**Files:**
- Create: `packages/catalog/src/exporter.ts`
- Create: `packages/catalog/test/exporter.test.ts`
- Modify: `packages/catalog/src/index.ts`

**Interfaces:**
- Produces: `listReviewedProgramIds(database)`.
- Produces: `exportProgramDefinition(database, programId)`.
- Consumes: a D1-compatible read adapter with prepared statements.

- [ ] Write failing tests using a recording/result D1 fake.
- [ ] Cover sources, hierarchy, course metadata, selectors, conditions,
  evidence, eligibility, stable source IDs, JSON decoding, legacy `max`
  normalization, missing programs, and invalid exported definitions.
- [ ] Implement bounded generic queries and deterministic row conversion.
- [ ] Validate the resulting definition before returning it.
- [ ] Run all checks and commit as `feat: export catalog definitions from D1`.

### Task 3: Export API and snapshot CLI

**Files:**
- Modify: `worker/src/catalog-admin.js`
- Modify: `worker/tests/catalog-admin.test.mjs`
- Modify: `tools/catalog/src/cli.ts`
- Modify: `tools/catalog/test/cli.test.ts`
- Create: `packages/catalog/src/snapshot.ts`
- Create: `packages/catalog/test/snapshot.test.ts`

**Interfaces:**
- Produces: `GET /api/admin/catalog/program-definitions`.
- Produces: `GET /api/admin/catalog/program-definitions/:programId`.
- Produces: `catalog snapshot --api <dev-url> --output <file>`.
- Produces: canonical JSON Lines plus SHA-256 manifest.

- [ ] Write failing route, CLI, and snapshot tests.
- [ ] Implement authenticated reviewed-program listing and export.
- [ ] Implement deterministic snapshot serialization and full-file validation.
- [ ] Ensure secrets never enter arguments, output, or snapshot content.
- [ ] Run all checks and commit as `feat: add reviewed catalog snapshots`.

### Task 4: Development export and validation

**Files:**
- Create: `catalog/snapshots/reviewed-programs.v1.jsonl`
- Create: `catalog/snapshots/reviewed-programs.v1.manifest.json`

**Interfaces:**
- Consumes: deployed development export routes.
- Produces: all 49 reviewed definitions ordered by program ID.

- [ ] Deploy the additive Worker changes to development only.
- [ ] Export the reviewed catalog.
- [ ] Validate every definition and the manifest digest locally.
- [ ] Classify failures by generic contract gap; never patch a named program.
- [ ] Correct systemic gaps with failing tests and repeat until all definitions validate.
- [ ] Commit as `data: snapshot reviewed catalog definitions`.

### Task 5: Development round-trip parity

**Files:**
- Create: `tools/catalog/src/parity.ts`
- Create: `tools/catalog/test/parity.test.ts`
- Create: `docs/architecture/catalog-data-parity.md`

**Interfaces:**
- Produces: normalized before/after response comparison.
- Consumes: reviewed snapshot and development public/admin APIs.

- [ ] Write failing normalization and mismatch-report tests.
- [ ] Implement public program/requirement capture.
- [ ] Capture development responses before publication.
- [ ] Republish all validated definitions to development.
- [ ] Capture after responses and require zero academic differences.
- [ ] Record counts, hashes, commands, and any timestamp-only exclusions.
- [ ] Commit as `test: prove catalog round-trip parity`.

### Task 6: Remove legacy content SQL

**Files:**
- Delete: `worker/schema/review_*.sql` program content files
- Delete: `worker/schema/seed_*.sql` program draft files after snapshot coverage
- Modify: program-data tests under `worker/tests`
- Create: `tools/database/src/catalog-restore.ts`
- Create: `tools/database/test/catalog-restore.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: validated snapshot restoration into an empty compatible database.

- [ ] Inventory exact SQL files and map each reviewed/draft record to snapshot coverage.
- [ ] Rewrite data tests to assert generic definition behavior.
- [ ] Write a failing restore test against a D1-compatible fake.
- [ ] Implement validate-before-write snapshot restoration.
- [ ] Delete only fully covered content SQL.
- [ ] Run the complete suite and development Worker dry-run.
- [ ] Commit as `refactor: replace catalog SQL with validated snapshot`.

### Task 7: Milestone completion

**Files:**
- Modify: `docs/architecture/catalog-data-conversion.md`
- Modify: `docs/catalog-contributor/README.md`
- Modify: `README.md`

**Interfaces:**
- Produces: current operating, restore, contribution, and rollback guidance.

- [ ] Run `npm test`, `npm run typecheck`, Worker dry-run, snapshot validation,
  and `git diff --check`.
- [ ] Confirm no production deployment or mutation occurred.
- [ ] Record exact removed files and remaining structural migrations.
- [ ] Merge into `dev` only after the merged result repeats all verification.
