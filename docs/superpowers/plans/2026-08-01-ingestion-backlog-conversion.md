# Ingestion Backlog Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve mutable catalog-review notes outside legacy SQL, move reviewed-program tests to the canonical catalog snapshot, and remove redundant reviewed SQL without migrating incomplete drafts prematurely.

**Architecture:** `packages/catalog-ingestion` owns only mutable review workflow state. Reviewed program definitions remain in `packages/catalog`; shared school and policy configuration remains in `packages/reference-data`. Snapshot-backed tests load definitions through one helper so a program-data change touches its definition and tests, not application code or SQL.

**Tech Stack:** TypeScript, Node test runner, Cloudflare Workers, D1, canonical JSON snapshots.

## Global Constraints

- Never modify `main` or production Cloudflare resources.
- Secrets remain in environment variables.
- Preserve the two genuine `seed_*.sql` draft files until contract-valid draft definitions replace them.
- Delete a reviewed SQL file only after every row it owns exists in a validated snapshot.
- Run `npm test`, `npm run typecheck`, and `git diff --check` before integration.

---

### Task 1: Review-backlog contract and recovery

**Files:**
- Create: `packages/catalog-ingestion/src/model.ts`
- Create: `packages/catalog-ingestion/src/validation.ts`
- Create: `packages/catalog-ingestion/src/snapshot.ts`
- Create: `packages/catalog-ingestion/src/exporter.ts`
- Create: `packages/catalog-ingestion/src/publisher.ts`
- Test: `packages/catalog-ingestion/test/*.test.ts`

**Interfaces:**
- Produces: `CatalogReviewBacklog`, `validateCatalogReviewBacklog`, `exportCatalogReviewBacklog`, `publishCatalogReviewBacklog`, and digest-checked snapshot functions.
- Natural note key: `program_id + section_name + raw_text`; D1 autoincrement IDs are operational and excluded.

- [ ] Write failing validation, snapshot, exporter, and publisher tests.
- [ ] Run package tests and confirm missing-interface failures.
- [ ] Implement the minimal fail-closed contract and D1 adapters.
- [ ] Run package tests and TypeScript checks.
- [ ] Commit the package checkpoint.

### Task 2: Development-only API and CLI

**Files:**
- Create: `worker/src/catalog-ingestion-admin.js`
- Create: `worker/tests/catalog-ingestion-admin.test.mjs`
- Create: `tools/catalog-ingestion/src/cli.ts`
- Create: `tools/catalog-ingestion/test/cli.test.ts`
- Modify: `worker/src/worker.js`
- Modify: `package.json`

**Interfaces:**
- Produces: authenticated development-only `GET|PUT /api/admin/catalog-ingestion/review-backlog`.
- Produces: `validate`, `snapshot`, `restore`, and `round-trip` CLI commands.

- [ ] Write failing Worker and CLI tests for authentication, production rejection, tamper detection, and transactional restore.
- [ ] Implement the guarded route and commands.
- [ ] Run focused tests, full tests, typechecking, and Worker dry-run.
- [ ] Commit the endpoint/tooling checkpoint.

### Task 3: Live snapshot and parity

**Files:**
- Create: `catalog/ingestion/review-backlog.v1.json`
- Create: `catalog/ingestion/review-backlog.v1.manifest.json`
- Create: `catalog/ingestion/review-backlog.v1.parity.json`

**Interfaces:**
- Consumes: development D1 and Task 2 commands.
- Produces: recoverable inventory for all resolved and unresolved review notes.

- [ ] Export development review notes.
- [ ] Record a development recovery bookmark.
- [ ] Restore the signed snapshot.
- [ ] Re-export and require an exact semantic digest.
- [ ] Commit the snapshot and parity proof.

### Task 4: Snapshot-backed reviewed-program tests

**Files:**
- Create: `worker/tests/helpers/catalog-snapshot.mjs`
- Modify: reviewed SAS/RBS tests currently reading `review_*.sql`.

**Interfaces:**
- Produces: `programDefinition(id)`, `groupDefinition(programId, groupId)`, `courseCodes(programId)`, and selector/evidence lookup helpers.

- [ ] Write a failing helper test for missing, duplicate, and known program IDs.
- [ ] Implement the shared snapshot reader.
- [ ] Convert each reviewed SQL test to semantic assertions against program/reference/backlog snapshots.
- [ ] Run each converted test after its change.
- [ ] Commit tests in small school/program-family batches.

### Task 5: Remove covered reviewed SQL

**Files:**
- Delete: fully covered `worker/schema/review_*.sql`
- Preserve: `worker/schema/seed_rbs_areas_of_study_draft.sql`
- Preserve: `worker/schema/seed_sas_ppe_draft.sql`
- Modify: contributor and architecture documentation.

**Interfaces:**
- Consumes: reviewed catalog snapshot, reference-data snapshot, and review-backlog snapshot.
- Produces: structural SQL only plus two explicitly documented temporary draft seeds.

- [ ] Inventory every table written by each candidate SQL file.
- [ ] Prove each written dataset is represented by one of the three snapshots.
- [ ] Delete only fully covered reviewed SQL.
- [ ] Require repository search to find no test or documentation dependency on deleted files.
- [ ] Run the full verification suite and Worker dry-run.
- [ ] Commit and fast-forward the checkpoint into `dev`.
