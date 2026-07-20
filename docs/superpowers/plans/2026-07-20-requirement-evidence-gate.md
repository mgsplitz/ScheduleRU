# Requirement Evidence Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a newly imported program out of every public program-selection and requirement route until each of its requirement groups and listed courses has reviewed, source-backed evidence.

**Architecture:** Add a per-program opt-in gate so reviewed RBS data stays public without a retroactive bulk migration. A normalized `program_requirement_evidence` table records a reviewed source for each requirement group and requirement-course row; the Worker consults the gate in listing, direct requirement, and selection-comparison routes. PPE enters only as an unreviewed development draft, preserving its current official-source blockers.

**Tech Stack:** Cloudflare Workers, D1/SQLite migrations, ECMAScript modules, Node built-in test runner.

## Global Constraints

- Rutgers-New Brunswick data only; do not infer Newark or Camden equivalents.
- Do not expose a program, school profile, requirement, or policy marked `unreviewed` or `needs_fix`.
- A requirement fact must retain an official HTTPS source URL, source title, source catalog-year boundary (or an explicit current-source-only note), retrieval timestamp, and reviewer note.
- Existing reviewed RBS behavior must remain unchanged while it uses the legacy program-level gate.
- No D1 deployment or production change belongs to this plan.

---

## File structure

- `worker/schema/schema_program_requirement_evidence.sql`: additive D1 migration for the evidence table and the opt-in flag on `programs`.
- `worker/src/requirement-evidence.js`: pure validation for the evidence manifest returned from D1.
- `worker/src/programs.js`: fetches evidence for opt-in programs and rejects incomplete programs from public routes.
- `worker/tests/requirement-evidence.test.mjs`: unit coverage for legacy, complete, missing, stale, and malformed evidence records.
- `worker/tests/program-requirement-evidence-integration.test.mjs`: asserts that public listing, requirement loading, and selection checking use the evidence gate.
- `worker/schema/seed_sas_ppe_draft.sql`: unreviewed, development-only source transcription for PPE; it is deliberately not a public import.
- `worker/tests/sas-ppe-draft.test.mjs`: protects the SAS boundary and records the two unresolved PPE conditions.
- `SAS_PILOT_SOURCE_INVENTORY.md`: updates the current-source-only PPE evidence and explicit blocking facts.

### Task 1: Evidence schema and pure completeness contract

**Files:**

- Create: `worker/schema/schema_program_requirement_evidence.sql`
- Create: `worker/src/requirement-evidence.js`
- Create: `worker/tests/requirement-evidence.test.mjs`

**Interfaces:**

- Consumes: D1 rows `{ entity_key, entity_type, group_id, course_code, source_url, source_title, source_catalog_year, accessed_at, reviewer_note, review_status }`.
- Produces: `requirementEvidenceComplete({ required, groups, courses, evidence }) -> boolean` and `missingRequirementEvidence({ groups, courses, evidence }) -> string[]`.

- [ ] **Step 1: Write the failing completeness test**

```js
test("an opt-in program requires reviewed evidence for every group and course", () => {
  const result = evidence.requirementEvidenceComplete({
    required: true,
    groups: [{ id: "sasnb-ppe-philosophy" }],
    courses: [{ group_id: "sasnb-ppe-philosophy", course_code: "01:730:107" }],
    evidence: [groupEvidence("sasnb-ppe-philosophy")],
  });
  assert.equal(result, false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test worker/tests/requirement-evidence.test.mjs`

Expected: FAIL because `worker/src/requirement-evidence.js` does not exist.

- [ ] **Step 3: Add the additive migration and pure implementation**

```sql
ALTER TABLE programs ADD COLUMN requirement_evidence_required INTEGER NOT NULL DEFAULT 0
  CHECK (requirement_evidence_required IN (0, 1));

CREATE TABLE IF NOT EXISTS program_requirement_evidence (
  entity_key TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('group', 'course')),
  group_id TEXT NOT NULL REFERENCES requirement_groups(id),
  course_code TEXT,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_catalog_year TEXT,
  accessed_at INTEGER NOT NULL,
  reviewer_note TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('unreviewed', 'reviewed', 'needs_fix')),
  CHECK ((entity_type = 'group' AND course_code IS NULL) OR (entity_type = 'course' AND course_code IS NOT NULL)),
  UNIQUE(program_id, entity_type, group_id, course_code)
);
```

```js
export function requirementEvidenceComplete({ required, groups = [], courses = [], evidence = [] } = {}) {
  if (!required) return true;
  return missingRequirementEvidence({ groups, courses, evidence }).length === 0;
}
```

The helper must require exactly one valid reviewed HTTPS row for `group:<group id>` and `course:<group id>:<course code>`; a blank title, blank reviewer note, absent retrieval time, non-HTTPS URL, or stale/unreviewed/needs-fix row is missing evidence.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test worker/tests/requirement-evidence.test.mjs && node --test worker/tests/*.test.mjs`

Expected: focused tests pass; existing tests stay green.

- [ ] **Step 5: Commit**

```bash
git add worker/schema/schema_program_requirement_evidence.sql worker/src/requirement-evidence.js worker/tests/requirement-evidence.test.mjs
git commit -m "feat: add reviewed requirement evidence gate"
```

### Task 2: Apply the gate to every public program route

**Files:**

- Modify: `worker/src/programs.js: public program-listing, requirement-loading, and selection-check routes`
- Create: `worker/tests/program-requirement-evidence-integration.test.mjs`

**Interfaces:**

- Consumes: `requirementEvidenceComplete` from `worker/src/requirement-evidence.js` and D1 evidence rows for an opt-in program.
- Produces: `programHasCompleteRequirementEvidence(env, program) -> Promise<boolean>`; it returns true for legacy programs and false for a required program with any missing evidence.

- [ ] **Step 1: Write the failing route-coverage test**

```js
test("public program listing, requirement loading, and selection reject incomplete opt-in evidence", () => {
  assert.match(worker, /programHasCompleteRequirementEvidence/);
  assert.match(worker, /path === "\\/api\\/programs"/);
  assert.match(worker, /path\.startsWith\("\\/api\\/programs\\/"\)/);
  assert.match(worker, /path === "\\/api\\/requirements"/);
  assert.match(worker, /path === "\\/api\\/program-selection-check"/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test worker/tests/program-requirement-evidence-integration.test.mjs`

Expected: FAIL because the Worker does not yet contain the gate.

- [ ] **Step 3: Fetch and validate evidence before returning public data**

```js
async function programHasCompleteRequirementEvidence(env, program) {
  if (Number(program?.requirement_evidence_required) !== 1) return true;
  const [groupsResult, coursesResult, evidenceResult] = await env.DB.batch([
    env.DB.prepare("SELECT id FROM requirement_groups WHERE program_id = ?").bind(program.id),
    env.DB.prepare("SELECT rc.group_id, rc.course_code FROM requirement_courses rc INNER JOIN requirement_groups g ON g.id = rc.group_id WHERE g.program_id = ?").bind(program.id),
    env.DB.prepare("SELECT entity_key, entity_type, group_id, course_code, source_url, source_title, source_catalog_year, accessed_at, reviewer_note, review_status FROM program_requirement_evidence WHERE program_id = ?").bind(program.id),
  ]);
  return requirementEvidenceComplete({ required: true, groups: groupsResult.results, courses: coursesResult.results, evidence: evidenceResult.results });
}
```

Use this helper to filter `/api/programs`, return 404 from `/api/programs/:id/requirements`, omit an incomplete program from `/api/requirements`, and reject it through `/api/program-selection-check`. Preserve the existing reviewed-status checks; evidence is an additional gate, never a replacement.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test worker/tests/program-requirement-evidence-integration.test.mjs && node --test worker/tests/*.test.mjs`

Expected: both commands pass with no RBS behavior change.

- [ ] **Step 5: Commit**

```bash
git add worker/src/programs.js worker/tests/program-requirement-evidence-integration.test.mjs
git commit -m "feat: hide incomplete requirement evidence"
```

### Task 3: Enter PPE as a non-public evidence draft

**Files:**

- Create: `worker/schema/seed_sas_ppe_draft.sql`
- Create: `worker/tests/sas-ppe-draft.test.mjs`
- Modify: `SAS_PILOT_SOURCE_INVENTORY.md`

**Interfaces:**

- Consumes: `https://philosophy.rutgers.edu/minor-in-philosophy-politics-and-economics` and `https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/philosophy-politics-and-economics-ppe`.
- Produces: a development-only `sasnb-ppe-minor` source draft with no reviewed program, school profile, group, course, or policy row.

- [ ] **Step 1: Write the failing source-boundary test**

```js
test("PPE remains an unreviewed Rutgers-New Brunswick draft until all automatic rules are source-complete", () => {
  assert.match(seed, /'sasnb-ppe-minor'/);
  assert.match(seed, /'792'/);
  assert.match(seed, /'unreviewed'/);
  assert.doesNotMatch(seed, /review_status\s*=\s*'reviewed'/);
  assert.match(inventory, /case-by-case/i);
  assert.match(inventory, /cross-listed/i);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test worker/tests/sas-ppe-draft.test.mjs`

Expected: FAIL because the draft seed and blocker text do not yet exist.

- [ ] **Step 3: Transcribe only known PPE facts as unreviewed data**

```sql
INSERT INTO programs (
  id, name, school_slug, program_slug, type, academic_program_code,
  source_url, review_status, requirement_evidence_required
) VALUES (
  'sasnb-ppe-minor', 'Philosophy, Politics, and Economics (PPE)', 'sasnb',
  'philosophy-politics-economics-ppe', 'minor', '792',
  'https://philosophy.rutgers.edu/minor-in-philosophy-politics-and-economics',
  'unreviewed', 1
);
```

Include only finite published course codes for Political Theory, Policy/Group Relations, Economics introductions, Economics elective, and named Philosophy lists. Record `source_catalog_year` as NULL with reviewer note `Current department page; no catalog-year boundary stated.` Do not add a reviewed SAS school profile, Political Science program, Core attachment, cross-list allocation map, or selector that treats case-by-case Philosophy approval as automatic.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test worker/tests/sas-ppe-draft.test.mjs && node --test worker/tests/*.test.mjs`

Expected: all tests pass and no public route gains a SAS selection.

- [ ] **Step 5: Commit**

```bash
git add worker/schema/seed_sas_ppe_draft.sql worker/tests/sas-ppe-draft.test.mjs SAS_PILOT_SOURCE_INVENTORY.md
git commit -m "docs: record non-public PPE evidence draft"
```

## Self-review

- **Spec coverage:** Task 1 records group/course provenance, Task 2 makes incomplete provenance fail closed in every public program path, and Task 3 captures official PPE facts while preserving the Political Science, case-by-case, and cross-list blockers. No SAS program becomes visible or deployable.
- **Placeholder scan:** no task relies on unspecified implementation or tests; the source boundary and exact commands are included.
- **Type consistency:** evidence entity keys are `group:<group id>` and `course:<group id>:<course code>` in the pure helper, schema rows, and Worker integration.

## Execution handoff

Use subagent-driven development: dispatch one fresh implementer and one controller review per task, update the durable task ledger after each accepted review, and do not deploy D1 or production as part of this plan.
