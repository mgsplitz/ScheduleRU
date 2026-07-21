# Source-First Major Requirement Discovery Implementation Plan

> **For agentic workers:** Execute inline task-by-task with `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Discover and snapshot each SAS major's official department requirement page without per-major SQL, while exposing only complete reviewed program audits.

**Architecture:** SAS profile pages remain directory identities. A generic parser extracts the profile's Major Web Page link, stores it as a typed D1 source, and snapshots it with the content-hash importer. Catalog and raw-source records remain private until reviewed evidence makes them safe to publish.

**Tech Stack:** Cloudflare Workers, D1/SQLite, Node.js built-in test runner, vanilla JavaScript.

## Global Constraints

- Scope new importer work to `school=sasnb` and `type=major`; do not discover, parse, or alter minors.
- Preserve existing reviewed audits.
- Do not add per-major course lists or requirements to frontend code or seed SQL.
- Accept only official HTTPS `*.rutgers.edu` links discovered from SAS profiles.
- A source snapshot remains draft-only and cannot change review status.
- Catalog-only and raw-source-only records are hidden from public program and requirement routes.

---

### Task 1: Parse official major links from SAS profiles

**Files:**
- Modify: `worker/src/program-requirement-import.js`
- Modify: `worker/tests/program-requirement-import.test.mjs`

**Interfaces:** Add `discoverProfileRequirementPage(html, profileSource, programType)`. It returns `{ source_url, source_title: "Official major requirements", source_kind: "requirements_page" }` or `null`.

- [ ] **Step 1: Write failing tests**

    test("a SAS profile yields its official Major Web Page", () => {
      const result = discoverProfileRequirementPage(
        '<li class="major-url"><a href="https://math.rutgers.edu/majors">Major Web Page</a></li>',
        SOURCE, "major",
      );
      assert.deepEqual(result, {
        source_url: "https://math.rutgers.edu/majors",
        source_title: "Official major requirements",
        source_kind: "requirements_page",
      });
    });

    test("discovery rejects minor and non-Rutgers links", () => {
      assert.equal(discoverProfileRequirementPage('<a href="https://example.com/x">Major Web Page</a>', SOURCE, "major"), null);
      assert.equal(discoverProfileRequirementPage('<a href="https://math.rutgers.edu/minor">Minor Web Page</a>', SOURCE, "major"), null);
    });

- [ ] **Step 2: Verify red**
  Run: `node --test tests/program-requirement-import.test.mjs`
  Expected: failure because `discoverProfileRequirementPage` is not exported.

- [ ] **Step 3: Implement the smallest extractor**
  Parse anchors, require the normalized label `major web page`, resolve it against `profileSource.source_url`, and return null unless it is HTTPS, has no credential component, and its hostname ends in `.rutgers.edu`. Return null for every program type other than `major`.

- [ ] **Step 4: Verify green**
  Run: `node --test tests/program-requirement-import.test.mjs`
  Expected: all tests pass.

- [ ] **Step 5: Commit**
  Run: `git add worker/src/program-requirement-import.js worker/tests/program-requirement-import.test.mjs && git commit -m "Parse official major requirement links"`

### Task 2: Persist typed sources and discover SAS major detail pages in batches

**Files:**
- Create: `worker/schema/migrate_requirement_import_source_kinds.sql`
- Modify: `worker/schema/schema_program_requirement_imports.sql`
- Modify: `worker/src/programs.js`
- Modify: `worker/tests/program-requirement-source-integration.test.mjs`

**Interfaces:** Add `source_kind TEXT NOT NULL DEFAULT 'profile'`; add `discoverMajorRequirementSources(env, schoolSlug, batchLimit)`; add protected `POST /api/admin/requirement-sources/discover?school=sasnb&limit=25`.

- [ ] **Step 1: Write a failing integration test**

    test("major discovery stores typed detail sources without publishing audits", async () => {
      const [schema, migration, worker] = await Promise.all([
        readFile(new URL("../schema/schema_program_requirement_imports.sql", import.meta.url), "utf8"),
        readFile(new URL("../schema/migrate_requirement_import_source_kinds.sql", import.meta.url), "utf8"),
        readFile(new URL("../src/programs.js", import.meta.url), "utf8"),
      ]);
      assert.match(schema, /source_kind TEXT NOT NULL DEFAULT 'profile'/);
      assert.match(migration, /ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'profile'/);
      assert.match(worker, /\/api\/admin\/requirement-sources\/discover/);
      assert.match(worker, /type = 'major'/);
      assert.doesNotMatch(worker, /UPDATE programs SET[\s\S]{0,160}review_status = 'reviewed'/);
    });

- [ ] **Step 2: Verify red**
  Run: `node --test tests/program-requirement-source-integration.test.mjs`
  Expected: failure because source kinds and the discovery route do not exist.

- [ ] **Step 3: Implement the schema and route**
  Create the migration `ALTER TABLE program_requirement_import_sources ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'profile';` plus index `(school_slug, source_kind, enabled)`. Update the create-table schema. Select active catalog rows only where school is SAS, type is major, and no `requirements_page` source exists. Fetch profile HTML, call `discoverProfileRequirementPage`, insert a deterministic detail-source ID, and run at most 25 through `ctx.waitUntil`. Do not modify `programs.review_status`.

- [ ] **Step 4: Verify focused checks**
  Run: `node --test tests/program-requirement-import.test.mjs tests/program-requirement-source-integration.test.mjs && node --check src/programs.js && git diff --check`
  Expected: all checks pass.

- [ ] **Step 5: Commit**
  Run: `git add worker/schema/migrate_requirement_import_source_kinds.sql worker/schema/schema_program_requirement_imports.sql worker/src/programs.js worker/tests/program-requirement-source-integration.test.mjs && git commit -m "Discover SAS major requirement sources"`

### Task 3: Hide incomplete programs from public routes

**Files:**
- Modify: `worker/src/programs.js`
- Modify: `worker/tests/program-catalog-publication.test.mjs`
- Modify: `worker/tests/program-catalog-import-api.test.mjs`

**Interfaces:** `GET /api/programs` returns only evidence-complete `review_status = 'reviewed'` records. `GET /api/programs/:id/requirements` returns 404 for catalog-listed and raw-source-only records. Batch requirement reads and program-selection validation exclude those same records.

- [ ] **Step 1: Write failing policy tests**

    test("catalog-only programs are excluded while reviewed audits remain public", async () => {
      const worker = await readFile(new URL("../src/programs.js", import.meta.url), "utf8");
      assert.doesNotMatch(worker, /review_status = 'catalog_listed' AND catalog_active = 1/);
      assert.match(worker, /WHERE review_status = 'reviewed'/);
    });

  Add an assertion that the requirements lookup has no catalog-listed alternative.

- [ ] **Step 2: Verify red**
  Run: `node --test tests/program-catalog-publication.test.mjs tests/program-catalog-import-api.test.mjs`
  Expected: failure because catalog-listed programs are public today.

- [ ] **Step 3: Implement public gating**
  Replace public program predicates with `review_status = 'reviewed'`, retain `programHasCompleteRequirementEvidence`, and call `publishedCatalogPrograms([], reviewedPrograms)`. Require `review_status = 'reviewed'` in direct and batch requirement lookups and program-selection validation. Keep the batch response field `catalog_listed_program_ids` as an empty array for client compatibility. Do not delete catalog or source rows.

- [ ] **Step 4: Verify focused and full suites**
  Run: `node --test tests/program-catalog-publication.test.mjs tests/program-catalog-import-api.test.mjs && node --test tests/*.test.mjs`
  Expected: all tests pass, including reviewed-minor behavior.

- [ ] **Step 5: Commit**
  Run: `git add worker/src/programs.js worker/tests/program-catalog-publication.test.mjs worker/tests/program-catalog-import-api.test.mjs && git commit -m "Hide incomplete program audits"`

### Task 4: Apply and verify the generic development pipeline

**Files:** No additional repository files.

- [ ] **Step 1: Apply D1 migration**
  Run: `npx wrangler d1 execute rutgers_courses_dev --env dev --remote --file=schema/migrate_requirement_import_source_kinds.sql`
  Expected: succeeds once without inserting a degree requirement.

- [ ] **Step 2: Deploy development Worker**
  Run: `npx wrangler deploy --env dev`
  Expected: reports the development Worker URL and version ID.

- [ ] **Step 3: Discover and snapshot all SAS major sources**
  Call protected discovery batches until no major lacks a `requirements_page` source, then use the bounded import endpoint until each discovered source has a snapshot. Never store or log credentials in repository files.

- [ ] **Step 4: Verify behavior**
  Count D1 sources by `source_kind`, import status, and errors. Request `GET /api/programs?school=sasnb`; confirm catalog-only records are absent and existing evidence-complete programs remain present.

- [ ] **Step 5: Clean generated state and push**
  Remove `worker/.wrangler` if created. Leave user-owned `.DS_Store` untouched. Push `dev` after verification.
