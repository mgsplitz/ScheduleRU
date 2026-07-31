# Refactor Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish independently editable workspace boundaries and a generic, validated catalog publication path without disrupting the current application.

**Architecture:** Keep the current root frontend and `worker/` as compatibility surfaces while introducing npm workspaces and a typed catalog package. Publish complete program definitions through a transactional D1 service and an authenticated development-only route; program content never becomes a structural migration.

**Tech Stack:** Node.js 26, npm workspaces, TypeScript, Node test runner, Cloudflare Workers, D1.

## Global Constraints

- Start from confirmed production commit `2cdc254`.
- Preserve all current user-facing behavior and local-storage compatibility.
- Do not edit production data or deploy to production.
- Do not remove legacy reviewed SQL until parity conversion is complete.
- Do not hardcode any program-specific academic rule in application modules.
- Keep the existing dirty `dev` checkout untouched.

---

### Task 1: Workspace and ownership foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/catalog/package.json`
- Create: `packages/catalog/tsconfig.json`
- Create: `tools/catalog/package.json`
- Create: `AGENTS.md`
- Create: `packages/catalog/AGENTS.md`
- Create: `tools/catalog/AGENTS.md`

**Interfaces:**
- Produces: root `test`, `test:legacy`, `typecheck`, and `catalog` commands.
- Produces: workspace package `@scheduleru/catalog`.

- [ ] **Step 1: Add workspace manifests and ownership boundaries**

Define npm workspaces for `apps/*`, `packages/*`, and `tools/*`. Keep the
legacy Node test suite in `test:legacy`; `test` runs legacy and workspace
tests. Use `private: true` and ESM packages.

- [ ] **Step 2: Install the pinned TypeScript toolchain**

Run `npm install --save-dev typescript`. Commit the generated lockfile.

- [ ] **Step 3: Verify the unchanged baseline through the workspace command**

Run: `npm run test:legacy`
Expected: 333 tests pass.

- [ ] **Step 4: Commit**

Commit message: `build: establish refactor workspaces`

### Task 2: Versioned catalog contract and validator

**Files:**
- Create: `packages/catalog/src/model.ts`
- Create: `packages/catalog/src/validation.ts`
- Create: `packages/catalog/src/index.ts`
- Create: `packages/catalog/test/validation.test.ts`

**Interfaces:**
- Produces: `validateProgramDefinition(value: unknown): ValidationResult`.
- Produces: `assertProgramDefinition(value: unknown): ProgramDefinition`.
- Produces: `ProgramDefinition`, `RequirementGroupDefinition`,
  `ProgramSourceDefinition`, and `CourseSelectorDefinition`.

- [ ] **Step 1: Write failing validator tests**

Cover one valid nested definition and failures for an unsupported contract
version, unsafe identifiers, non-Rutgers/non-HTTPS sources, duplicate group
IDs, missing parents, cycles, unsupported rules, invalid counts, duplicate
course codes, malformed selectors, and reviewed entities without evidence.

- [ ] **Step 2: Run tests and verify the missing-module failure**

Run: `node --test packages/catalog/test/validation.test.ts`
Expected: FAIL because the catalog module does not exist.

- [ ] **Step 3: Implement the minimal typed contract and validator**

Return stable path-based issues. Normalize nothing silently; malformed input
fails closed. Accept only contract version `1`.

- [ ] **Step 4: Run catalog and legacy tests**

Run: `node --test packages/catalog/test/validation.test.ts`
Expected: PASS.

Run: `npm run test:legacy`
Expected: 333 tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat: define validated catalog contract`

### Task 3: Transactional D1 catalog publisher

**Files:**
- Create: `packages/catalog/src/publisher.ts`
- Create: `packages/catalog/test/publisher.test.ts`

**Interfaces:**
- Consumes: `ProgramDefinition`.
- Produces: `publishProgramDefinition(database, definition, options)`.
- Produces: `CatalogDatabase` and `CatalogPublishResult` adapter contracts.

- [ ] **Step 1: Write failing publisher tests**

Use a recording D1-compatible fake. Verify validation happens before writes,
the transaction is program-scoped, child rows are removed before parent rows,
upserts are deterministic, all reviewed evidence is written, identical input
produces identical statements, and a failed batch reports no successful
publication.

- [ ] **Step 2: Run tests and verify the missing-export failure**

Run: `node --test packages/catalog/test/publisher.test.ts`
Expected: FAIL because `publishProgramDefinition` is unavailable.

- [ ] **Step 3: Implement generic statement generation and publication**

Build ordered D1 statements exclusively from the validated definition. Use
stable timestamps supplied through options so tests and replays are
deterministic.

- [ ] **Step 4: Run package, type, and legacy checks**

Run: `npm test`
Expected: all catalog and 333 legacy tests pass.

Run: `npm run typecheck`
Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

Commit message: `feat: publish generic catalog definitions`

### Task 4: Development-only Worker publication route

**Files:**
- Create: `worker/src/catalog-admin.js`
- Create: `worker/tests/catalog-admin.test.mjs`
- Modify: `worker/src/programs.js`
- Modify: `worker/wrangler.toml`

**Interfaces:**
- Consumes: `POST /api/admin/catalog/program-definitions/validate`.
- Consumes: `PUT /api/admin/catalog/program-definitions/:programId`.
- Produces: validation issues or a `CatalogPublishResult`.

- [ ] **Step 1: Write failing route tests**

Verify authorization, development-only publication, path/body ID agreement,
validation-only behavior, malformed JSON handling, generic errors, and one
successful publication through the real publisher with a D1-compatible fake.

- [ ] **Step 2: Run tests and verify route absence**

Run: `node --test worker/tests/catalog-admin.test.mjs`
Expected: FAIL because the route handler does not exist.

- [ ] **Step 3: Implement the isolated route handler**

Use the existing admin secret value but accept it through an
`Authorization: Bearer` header. Preserve existing query-secret routes for
compatibility. Require `ENVIRONMENT = "development"` for writes.

- [ ] **Step 4: Connect the handler without adding program logic**

Route catalog-admin requests before the legacy admin block. Add
`ENVIRONMENT = "production"` and `ENVIRONMENT = "development"` to matching
Wrangler environments.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

Commit message: `feat: add development catalog publication API`

### Task 5: Catalog validation and publication CLI

**Files:**
- Create: `tools/catalog/src/cli.ts`
- Create: `tools/catalog/test/cli.test.ts`
- Create: `docs/catalog-contributor/README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: `npm run catalog -- validate <definition.json>`.
- Consumes: `npm run catalog -- publish <definition.json> --api <url>`.
- Uses: `SCHEDULERU_ADMIN_SECRET` environment variable.

- [ ] **Step 1: Write failing CLI behavior tests**

Execute the CLI as a subprocess. Verify valid/invalid exit codes, readable
path-based validation output, no secret in arguments or output, development
API URL enforcement, and exact request method/path/body through a local HTTP
server.

- [ ] **Step 2: Run tests and verify the missing CLI failure**

Run: `node --test tools/catalog/test/cli.test.ts`
Expected: FAIL because the CLI does not exist.

- [ ] **Step 3: Implement validate and publish commands**

Read JSON from disk, validate locally, and publish with a bearer token from
the environment. Reject production hostnames and non-HTTPS remote URLs.

- [ ] **Step 4: Document the narrow catalog contributor workflow**

Explain allowed directories, validation, development publication, provenance,
review expectations, production prohibition, and handoff requirements.

- [ ] **Step 5: Run all checks**

Run: `npm test`
Expected: all tests pass.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

Commit message: `feat: add safe catalog contributor workflow`

### Task 6: Milestone verification and compatibility report

**Files:**
- Create: `docs/architecture/refactor-foundation-verification.md`
- Modify: `README.md`

**Interfaces:**
- Produces: exact baseline, commands, boundaries, deferred conversion work,
  and rollback information.

- [ ] **Step 1: Run repository verification**

Run: `npm test`
Expected: all tests pass.

Run: `npm run typecheck`
Expected: no errors.

Run: `git diff --check`
Expected: no output.

- [ ] **Step 2: Verify no production deployment or data mutation occurred**

Inspect branch and Git history. Confirm all work is on
`codex/refactor-foundation`.

- [ ] **Step 3: Update the README architecture and development commands**

Keep public product information concise. Link to maintained architecture,
operations, and catalog-contributor documentation.

- [ ] **Step 4: Record the milestone result**

List the exact legacy compatibility surface and the next conversion milestone:
exporting every reviewed program into generic definitions, importing them into
development, comparing public API output, and then removing program SQL.

- [ ] **Step 5: Commit**

Commit message: `docs: record refactor foundation milestone`
