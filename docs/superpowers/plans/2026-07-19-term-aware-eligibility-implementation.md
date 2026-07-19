# Term-Aware Eligibility Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a source-reviewed, term-aware eligibility engine that distinguishes confirmed eligibility from later-plan assumptions without changing degree-requirement allocation.

**Architecture:** A pure browser module owns term order, credit evidence, rule validation, and structured results. The Worker returns only reviewed D1 facts. The page derives AP/completion credit separately from scheduled credit and evaluates the precise target semester at course placement.

**Tech Stack:** Plain browser JavaScript, Node built-in test runner, Cloudflare Worker, Cloudflare D1, Wrangler.

## Global Constraints

- Scope is reviewed Rutgers-New Brunswick undergraduate data only.
- Same-term and later-term courses never unlock a prerequisite or credit threshold.
- AP, transfer, and completed credit can unlock eligibility without satisfying a degree requirement.
- Raw catalog wording and private Degree Navigator data never create automatic rules.
- Unknown, malformed, stale, or unreviewed facts return needs_review, never eligible_now.
- Preserve planner-state-v1 data through browser-state migration.
- Do not expose SAS data in this implementation slice.
- Deploy development only and retain encrypted variables with --keep-vars.

---

## Task 1: Create pure eligibility logic

**Files:**
- Create: eligibility-logic.js
- Create: worker/tests/eligibility-logic.test.mjs

**Interfaces:**
- Produces globalThis.ScheduleRUEligibilityLogic.
- Public functions: termOrdinal(term), normalizeReview(value), normalizeCondition(value), confirmedCreditEntries(entries), plannedCreditEntriesBefore(targetTerm, entries), and evaluateEligibility(input).
- evaluateEligibility returns { status, satisfied, missing, assumptions, creditTotals }; status is eligible_now, planned_assumption, blocked, or needs_review.

- [ ] **Step 1: Write failing term-order and credit-gate tests**

Create worker/tests/eligibility-logic.test.mjs:

~~~
import assert from "node:assert/strict";
import test from "node:test";

await import("../../eligibility-logic.js");
const logic = globalThis.ScheduleRUEligibilityLogic;
const review = { course_code: "01:999:450", review_status: "reviewed", no_known_conditions: 0 };
const creditGate = {
  condition_type: "minimum_prior_credits",
  condition_value_json: JSON.stringify({ minimum_credits: 45 }),
  review_status: "reviewed",
};

test("term ordering accepts only fall and spring planner terms", () => {
  assert.equal(logic.termOrdinal({ year: 1, sem: "fall" }), 0);
  assert.equal(logic.termOrdinal({ year: 1, sem: "spring" }), 1);
  assert.equal(logic.termOrdinal({ year: 2, sem: "fall" }), 2);
  assert.equal(logic.termOrdinal({ year: 0, sem: "fall" }), null);
  assert.equal(logic.termOrdinal({ year: 1, sem: "summer" }), null);
});

test("44 confirmed credits do not meet a reviewed 45-credit gate", () => {
  const result = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "current", review, conditions: [creditGate],
    confirmedEntries: [{ id: "ap:one", source: "ap", credits: 44 }], scheduledEntries: [],
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.missing[0].type, "minimum_prior_credits");
  assert.equal(result.creditTotals.confirmed, 44);
});

test("45 accepted AP and transfer credits meet a reviewed gate", () => {
  const result = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "current", review, conditions: [creditGate],
    confirmedEntries: [
      { id: "ap:physics", source: "ap", credits: 20 },
      { id: "transfer:calc", source: "transfer", credits: 25 },
    ], scheduledEntries: [],
  });
  assert.equal(result.status, "eligible_now");
  assert.equal(result.creditTotals.confirmed, 45);
});
~~~

- [ ] **Step 2: Run the focused test and observe the missing-module failure**

Run: node --test worker/tests/eligibility-logic.test.mjs

Expected: an import error because eligibility-logic.js does not exist.

- [ ] **Step 3: Implement the minimal shared evaluator**

Create eligibility-logic.js:

~~~
(function exposeEligibilityLogic(root) {
  const COURSE_CODE = /^\d{2}:\d{3}:\d{3}$/;
  const SOURCES = new Set(["ap", "transfer", "rutgers_completed", "manual_reviewed"]);
  const TYPES = new Set(["prerequisite_course", "corequisite_course", "minimum_prior_credits", "minimum_plan_year"]);

  function termOrdinal(term) {
    const year = Number(term && term.year);
    const sem = String((term && term.sem) || "").toLowerCase();
    if (!Number.isInteger(year) || year < 1 || (sem !== "fall" && sem !== "spring")) return null;
    return (year - 1) * 2 + (sem === "fall" ? 0 : 1);
  }

  function normalizeReview(value) {
    if (!value || value.review_status !== "reviewed" || !COURSE_CODE.test(String(value.course_code || ""))) return null;
    return { course_code: value.course_code, review_status: "reviewed", no_known_conditions: Number(value.no_known_conditions) === 1 };
  }

  function normalizeCondition(value) {
    if (!value || value.review_status !== "reviewed" || !TYPES.has(value.condition_type)) return null;
    let data;
    try { data = typeof value.condition_value_json === "string" ? JSON.parse(value.condition_value_json) : value.condition_value_json; } catch { return null; }
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    if (value.condition_type === "minimum_prior_credits") {
      const minimum = Number(data.minimum_credits);
      return Number.isFinite(minimum) && minimum >= 0 ? { type: value.condition_type, minimum_credits: minimum } : null;
    }
    if (value.condition_type === "minimum_plan_year") {
      const minimum = Number(data.minimum_year);
      return Number.isInteger(minimum) && minimum >= 1 && minimum <= 8 ? { type: value.condition_type, minimum_year: minimum } : null;
    }
    const codes = [...new Set((Array.isArray(data.any_of_course_codes) ? data.any_of_course_codes : [])
      .filter((code) => COURSE_CODE.test(String(code))))];
    return codes.length ? { type: value.condition_type, any_of_course_codes: codes } : null;
  }

  function confirmedCreditEntries(entries) {
    const seen = new Set();
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
      const id = String((entry && entry.id) || "");
      const credits = Number(entry && entry.credits);
      if (!id || seen.has(id) || !SOURCES.has(entry && entry.source) || !Number.isFinite(credits) || credits < 0) return false;
      seen.add(id); return true;
    }).map((entry) => ({ ...entry, credits: Number(entry.credits), course_code: String(entry.course_code || "") }));
  }

  function plannedCreditEntriesBefore(targetTerm, entries) {
    const target = termOrdinal(targetTerm);
    if (target === null) return [];
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
      const ordinal = termOrdinal(entry);
      return ordinal !== null && ordinal < target;
    });
  }

  function evaluateEligibility(input) {
    const review = normalizeReview(input && input.review);
    const target = termOrdinal(input && input.targetTerm);
    const conditions = (Array.isArray(input && input.conditions) ? input.conditions : []).map(normalizeCondition);
    if (!review || target === null || conditions.some((condition) => !condition) || (review.no_known_conditions && conditions.length) || (!review.no_known_conditions && !conditions.length)) {
      return { status: "needs_review", satisfied: [], missing: [], assumptions: [], creditTotals: { confirmed: 0, planned: 0 } };
    }
    const confirmed = confirmedCreditEntries(input.confirmedEntries);
    const planned = input.mode === "plan" ? plannedCreditEntriesBefore(input.targetTerm, input.scheduledEntries) : [];
    const evidence = confirmed.concat(planned);
    const confirmedCredits = confirmed.reduce((total, entry) => total + entry.credits, 0);
    const plannedCredits = planned.reduce((total, entry) => total + Number(entry.credits || 0), 0);
    const satisfied = [], missing = [], assumptions = [];
    for (const condition of conditions) {
      if (condition.type === "minimum_prior_credits") {
        const available = confirmedCredits + plannedCredits;
        if (available < condition.minimum_credits) missing.push({ type: condition.type, minimum_credits: condition.minimum_credits, available_credits: available });
        else { satisfied.push(condition); if (confirmedCredits < condition.minimum_credits) assumptions.push(condition); }
      } else if (condition.type === "minimum_plan_year") {
        if (input.targetTerm.year < condition.minimum_year) missing.push(condition); else satisfied.push(condition);
      } else {
        const match = evidence.find((entry) => condition.any_of_course_codes.includes(entry.course_code));
        if (!match) missing.push(condition);
        else { satisfied.push(condition); if (planned.includes(match)) assumptions.push(condition); }
      }
    }
    return { status: missing.length ? "blocked" : assumptions.length ? "planned_assumption" : "eligible_now", satisfied, missing, assumptions, creditTotals: { confirmed: confirmedCredits, planned: plannedCredits } };
  }

  root.ScheduleRUEligibilityLogic = { termOrdinal, normalizeReview, normalizeCondition, confirmedCreditEntries, plannedCreditEntriesBefore, evaluateEligibility };
})(globalThis);
~~~

- [ ] **Step 4: Add sequential, wishlist, co-requisite, and fail-safe tests**

Append these test cases to worker/tests/eligibility-logic.test.mjs:

~~~
test("same-term planned credit cannot unlock a course, but earlier planned credit can", () => {
  const scheduled = [{ id: "scheduled:calc", course_code: "01:640:250", credits: 15, year: 2, sem: "fall" }];
  const sameTerm = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "plan", review, conditions: [creditGate],
    confirmedEntries: [{ id: "ap", source: "ap", credits: 30 }], scheduledEntries: scheduled,
  });
  const laterTerm = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "spring" }, mode: "plan", review, conditions: [creditGate],
    confirmedEntries: [{ id: "ap", source: "ap", credits: 30 }], scheduledEntries: scheduled,
  });
  assert.equal(sameTerm.status, "blocked");
  assert.equal(laterTerm.status, "planned_assumption");
});

test("wishlist-shaped records do not add credit", () => {
  const result = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "current", review, conditions: [creditGate],
    confirmedEntries: [{ id: "wishlist:course", source: "wishlist", credits: 100 }], scheduledEntries: [],
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.creditTotals.confirmed, 0);
});

test("unreviewed records fail closed to needs review", () => {
  const result = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "current",
    review: { ...review, review_status: "draft" }, conditions: [], confirmedEntries: [], scheduledEntries: [],
  });
  assert.equal(result.status, "needs_review");
});

test("an explicit reviewed no-condition marker is eligible", () => {
  const result = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "current",
    review: { ...review, no_known_conditions: 1 }, conditions: [], confirmedEntries: [], scheduledEntries: [],
  });
  assert.equal(result.status, "eligible_now");
});
~~~

Replace the final generic condition branch in evaluateEligibility with this explicit prerequisite/co-requisite behavior:

~~~
      } else if (condition.type === "corequisite_course") {
        const sameTerm = (Array.isArray(input.scheduledEntries) ? input.scheduledEntries : [])
          .filter((entry) => termOrdinal(entry) === target);
        const match = evidence.concat(sameTerm).find((entry) => condition.any_of_course_codes.includes(entry.course_code));
        if (!match) missing.push(condition);
        else satisfied.push(condition);
      } else {
        const match = evidence.find((entry) => condition.any_of_course_codes.includes(entry.course_code));
        if (!match) missing.push(condition);
        else { satisfied.push(condition); if (planned.includes(match)) assumptions.push(condition); }
      }
~~~

- [ ] **Step 5: Run focused tests and commit**

Run: node --test worker/tests/eligibility-logic.test.mjs

Expected: every eligibility test passes.

~~~
git add eligibility-logic.js worker/tests/eligibility-logic.test.mjs
git commit -m "Add term-aware eligibility logic"
~~~

## Task 2: Store and serve only reviewed course eligibility data

**Files:**
- Create: worker/schema/schema_course_eligibility_conditions.sql
- Modify: worker/src/programs.js
- Create: worker/tests/course-eligibility-integration.test.mjs

**Interfaces:**
- Produces getReviewedCourseEligibility(env, courseCodes).
- Requirement course rows gain eligibility: { review, conditions } or null.
- Produces GET /api/course-eligibility?codes=01:198:111,01:640:250, restricted to 25 valid codes.

- [ ] **Step 1: Write the failing Worker/schema integration test**

Create worker/tests/course-eligibility-integration.test.mjs:

~~~
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(new URL("../schema/schema_course_eligibility_conditions.sql", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/programs.js", import.meta.url), "utf8");

test("eligibility facts are source-backed and review-gated", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS course_eligibility_reviews/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS course_eligibility_conditions/);
  assert.match(schema, /CHECK \(review_status IN \('draft','reviewed','stale'\)\)/);
  assert.match(worker, /async function getReviewedCourseEligibility/);
  assert.match(worker, /WHERE review_status = 'reviewed'/);
  assert.match(worker, /path === "\/api\/course-eligibility"/);
});
~~~

- [ ] **Step 2: Run the test and observe failure**

Run: node --test worker/tests/course-eligibility-integration.test.mjs

Expected: failure because the new schema, Worker helper, route, and browser script are absent.

- [ ] **Step 3: Create review-gated D1 tables**

Create worker/schema/schema_course_eligibility_conditions.sql:

~~~
CREATE TABLE IF NOT EXISTS course_eligibility_reviews (
  course_code TEXT PRIMARY KEY,
  campus_slug TEXT NOT NULL,
  catalog_year TEXT,
  review_status TEXT NOT NULL CHECK (review_status IN ('draft','reviewed','stale')),
  no_known_conditions INTEGER NOT NULL DEFAULT 0 CHECK (no_known_conditions IN (0,1)),
  source_url TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_date TEXT,
  reviewed_at INTEGER,
  note TEXT
);

CREATE TABLE IF NOT EXISTS course_eligibility_conditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL REFERENCES course_eligibility_reviews(course_code),
  condition_key TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('prerequisite_course','corequisite_course','minimum_prior_credits','minimum_plan_year')),
  condition_value_json TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('draft','reviewed','stale')),
  source_url TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_date TEXT,
  reviewed_at INTEGER,
  UNIQUE(course_code, condition_key)
);
CREATE INDEX IF NOT EXISTS idx_course_eligibility_conditions_course ON course_eligibility_conditions(course_code, review_status);
~~~

- [ ] **Step 4: Add Worker lookup, requirement attachment, and bounded route**

Add before getRequirementTree in worker/src/programs.js:

~~~
const COURSE_ELIGIBILITY_CODE = /^\d{2}:\d{3}:\d{3}$/;
function reviewedCourseCodes(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim())
    .filter((code) => COURSE_ELIGIBILITY_CODE.test(code)))];
}
async function getReviewedCourseEligibility(env, rawCodes) {
  const codes = reviewedCourseCodes(rawCodes);
  if (!codes.length || codes.length > 250) return {};
  const placeholders = codes.map(() => "?").join(",");
  const [reviews, conditions] = await env.DB.batch([
    env.DB.prepare("SELECT course_code, review_status, no_known_conditions, source_url, source_label, source_date FROM course_eligibility_reviews WHERE review_status = 'reviewed' AND course_code IN (" + placeholders + ")").bind(...codes),
    env.DB.prepare("SELECT course_code, condition_key, condition_type, condition_value_json, review_status, source_url, source_label, source_date FROM course_eligibility_conditions WHERE review_status = 'reviewed' AND course_code IN (" + placeholders + ") ORDER BY course_code, condition_key").bind(...codes),
  ]);
  const output = {};
  for (const row of reviews.results || []) output[row.course_code] = { review: row, conditions: [] };
  for (const row of conditions.results || []) if (output[row.course_code]) output[row.course_code].conditions.push(row);
  return output;
}
~~~

In getRequirementTree, fetch reviewed eligibility using the selected course codes after the course query. Before adding a course to byGroup, set c.eligibility = eligibilityByCode[c.course_code] || null.

Before the admin-route block, add:

~~~
if (path === "/api/course-eligibility" && request.method === "GET") {
  const codes = reviewedCourseCodes((url.searchParams.get("codes") || "").split(","));
  if (!codes.length || codes.length > 25) return json({ error: "pass up to 25 valid course codes in ?codes=" }, 400);
  return json({ eligibility: await getReviewedCourseEligibility(env, codes) });
}
~~~

- [ ] **Step 5: Run the test and commit**

Run: node --test worker/tests/course-eligibility-integration.test.mjs

Expected: every assertion passes.

~~~
git add worker/schema/schema_course_eligibility_conditions.sql worker/src/programs.js worker/tests/course-eligibility-integration.test.mjs
git commit -m "Serve reviewed course eligibility data"
~~~

## Task 3: Integrate credit evidence and target-term placement

**Files:**
- Modify: index.html
- Modify: worker/tests/course-eligibility-integration.test.mjs

**Interfaces:**
- Adds ST.creditLedger and ST.courseEligibilityByCode.
- Adds confirmedAcademicCreditEntries(), plannedScheduleCreditEntries(), courseEligibilityForTerm(course, term), and plannerEligibilityLabel(result).
- Evaluates the chosen Fall or Spring target immediately before placement.

- [ ] **Step 1: Extend the failing integration test**

Append:

~~~
test("the browser migrates v1 state and evaluates the selected target term", () => {
  const frontend = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(frontend, /const PLANNER_STATE_VERSION=2/);
  assert.match(frontend, /\[1,PLANNER_STATE_VERSION\]\.includes\(saved\.version\)/);
  assert.match(frontend, /creditLedger:savedObject\(saved\.creditLedger\)/);
  assert.match(frontend, /function confirmedAcademicCreditEntries\(/);
  assert.match(frontend, /function plannedScheduleCreditEntries\(/);
  assert.match(frontend, /function courseEligibilityForTerm\(/);
  assert.match(frontend, /targetTerm:\{year:ST\.year,sem\}/);
});
~~~

- [ ] **Step 2: Run test and observe failure**

Run: node --test worker/tests/course-eligibility-integration.test.mjs

Expected: failure because state is version 1 and target-term helpers do not exist.

- [ ] **Step 3: Load logic and migrate state without altering requirement allocation**

Add after course-selector-logic.js:

~~~
<script src="eligibility-logic.js"></script>
~~~

Set:

~~~
const PLANNER_STATE_KEY="scheduleru_planner_state_v1";
const PLANNER_STATE_VERSION=2;
~~~

Add creditLedger:{} and courseEligibilityByCode:{} to ST. In restorePlannerState:

~~~
if(!saved || ![1,PLANNER_STATE_VERSION].includes(saved.version)) return;
ST.creditLedger=savedObject(saved.creditLedger);
~~~

In savePlannerState, write version:PLANNER_STATE_VERSION and creditLedger:ST.creditLedger. Do not modify isCompleted, Core allocation, or group allocation.

- [ ] **Step 4: Derive confirmed and planned evidence separately**

Add after AP initialization:

~~~
function creditNumber(value){
  const match=String(value??"").match(/\d+(?:\.\d+)?/);
  const number=Number(match?.[0]);
  return Number.isFinite(number)&&number>=0?number:0;
}
function confirmedAcademicCreditEntries(){
  const entries=[];
  AP.filter((ap)=>ST.apOn[ap.id]).forEach((ap)=>entries.push({
    id:"ap:"+ap.id, source:"ap", credits:creditNumber(ap.credits),
    course_code:courseCodesFromText(ap.equiv)[0]||"",
  }));
  Object.entries(ST.completed||{}).forEach(([id,taken])=>{
    if(!taken) return;
    const course=courseRecordFromId(id);
    if(course) entries.push({ id:"completed:"+id, source:"rutgers_completed", credits:creditNumber(course.credits), course_code:course.code });
  });
  Object.values(ST.creditLedger||{}).forEach((entry)=>entries.push(entry));
  return globalThis.ScheduleRUEligibilityLogic.confirmedCreditEntries(entries);
}
function plannedScheduleCreditEntries(){
  return Object.values(ST.schedule||{}).map((entry)=>({
    id:"scheduled:"+entry.code, course_code:entry.code, credits:creditNumber(entry.credits),
    year:Number(entry.year), sem:entry.sem,
  }));
}
function courseEligibilityForTerm(course,term){
  const payload=course?.eligibility||ST.courseEligibilityByCode?.[course?.code]||null;
  return globalThis.ScheduleRUEligibilityLogic.evaluateEligibility({
    targetTerm:term, mode:"plan", review:payload?.review, conditions:payload?.conditions||[],
    confirmedEntries:confirmedAcademicCreditEntries(), scheduledEntries:plannedScheduleCreditEntries(),
  });
}
function plannerEligibilityLabel(result){
  if(result.status==="eligible_now") return "Eligible based on completed credit and reviewed rules";
  if(result.status==="planned_assumption") return "Works in this plan if earlier planned courses are completed";
  if(result.status==="blocked"&&result.missing[0]?.type==="minimum_prior_credits") return "Requires "+result.missing[0].minimum_credits+" previously completed credits";
  if(result.status==="blocked") return "A reviewed prerequisite must be completed first";
  return "Eligibility needs review; verify with Rutgers before registration";
}
~~~

When hydrating a requirement row, preserve row.eligibility||existing?.eligibility||null. Add this exact catalog helper:

~~~
async function loadCourseEligibilityForCodes(codes){
  const unique=[...new Set((codes||[]).filter((code)=>/^\d{2}:\d{3}:\d{3}$/.test(code)))].slice(0,25);
  if(!unique.length) return;
  try{
    const response=await backendFetch("/api/course-eligibility?codes="+encodeURIComponent(unique.join(",")));
    Object.assign(ST.courseEligibilityByCode,response.eligibility||{});
  }catch(_){
    // Absent or unreachable reviewed data stays a neutral needs_review result.
  }
}
~~~

In loadBackendCourses, immediately after ST.backendCourses = d.courses||[], run:

~~~
await loadCourseEligibilityForCodes(ST.backendCourses.map(catalogCourseCode));
~~~

Catalog-only cards read ST.courseEligibilityByCode through courseEligibilityForTerm. Missing data remains needs_review.

- [ ] **Step 5: Enforce only known blocks at the exact drop target**

Immediately before writing ST.schedule[code] in the drop handler:

~~~
const course=courseRecordFromId(id);
const result=courseEligibilityForTerm(course,{year:ST.year,sem});
if(result.status==="blocked"){
  window.alert(course.code+" cannot be placed in "+sem+" of "+YL[ST.year]+": "+plannerEligibilityLabel(result)+".");
  return;
}
~~~

For planned_assumption, allow the drop and persist eligibilityStatus plus eligibilityAssumptions. For needs_review, allow manual planning but persist eligibilityStatus:"needs_review"; show the neutral warning and never call the course eligible.

Replace the main details-modal availability sentence with a concise Planning eligibility section based on courseEligibilityForTerm(c,{year:ST.year,sem:"fall"}). Preserve raw catalog wording in the existing collapsed Official catalog details section. Show brief card copy only for blocked, planned_assumption, or needs_review; preserve green completion state and do not disable a card solely because its eligibility is unreviewed.

- [ ] **Step 6: Run focused tests and commit**

Run: node --test worker/tests/eligibility-logic.test.mjs worker/tests/course-eligibility-integration.test.mjs

Expected: every focused test passes.

~~~
git add index.html worker/tests/course-eligibility-integration.test.mjs
git commit -m "Apply term-aware eligibility in planner"
~~~

## Task 4: Verify locally and deploy development only

**Files:**
- Modify only if verification identifies a Task 1-3 defect.

- [ ] **Step 1: Run the full regression suite**

Run: node --test worker/tests/*.test.mjs

Expected: every test passes. Node module-type warnings are acceptable only if no test fails.

- [ ] **Step 2: Apply the new schema only to development D1**

~~~
Push-Location worker
npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote --file=schema/schema_course_eligibility_conditions.sql
npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('course_eligibility_reviews','course_eligibility_conditions') ORDER BY name"
Pop-Location
~~~

Expected: both table names appear. Never run this against production D1.

- [ ] **Step 3: Deploy only the development Worker and retain secrets**

~~~
Push-Location worker
npx.cmd wrangler deploy --env dev --keep-vars
Pop-Location
~~~

Expected: output names rutgers-course-sync-dev. Do not run a production Worker deploy.

- [ ] **Step 4: Deploy a public-only development Pages bundle**

Create and verify a unique temporary public-only folder, deploy it, then remove that exact folder:

~~~
$previewDir=Join-Path ([IO.Path]::GetTempPath()) ("scheduleru-public-"+[guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -LiteralPath $previewDir | Out-Null
$publicFiles=@("index.html","requirement-group-logic.js","course-selector-logic.js","eligibility-logic.js","_headers")
foreach($file in $publicFiles){ Copy-Item -LiteralPath (Join-Path $PWD $file) -Destination (Join-Path $previewDir $file) }
$actualFiles=@(Get-ChildItem -LiteralPath $previewDir -File | ForEach-Object Name | Sort-Object)
if((Compare-Object $publicFiles $actualFiles)){ throw "Preview bundle contains an unexpected file or is missing a required public file." }
npx.cmd wrangler pages deploy $previewDir --project-name scheduleru --branch dev
Remove-Item -LiteralPath $previewDir -Recurse -Force
~~~

Expected: the deployment is attached to https://dev.scheduleru-9fb.pages.dev. Delete only that verified temporary folder afterward. Never include .pages-preview, secrets, or Worker configuration.

- [ ] **Step 5: Smoke-test development behavior**

1. Confirm the dev page loads eligibility-logic.js.
2. Restore a v1 local-state fixture and confirm AP, completed, wishlist, schedule, group choices, year, home school, and selected programs survive.
3. Confirm 44 credits cannot place a reviewed 45-credit course in the same term.
4. Confirm earlier planned credits make a later term planned_assumption.
5. Confirm existing RBS requirements still apply scheduled/completed courses as before.
6. Confirm neither production Pages nor the production Worker changed.

## Next cycle

After this foundation passes development checks, begin the SAS public-source pilot for Political Science B.A. (790), PPE minor (792), and one reviewed cross-school combination. It must pass source and comparison-case review before SAS becomes selectable. Bulk import of SAS majors, minors, and concentrations follows the proven pilot workflow and is not part of this foundation change.
