# ScheduleRU Hackathon Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved guest onboarding, deterministic four-year planner, active-term preference assistant, program-navigation cleanup, desktop polish, and hackathon-ready repository without using Sol for implementation.

**Architecture:** Add three pure browser-safe JavaScript modules for state normalization, four-year planning, and schedule preferences. Keep `index.html` as the UI integration shell, add one isolated Worker module for the OpenAI Responses API adapter, and preserve the reviewed D1 academic-rule boundary. Run independent pure-module tasks in parallel, then perform one controlled UI integration to avoid merge conflicts.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node `node:test`, Cloudflare Worker, D1, OpenAI Responses API with structured outputs, browser `localStorage`.

## Global Constraints

- Implementation agents must use `gpt-5.6-terra`; Sol coordinates and reviews but does not edit implementation code.
- Work from isolated feature worktrees based on `codex/hackathon-planning`; merge completed tracks into the integration worktree only after their focused tests pass.
- Do not merge to `main`, deploy production, or alter production D1 without explicit user approval.
- Preserve existing `.DS_Store`, `.wrangler/`, user plans, secrets, and unrelated worktree changes.
- Desktop is the release target; do not spend the hackathon window on a mobile/tablet redesign.
- Do not implement transcript/AP file parsing, accounts, summer/winter planning, future section forecasts, or unreviewed program publication.
- Use focused tests for pure rules and critical integration contracts. Do not introduce a large browser-testing framework.
- The OpenAI key must remain a Worker secret. Use `gpt-5.6-luna` with low reasoning for preference translation unless the environment overrides `SCHEDULE_ASSISTANT_MODEL`.
- AI output may update only a validated preference schema. Deterministic code remains the source of schedule indices, feasibility, conflicts, and tradeoffs.

---

## File structure and ownership

| Track | Files | Responsibility |
|---|---|---|
| State | `planner-state-logic.js`, `worker/tests/planner-state-logic.test.mjs` | State v3 migration, academic records, program roles, locks, generated preview, per-term preferences |
| Four-year engine | `four-year-planner-logic.js`, `worker/tests/four-year-planner-logic.test.mjs` | Deterministic term placement, workload, prerequisites, placeholders, partial-plan issues |
| Preference engine | `schedule-preference-logic.js`, `worker/tests/schedule-preference-logic.test.mjs` | Preference normalization/merge, schedule metrics, filtering/ranking, stable recommendations |
| Assistant/data Worker | `worker/src/schedule-assistant.js`, `worker/src/worker.js`, `worker/schema/schema_ap_equivalencies.sql`, `worker/tests/schedule-assistant.test.mjs`, `worker/tests/ap-equivalencies.test.mjs` | Server-side OpenAI structured-output adapter, active-term config, and reviewed AP-equivalency API |
| UI integrator | `index.html`, `worker/tests/hackathon-ui-integration.test.mjs` | Onboarding, header, programs, subtabs, issues, planner preview, active builder, assistant drawer |
| Release | `README.md`, `.gitignore`, `worker/wrangler.toml` | Public documentation, generated-state hygiene, model configuration documentation |

Parallel wave 1: Tasks 1–3.<br>
Parallel wave 2 after wave 1 merge: Tasks 4 and 7; Task 5 begins when Tasks 1–4 interfaces are present.<br>
Final integration: Tasks 6 and 8.

---

### Task 1: Versioned planner state and academic records

**Files:**
- Create: `planner-state-logic.js`
- Create: `worker/tests/planner-state-logic.test.mjs`
- Do not modify: `index.html` in this task

**Interfaces:**
- Consumes: current saved state objects shaped like the existing `ST` object in `index.html:633-695`.
- Produces: `globalThis.ScheduleRUPlannerStateLogic` with `STATE_VERSION`, `migratePlannerState(raw)`, `normalizeAcademicRecord(record)`, `academicCreditEntries(state)`, `termKey(term)`, `preferencesForTerm(state, term)`, and `withAcceptedPlan(state, preview)`.
- State version: `3`.

- [ ] **Step 1: Write failing migration and academic-record tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../planner-state-logic.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const logic = context.globalThis.ScheduleRUPlannerStateLogic;

test("migrates an existing plan without moving scheduled courses", () => {
  const state = logic.migratePlannerState({
    version: 2,
    schedule: { "01:198:111": { code: "01:198:111", year: 1, sem: "fall" } },
    selectedProgramIds: [12],
  });
  assert.equal(state.version, 3);
  assert.equal(state.schedule["01:198:111"].sem, "fall");
  assert.equal(state.schedule["01:198:111"].locked, true);
  assert.deepEqual(state.selectedProgramIds, [12]);
});

test("records AP 4 and 5 as reviewed-credit candidates and lower scores as unapplied", () => {
  assert.equal(logic.normalizeAcademicRecord({ type: "ap", exam: "Calculus AB", score: 4 }).creditStatus, "review_required");
  assert.equal(logic.normalizeAcademicRecord({ type: "ap", exam: "Calculus AB", score: 3 }).creditStatus, "not_applied");
});

test("accepting a preview replaces only the plan and clears the preview", () => {
  const state = logic.migratePlannerState({ version: 3, wishlist: { x: true } });
  const preview = { schedule: { a: { code: "a" } } };
  const accepted = logic.withAcceptedPlan({ ...state, generatedPlanPreview: preview }, preview);
  assert.deepEqual(accepted.wishlist, { x: true });
  assert.equal(accepted.generatedPlanPreview, null);
  assert.equal(accepted.schedule.a.code, "a");
});
```

- [ ] **Step 2: Run the focused test and confirm it fails on the missing public API**

Run: `node --test worker/tests/planner-state-logic.test.mjs`<br>
Expected: FAIL because `ScheduleRUPlannerStateLogic` does not yet expose the required functions. The test loader must convert a missing file/module into this explicit assertion failure rather than an uncaught loader error.

- [ ] **Step 3: Implement the state module**

```js
(function exposePlannerStateLogic(root) {
  const STATE_VERSION = 3;
  const COURSE_CODE = /^\d{2}:\d{3}:\d{3}$/;
  const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));
  const termKey = (term) => `${Number(term?.year)}:${String(term?.sem || "").toLowerCase()}`;

  function normalizeAcademicRecord(record = {}) {
    const type = ["ap", "rutgers_completed", "transfer"].includes(record.type) ? record.type : "transfer";
    const score = type === "ap" ? Number(record.score) : null;
    return {
      id: String(record.id || `${type}:${Date.now()}`),
      type,
      exam: String(record.exam || "").trim(),
      score: Number.isFinite(score) ? score : null,
      courseCode: COURSE_CODE.test(String(record.courseCode || "")) ? String(record.courseCode) : "",
      title: String(record.title || "").trim(),
      credits: Math.max(0, Number(record.credits) || 0),
      grade: String(record.grade || "").trim(),
      completedTerm: String(record.completedTerm || "").trim(),
      creditStatus: type === "ap" ? (score >= 4 ? "review_required" : "not_applied") : "applied",
      equivalentCourseCodes: Array.isArray(record.equivalentCourseCodes) ? [...new Set(record.equivalentCourseCodes.filter((code) => COURSE_CODE.test(code)))] : [],
    };
  }

  function migratePlannerState(raw = {}) {
    const state = clone(raw);
    state.version = STATE_VERSION;
    state.onboarding ||= { completed: false, step: 0 };
    state.academicPosition ||= { year: 1, startingSemester: "fall" };
    state.academicRecords = (state.academicRecords || []).map(normalizeAcademicRecord);
    state.primaryProgramId ??= state.selectedProgramIds?.[0] ?? null;
    state.secondaryProgramId ??= state.selectedProgramIds?.[1] ?? null;
    state.schedule ||= {};
    Object.values(state.schedule).forEach((entry) => { if (entry && entry.locked === undefined) entry.locked = true; });
    state.generatedPlanPreview ??= null;
    state.schedulePreferences ||= {};
    state.issueDismissals ||= {};
    return state;
  }

  function academicCreditEntries(state) {
    return (state?.academicRecords || []).filter((record) => record.creditStatus === "applied").map((record) => ({
      id: record.id,
      source: record.type === "transfer" ? "transfer" : "rutgers_completed",
      credits: record.credits,
      course_code: record.courseCode,
      equivalent_course_codes: record.equivalentCourseCodes,
    }));
  }

  const preferencesForTerm = (state, term) => clone(state?.schedulePreferences?.[termKey(term)] || { version: 1, constraints: [], messages: [] });
  function withAcceptedPlan(state, preview) {
    return { ...state, schedule: clone(preview?.schedule || {}), generatedPlanPreview: null };
  }

  root.ScheduleRUPlannerStateLogic = { STATE_VERSION, migratePlannerState, normalizeAcademicRecord, academicCreditEntries, termKey, preferencesForTerm, withAcceptedPlan };
})(globalThis);
```

- [ ] **Step 4: Run the focused test and then the existing eligibility tests**

Run: `node --test worker/tests/planner-state-logic.test.mjs worker/tests/eligibility-logic.test.mjs`<br>
Expected: PASS.

- [ ] **Step 5: Commit the isolated module**

```bash
git add planner-state-logic.js worker/tests/planner-state-logic.test.mjs
git commit -m "feat: add versioned planner state"
```

---

### Task 2: Deterministic four-year planning engine

**Files:**
- Create: `four-year-planner-logic.js`
- Create: `worker/tests/four-year-planner-logic.test.mjs`
- Do not modify: `index.html` in this task

**Interfaces:**
- Consumes: `{ terms, courses, completedCourseCodes, lockedPlacements, prerequisitePathsByCode, unresolvedRequirements, targetCredits, maxCredits }`.
- Produces: `globalThis.ScheduleRUFourYearPlanner` with `generatePlan(input)`, `normalizePlannerInput(input)`, and `createPlaceholder(requirement, ordinal)`.
- `generatePlan` returns `{ status, schedule, placeholders, issues, assumptions, termCredits }` where `status` is `complete` or `partial`.

- [ ] **Step 1: Write focused engine tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../four-year-planner-logic.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const logic = context.globalThis.ScheduleRUFourYearPlanner;

test("keeps locked placements and schedules prerequisites earlier", () => {
  const result = logic.generatePlan({
    terms: [{ year: 1, sem: "fall" }, { year: 1, sem: "spring" }],
    courses: [{ code: "01:198:111", credits: 4 }, { code: "01:198:112", credits: 4 }],
    lockedPlacements: { "01:198:112": { year: 1, sem: "spring", locked: true } },
    prerequisitePathsByCode: { "01:198:112": [["01:198:111"]] },
    targetCredits: 16,
    maxCredits: 18,
  });
  assert.equal(result.schedule["01:198:112"].sem, "spring");
  assert.equal(result.schedule["01:198:111"].sem, "fall");
});

test("uses a typed placeholder instead of inventing an unresolved Core course", () => {
  const result = logic.generatePlan({
    terms: [{ year: 1, sem: "fall" }],
    courses: [],
    unresolvedRequirements: [{ id: "ccd", label: "Core: Contemporary Challenges", credits: 3, sourceType: "core" }],
  });
  assert.equal(result.placeholders[0].label, "Core: Contemporary Challenges");
  assert.equal(result.placeholders[0].kind, "requirement_placeholder");
});

test("returns a partial plan instead of exceeding the hard credit cap", () => {
  const result = logic.generatePlan({
    terms: [{ year: 1, sem: "fall" }],
    courses: Array.from({ length: 7 }, (_, i) => ({ code: `01:198:${String(100 + i)}`, credits: 3 })),
    maxCredits: 18,
  });
  assert.equal(result.status, "partial");
  assert.ok(result.termCredits["1:fall"] <= 18);
  assert.ok(result.issues.some((issue) => issue.code === "courses_unplaced"));
});
```

- [ ] **Step 2: Run the test and confirm module absence**

Run: `node --test worker/tests/four-year-planner-logic.test.mjs`<br>
Expected: FAIL because `ScheduleRUFourYearPlanner.generatePlan` is not yet available. The test loader must report an assertion failure rather than an uncaught loader error.

- [ ] **Step 3: Implement deterministic normalized generation**

Implement these rules in `generatePlan` in this order:

```js
const DEFAULT_TARGET = 16;
const DEFAULT_MAX = 18;

// 1. Normalize and sort Fall/Spring terms with an internal termOrdinal helper.
// 2. Copy locked placements first; record an error issue if a locked term is invalid.
// 3. Remove completed courses from the pending set.
// 4. Topologically order pending courses from reviewed prerequisite paths.
// 5. For each pending course, choose the earliest term after one complete prerequisite path
//    whose credits remain <= maxCredits; break ties by lower term credits then course code.
// 6. Place unresolved requirement placeholders into the lowest-credit terms.
// 7. Return partial with courses_unplaced/cyclic_prerequisite issues when necessary.
```

Expose only data; do not read the DOM or `localStorage`. Treat a placeholder as a credit-balancing estimate that never satisfies a course prerequisite.

- [ ] **Step 4: Run engine and eligibility tests**

Run: `node --test worker/tests/four-year-planner-logic.test.mjs worker/tests/eligibility-logic.test.mjs worker/tests/requirement-group-logic.test.mjs`<br>
Expected: PASS.

- [ ] **Step 5: Commit the engine**

```bash
git add four-year-planner-logic.js worker/tests/four-year-planner-logic.test.mjs
git commit -m "feat: add deterministic four-year planner"
```

---

### Task 3: Deterministic semester preference engine

**Files:**
- Create: `schedule-preference-logic.js`
- Create: `worker/tests/schedule-preference-logic.test.mjs`
- Do not modify: `index.html` in this task

**Interfaces:**
- Produces: `globalThis.ScheduleRUPreferenceLogic` with `normalizePreferenceSet`, `mergePreferencePatch`, `scheduleMetrics`, `rankSchedules`, and `recommendSchedules`.
- Stable schedule identity is the original one-based permutation index.
- `recommendSchedules` returns `{ matches, tradeoffs, conflictSummary }` with at most three matches.

- [ ] **Step 1: Write filtering, accumulation, and stable-index tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../schedule-preference-logic.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const logic = context.globalThis.ScheduleRUPreferenceLogic;

test("hard earliest-start constraints reject early schedules", () => {
  const schedules = [
    { stableIndex: 1, meetings: [{ day: "M", start: 510, end: 590 }] },
    { stableIndex: 2, meetings: [{ day: "M", start: 600, end: 680 }] },
  ];
  const result = logic.recommendSchedules(schedules, { version: 1, constraints: [{ kind: "earliest_start", minutes: 540, strength: "hard" }] });
  assert.deepEqual(result.matches.map((item) => item.stableIndex), [2]);
});

test("preference patches accumulate without deleting earlier constraints", () => {
  const first = logic.mergePreferencePatch({ version: 1, constraints: [{ kind: "earliest_start", minutes: 540, strength: "hard" }] }, { constraints: [{ kind: "light_day", day: "F", maximumClasses: 2, strength: "soft" }] });
  assert.equal(first.constraints.length, 2);
});

test("recommendations preserve original indices and never exceed three", () => {
  const schedules = Array.from({ length: 10 }, (_, index) => ({ stableIndex: index + 10, meetings: [] }));
  assert.deepEqual(logic.recommendSchedules(schedules, { version: 1, constraints: [] }).matches.map((x) => x.stableIndex), [10, 11, 12]);
});
```

- [ ] **Step 2: Run the test and confirm module absence**

Run: `node --test worker/tests/schedule-preference-logic.test.mjs`<br>
Expected: FAIL because `ScheduleRUPreferenceLogic.recommendSchedules` is not yet available. The test loader must report an assertion failure rather than an uncaught loader error.

- [ ] **Step 3: Implement preference normalization and ranking**

Support these version-1 kinds with strict field validation:

```js
const KINDS = new Set([
  "earliest_start", "latest_end", "avoid_day", "preferred_day",
  "light_day", "time_window_exception", "compact_schedule",
  "maximum_gap", "campus", "modality", "open_sections",
]);
```

Hard constraints eliminate schedules. Soft constraints contribute deterministic penalty points. Sort by total penalty, then `stableIndex`. When no hard match exists, calculate the smallest violated-hard-constraint set and return closest schedules as tradeoffs without relabeling them as matches.

- [ ] **Step 4: Run focused tests**

Run: `node --test worker/tests/schedule-preference-logic.test.mjs`<br>
Expected: PASS.

- [ ] **Step 5: Commit the engine**

```bash
git add schedule-preference-logic.js worker/tests/schedule-preference-logic.test.mjs
git commit -m "feat: rank schedules by student preferences"
```

---

### Task 4: Server-side OpenAI preference translator

**Dependencies:** Task 3 preference schema.

**Files:**
- Create: `worker/src/schedule-assistant.js`
- Modify: `worker/src/worker.js` near imports, CORS headers, and the main request router
- Create: `worker/schema/schema_ap_equivalencies.sql`
- Create: `worker/tests/schedule-assistant.test.mjs`
- Create: `worker/tests/ap-equivalencies.test.mjs`
- Modify: `worker/wrangler.toml` only to document `SCHEDULE_ASSISTANT_MODEL`; never add the key

**Interfaces:**
- Route: `POST /api/schedule-assistant/interpret`
- Route: `GET /api/config` returns `{ activeYear, activeTerm }` from Worker configuration.
- Route: `GET /api/ap-equivalencies` returns reviewed exam/score equivalencies from D1.
- Input: `{ messages: Array<{ role: "user"|"assistant", content: string }>, currentPreferences: PreferenceSetV1 }`
- Output: `{ preferencePatch, acknowledgement }`
- Environment: `OPENAI_API_KEY` secret; `SCHEDULE_ASSISTANT_MODEL` optional var defaulting to `gpt-5.6-luna`.

- [ ] **Step 1: Write request-validation and upstream-shape tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { handleScheduleAssistantRequest } from "../src/schedule-assistant.js";

const validRequest = new Request("https://x/api/schedule-assistant/interpret", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "No classes before 9" }],
    currentPreferences: { version: 1, constraints: [] },
  }),
});

test("rejects oversized or malformed assistant histories before calling OpenAI", async () => {
  const response = await handleScheduleAssistantRequest(new Request("https://x/api/schedule-assistant/interpret", {
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "system", content: "bad" }] }),
  }), { OPENAI_API_KEY: "test" }, async () => { throw new Error("must not call upstream"); });
  assert.equal(response.status, 400);
});

test("uses Luna structured output without sending transcript data", async () => {
  let upstreamBody;
  const response = await handleScheduleAssistantRequest(validRequest, { OPENAI_API_KEY: "test" }, async (_url, init) => {
    upstreamBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ output_text: JSON.stringify({ preferencePatch: { constraints: [] }, acknowledgement: "Got it." }) }), { status: 200 });
  });
  assert.equal(upstreamBody.model, "gpt-5.6-luna");
  assert.equal(upstreamBody.store, false);
  assert.equal(JSON.stringify(upstreamBody).includes("grade"), false);
  assert.equal(response.status, 200);
});
```

- [ ] **Step 2: Run the test and confirm module absence**

Run: `node --test worker/tests/schedule-assistant.test.mjs`<br>
Expected: FAIL on an explicit assertion that the request handler is not yet implemented; avoid treating an uncaught import error as the red test.

- [ ] **Step 3: Implement the Responses API adapter**

Use a lean system instruction and strict JSON schema:

```js
const body = {
  model: env.SCHEDULE_ASSISTANT_MODEL || "gpt-5.6-luna",
  reasoning: { effort: "low" },
  store: false,
  input: buildPreferencePrompt(messages, currentPreferences),
  text: {
    verbosity: "low",
    format: {
      type: "json_schema",
      name: "schedule_preference_patch",
      strict: true,
      schema: PREFERENCE_PATCH_SCHEMA,
    },
  },
};
```

POST to `https://api.openai.com/v1/responses` with `Authorization: Bearer ${env.OPENAI_API_KEY}`. Bound messages to 20, each content to 1,000 characters, and the complete JSON request to 20 KB. Return 503 when the secret is absent, 502 for upstream/schema failure, and never include upstream bodies or secrets in the client error.

- [ ] **Step 4: Route the endpoint and expand CORS only as required**

Import `handleScheduleAssistantRequest` in `worker/src/worker.js`. Route the exact pathname before the catalog fallback. Permit the `Authorization` header only if the browser actually needs it; the initial client must not send the OpenAI key.

- [ ] **Step 5: Move AP equivalencies and active-term configuration behind Worker APIs**

Create one reviewed, catalog-scoped AP-equivalency table rather than one file per exam:

```sql
CREATE TABLE IF NOT EXISTS ap_equivalencies (
  id TEXT PRIMARY KEY,
  exam_name TEXT NOT NULL,
  minimum_score INTEGER NOT NULL CHECK (minimum_score BETWEEN 1 AND 5),
  maximum_score INTEGER NOT NULL CHECK (maximum_score BETWEEN minimum_score AND 5),
  credits REAL NOT NULL CHECK (credits >= 0),
  equivalent_course_codes_json TEXT NOT NULL DEFAULT '[]',
  fulfills_requirement_ids_json TEXT NOT NULL DEFAULT '[]',
  catalog_year TEXT NOT NULL,
  campus TEXT NOT NULL DEFAULT 'NB',
  source_url TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('draft','reviewed','retired')),
  reviewed_at TEXT
);
```

Transcribe the current frontend AP rows into this single reviewed migration, preserving distinct score-4/score-5 outcomes. `GET /api/ap-equivalencies` returns only reviewed rows. `GET /api/config` returns validated `CURRENT_YEAR` and `CURRENT_TERM` so the frontend no longer hardcodes Fall 2026.

- [ ] **Step 6: Run focused and Worker tests**

Run: `node --test worker/tests/schedule-assistant.test.mjs worker/tests/ap-equivalencies.test.mjs worker/tests/course-eligibility-integration.test.mjs worker/tests/program-selection-policy.test.mjs`<br>
Expected: PASS.

- [ ] **Step 7: Commit the Worker adapter and reviewed configuration APIs**

```bash
git add worker/src/schedule-assistant.js worker/src/worker.js worker/schema/schema_ap_equivalencies.sql worker/tests/schedule-assistant.test.mjs worker/tests/ap-equivalencies.test.mjs worker/wrangler.toml
git commit -m "feat: serve planning configuration securely"
```

---

### Task 5: Integrate onboarding, program navigation, planner, and assistant UI

**Dependencies:** Tasks 1–4 merged.

**Files:**
- Modify: `index.html`
- Add script tags for: `planner-state-logic.js`, `four-year-planner-logic.js`, `schedule-preference-logic.js`
- Create: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- `ST` is loaded through `ScheduleRUPlannerStateLogic.migratePlannerState`.
- Four-year preview is stored at `ST.generatedPlanPreview` and accepted only through `withAcceptedPlan`.
- Builder permutations receive `stableIndex` once and retain it through ranking.
- Assistant calls only `/api/schedule-assistant/interpret`, then applies the returned patch through `ScheduleRUPreferenceLogic`.

- [ ] **Step 1: Add a focused source-integration test before modifying the page**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("hackathon UI wires the approved modules and removes hard-coded future builders", () => {
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /planner-state-logic\.js/);
  assert.match(html, /four-year-planner-logic\.js/);
  assert.match(html, /schedule-preference-logic\.js/);
  assert.doesNotMatch(html, /RUTGERSBUSINESS SCHOOL/);
  assert.doesNotMatch(html, /Degree Navigator/);
  assert.doesNotMatch(html, /const BACKEND_YEAR=/);
  assert.match(html, /Schedule assistant/);
  assert.match(html, /Issues/);
});
```

- [ ] **Step 2: Add the onboarding shell and local academic-record forms**

Add one accessible full-page onboarding container with seven steps from the spec. Load AP equivalencies from `/api/ap-equivalencies` and save academic records through state v3. Remove the frontend `AP` constant after the API-backed flow works. Provide Back, Continue, Skip where permitted, Review, Start planning, and Restart setup. File upload controls must either be absent or visibly labeled as a later feature; they must not pretend to parse a file.

- [ ] **Step 3: Make the header and Programs flow transactional**

Replace the current header text with `Rutgers` and the dynamic home-school display name only. Remove the selected-program title and `Degree Navigator` phrase. Preserve the previous accepted state until `/api/program-selection-check` and requirement loading succeed. Replace two-click warning acceptance with a dedicated confirmation dialog.

- [ ] **Step 4: Add Required program subtabs and centralized Issues**

Use each group’s existing `sourceProgramId` to filter the Required tree. Order primary major, secondary major, then other selected programs. Apply `.program-subtab-minor` only to minor roles. Replace the planning-notice wall with an `Issues · N` button, grouped dialog, and a short persistent planning-aid disclaimer.

- [ ] **Step 5: Add automatic plan preview and acceptance**

Add `Generate plan` near the four-year heading. When Core choices are incomplete, show `I understand` and `Go back`. State that existing courses remain locked. Normalize requirement courses/placeholders, call `generatePlan`, render a preview with issues, and change the accepted schedule only when `Use this plan` is clicked.

- [ ] **Step 6: Restrict the section builder to the active registration term**

Load active year/term from `/api/config`. Render the semester `+` only when the viewed term matches it. Remove `BACKEND_YEAR`/`BACKEND_TERM` and hydrate sections using the active values. Default checked sections to open sections; add an `Include closed sections` toggle.

- [ ] **Step 7: Add stable numeric navigation and assistant drawer**

Assign `stableIndex` before any ranking. Render the schedule number as a button/input with Enter, Escape, and range validation. The assistant drawer stores messages/preferences per active term, supports undo/clear, sends bounded history to the Worker, merges the patch, ranks locally, and formats no more than three clickable schedule-number recommendations. Impossible hard constraints render the engine’s conflict summary and ask which preference matters most.

- [ ] **Step 8: Replace affected native alerts/confirms and add dialog behavior**

Use one modal controller for onboarding confirmation, Programs warnings, incomplete Core, Issues, and planner preview. Add `role="dialog"`, `aria-modal="true"`, focus entry/restoration, Escape handling, and backdrop close only where safe. Convert affected `alert()` paths to inline errors or modal messages.

- [ ] **Step 9: Run focused UI-contract and existing integration tests**

Run: `node --test worker/tests/hackathon-ui-integration.test.mjs worker/tests/advisory-policy-ui.test.mjs worker/tests/course-selector-integration.test.mjs worker/tests/course-eligibility-integration.test.mjs`<br>
Expected: PASS.

- [ ] **Step 10: Commit the integrated experience**

```bash
git add index.html worker/tests/hackathon-ui-integration.test.mjs
git commit -m "feat: deliver guided planning experience"
```

---

### Task 6: Desktop visual polish and interaction QA

**Dependencies:** Task 5.

**Files:**
- Modify: `index.html` CSS and semantic markup
- Modify: `worker/tests/hackathon-ui-integration.test.mjs`

- [ ] **Step 1: Add assertions for the visual-system contracts**

Assert the presence of semantic dialog roles, program subtab classes, issue severity classes, assistant drawer, onboarding progress, and the absence of the title `Degree Gooner`.

- [ ] **Step 2: Apply the approved visual direction**

Keep Rutgers scarlet/charcoal, introduce warm neutral surfaces, consistent spacing/radii, restrained shadows, sentence-style requirement headers, clear focus rings, and a readable desktop grid. Red must not be used as the background for every requirement group or informational notice.

- [ ] **Step 3: Run a desktop browser walkthrough**

Verify at normal desktop width:

1. First visit → complete/skip onboarding → planner.
2. Restart onboarding without losing the accepted plan.
3. Change Programs once, confirm a warning, and see program subtabs.
4. Generate a plan with locked courses and incomplete Core placeholders.
5. Open the active-term builder, jump to a numeric schedule, and include/exclude closed sections.
6. Accumulate preferences, clear/undo them, click a recommendation, and observe an impossible-request tradeoff.

- [ ] **Step 4: Run the focused tests and commit polish**

Run: `node --test worker/tests/hackathon-ui-integration.test.mjs`<br>
Expected: PASS.

```bash
git add index.html worker/tests/hackathon-ui-integration.test.mjs
git commit -m "style: polish the desktop planning workflow"
```

---

### Task 7: README and repository hygiene

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`
- Review only: `CODEX_HANDOFF_FULL.md`, `SCHEDULERU_IMPLEMENTATION_ROADMAP.md`, registered worktrees/branches

- [ ] **Step 1: Replace the one-line README**

Include:

- product problem and demo workflow;
- key features and trustworthy-rule principles;
- architecture and repository layout;
- local static/Worker development commands;
- `node --test worker/tests/*.test.mjs` verification;
- dev versus production deployment safety;
- data provenance/review pipeline;
- a factual `Built with Codex and GPT-5.6` section explaining Terra implementation workers, Sol coordination/review, and Luna as the cost-sensitive runtime preference translator;
- current limitations: planning aid, reviewed-program coverage, local-only state, desktop target, no transcript parsing.

- [ ] **Step 2: Ignore generated Wrangler state safely**

Add only:

```gitignore
worker/.wrangler/
```

Do not delete the user’s current untracked directory in this task.

- [ ] **Step 3: Document cleanup findings without destructive branch deletion**

Do not delete worktrees or branches during parallel development. Record that `feature/program-requirement-importer` and `feature/sas-mathematics-major` are already merged, `feature/sas-catalog-requirement-fallback` remains one commit ahead, and `origin/cloudflare/workers-autoconfig` must not be merged wholesale.

- [ ] **Step 4: Verify and commit documentation**

Run: `git diff --check`<br>
Expected: no output and exit 0.

```bash
git add README.md .gitignore
git commit -m "docs: prepare ScheduleRU for hackathon review"
```

---

### Task 8: Integration, review, and release candidate

**Dependencies:** Tasks 1–7.

**Files:**
- Modify only when a verified integration defect requires it.

- [ ] **Step 1: Review merged scope and secret safety**

Run:

```bash
git status --short
git diff dev...HEAD --stat
git diff dev...HEAD -- . ':!docs/superpowers/plans/*' | rg -n 'OPENAI_API_KEY|ADMIN_SECRET|sk-[A-Za-z0-9]'
```

Expected: only intended files changed; secret scan returns no embedded value.

- [ ] **Step 2: Run the complete automated suite**

Run: `node --test worker/tests/*.test.mjs`<br>
Expected: all tests pass.

- [ ] **Step 3: Run repository verification**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors; only deliberate release-candidate changes.

- [ ] **Step 4: Complete the final desktop smoke walkthrough**

Repeat the six Task 6 scenarios using the development build. Confirm browser persistence after reload and inspect console errors.

- [ ] **Step 5: Obtain the API key without exposing it**

Do not ask the user to paste the key into source code or chat. Ask them to set it through the encrypted Worker-secret mechanism:

```bash
cd worker
npx wrangler secret put OPENAI_API_KEY --env dev
```

Keep `SCHEDULE_ASSISTANT_MODEL="gpt-5.6-luna"` as a non-secret dev variable only after the user approves the dev deployment.

- [ ] **Step 6: Present the release candidate for user approval**

Report implemented features, passing test count, known limitations, dev deployment status, and the exact commits. Do not merge to `main` or deploy production. Wait for explicit user approval.
