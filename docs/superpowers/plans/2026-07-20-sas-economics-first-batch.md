# SAS Economics First Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reviewed SAS Economics B.A. and Quantitative Economics minor selectable on development, with source-backed requirements and no frontend exception.

**Architecture:** One idempotent D1 seed creates the SAS profile, its canonical NB Core attachment, two Economics programs, requirement trees, evidence rows, and their published incompatible pairing. Existing Worker evidence and selection-policy gates expose the data without a SAS-specific route.

**Tech Stack:** Cloudflare D1 SQL; JavaScript Worker tests (`node:test`); existing static HTML frontend.

## Global Constraints

- Rutgers–New Brunswick only; never modify production or production D1.
- Every visible group and course has reviewed HTTPS evidence.
- The major uses the Spring 2026 official Economics worksheet; the minor uses the current official Quantitative Economics minor page.
- Grades, GPA, residency, transfer, and declaration conditions are source-backed advisories, not automatic results.
- Program membership is only a finite source-backed course list; no title, subject, or current-term inference.

---

### Task 1: Define the batch contract before seeding

**Files:**
- Create: `worker/tests/sas-economics-first-batch.test.mjs`
- Modify: `worker/tests/program-selection-policy.test.mjs`

**Interfaces:**
- Consumes: `worker/schema/review_sas_economics_batch_1.sql`.
- Produces: source/data contract tests and a pure major/minor exclusion regression.

- [x] **Step 1: Write the failing seed contract**

```js
const seed = await readFile(new URL("../schema/review_sas_economics_batch_1.sql", import.meta.url), "utf8");
assert.match(seed, /'sasnb-economics-major'/);
assert.match(seed, /'sasnb-quantitative-economics-minor'/);
assert.match(seed, /program_requirement_evidence/);
assert.match(seed, /'reviewed'/);
```

- [x] **Step 2: Prove the contract is initially red**

Run: `node --test worker/tests/sas-economics-first-batch.test.mjs`

Expected: fails because the reviewed seed does not exist.

- [x] **Step 3: Add the pure selection regression**

```js
const result = evaluateProgramSelection({
  homeSchoolSlug: "sasnb",
  selectedProgramIds: ["sasnb-economics-major", "sasnb-quantitative-economics-minor"],
  programs: [
    { id: "sasnb-economics-major", school_slug: "sasnb", type: "major" },
    { id: "sasnb-quantitative-economics-minor", school_slug: "sasnb", type: "minor" },
  ], limits: [], eligibilityRules: [],
  combinationPolicies: [{
    policy_key: "sasnb-economics-major-no-quantitative-economics-minor", home_school_slug: "sasnb",
    program_a_id: "sasnb-economics-major", program_b_id: "sasnb-quantitative-economics-minor",
    decision: "blocked", note: "Economics majors may not minor in Quantitative Economics.", source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/economics",
  }],
});
assert.equal(result.allowed, false);
```

- [x] **Step 4: Run focused tests**

Run: `node --test worker/tests/sas-economics-first-batch.test.mjs worker/tests/program-selection-policy.test.mjs`

Expected: selection regression passes; contract fails for missing seed.

### Task 2: Seed reviewed SAS/Economics data

**Files:**
- Create: `worker/schema/review_sas_economics_batch_1.sql`
- Modify: `worker/tests/sas-economics-first-batch.test.mjs`

**Interfaces:**
- Consumes: existing school profile, curriculum, program, requirement, evidence, and selection policy tables.
- Produces: `sasnb`, `sasnb-economics-major`, and `sasnb-quantitative-economics-minor` public data.

- [x] **Step 1: Add profile, canonical Core attachment, and two reviewed program rows**

```sql
INSERT INTO school_profiles (..., review_status) VALUES ('sasnb', ..., 'reviewed')
ON CONFLICT(slug) DO UPDATE SET ...;
INSERT INTO school_curriculum_modules (..., review_status) VALUES
  ('sasnb', 'core_curriculum', 'rutgers-nb-core-curriculum', ..., 'reviewed')
ON CONFLICT(school_slug, module_type) DO UPDATE SET ...;
```

- [x] **Step 2: Add finite requirements and reviewed evidence**

Seed the major’s seven core courses, four lower and thirty upper Economics electives, and three named outside-department lower electives from the Spring 2026 worksheet. Seed the minor’s five core courses and ten named upper electives from its official page. Every group and course receives an evidence row.

- [x] **Step 3: Add source-backed policy/advisory data**

```sql
INSERT INTO program_combination_policies (...)
VALUES ('sasnb-economics-major-no-quantitative-economics-minor', 'sasnb',
  'sasnb-economics-major', NULL, NULL, 'sasnb-quantitative-economics-minor', NULL, NULL,
  'blocked', 'Economics (220) majors may not minor in Quantitative Economics (221).', ..., strftime('%s','now') * 1000)
ON CONFLICT(policy_key) DO UPDATE SET ...;
```

Add source-backed advisory eligibility rules for grade/GPA/residency/declaration conditions; never encode them as automatic failures.

- [x] **Step 4: Tighten and run focused tests**

Run: `node --test worker/tests/sas-economics-first-batch.test.mjs worker/tests/program-selection-policy.test.mjs`

Expected: all focused tests pass.

### Task 3: Verify and release only development

**Files:**
- Modify: `docs/superpowers/plans/2026-07-20-sas-economics-first-batch.md`

**Interfaces:**
- Consumes: committed seed and test suite.
- Produces: D1-seeded development data and a pushed `dev` batch; production is unchanged.

- [x] **Step 1: Run full verification**

Run: `node --test worker/tests/*.test.mjs` and the existing `index.html` planner-script syntax check.

Expected: zero failures and valid browser script syntax.

- [x] **Step 2: Seed development D1 only**

Run: `npx wrangler d1 execute rutgers_courses_dev --env dev --remote --file=schema/review_sas_economics_batch_1.sql`

Expected: idempotent reviewed data is processed; no Worker deployment is necessary.

- [x] **Step 3: Verify public development routes**

Request `/api/schools`, `/api/programs?school=sasnb`, `/api/programs/sasnb-economics-major/requirements`, and `/api/program-selection-check` for the blocked pair.

Expected: SAS, both Economics paths, requirement trees, and exclusion are public; PPE stays absent.

- [ ] **Step 4: Commit, merge into `dev`, and push**

```bash
git add worker/schema/review_sas_economics_batch_1.sql worker/tests/sas-economics-first-batch.test.mjs worker/tests/program-selection-policy.test.mjs docs/superpowers/plans/2026-07-20-sas-economics-first-batch.md
git commit -m "feat: add reviewed SAS economics programs"
git push origin dev
```
