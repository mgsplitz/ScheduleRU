# ScheduleRU — full continuation handoff

**Prepared:** July 19, 2026
**Scope:** Rutgers–New Brunswick only
**Status:** a working RBS product plus a safe, deployed dev-only term-eligibility foundation. SAS has a reviewed pilot design but must not be made selectable until its source evidence is complete.

This document is written for a new Codex session that has the repository but does **not** have the conversation history. Read it before changing code, database data, or Cloudflare configuration.

## Immediate starting point

- Normal repository: `C:\Users\soham\ScheduleRU`
- Active isolated worktree: `C:\Users\soham\ScheduleRU\.worktrees\term-aware-eligibility`
- Active feature branch: `feature/term-aware-eligibility`
- Latest commit at handoff: `c6e0b58` (`Document SAS pilot design`)
- The normal `dev` branch is deliberately not merged with this feature work yet.
- Worktree was clean when this handoff was created. Re-check before beginning: `git status --short`.

Do not reset, discard, or overwrite unrelated user changes. Do not merge to `dev` or publish to production without explicit user authorization.

## User/product direction

ScheduleRU should become a focused, genuinely useful Rutgers planning app—not a bloated dashboard.

Current target:

- Rutgers–New Brunswick, with RBS working today and careful expansion to SAS next.
- One **Programs** flow where students select school, major(s), minor(s), concentration(s), or track(s), using each school’s correct terminology and policies.
- Keep every rule data-driven and source-provenanced. Never hard-code an unreviewed policy merely to make a UI look complete.
- Preserve simple, readable cards/modals and explain special policy decisions in plain language.
- The user wants eventual personal support for BAIT + Finance with an Applied Mathematics minor, and wants to explore Philosophy, Psychology/Sociology, and Physics. That is a useful future test case, not a reason to guess requirements now.

Longer-term, intentionally deferred:

- All Rutgers–New Brunswick schools and their cross-school policies.
- A flexible automatic eight-semester planner that builds on a student’s choices rather than forcing one path.
- Natural-language/AI schedule permutations and course recommendations.
- Accounts, saved plans across devices, AP/college transcript upload and manual entry.
- Expansion beyond Rutgers–New Brunswick.

Do **not** start automatic schedule generation just because the framework exists. It depends on accurate reviewed program and course-policy data across enough of the catalog.

## What already works

The existing app has substantial RBS functionality already built, including:

- RBS requirement groups, electives, pre-business/foundational/business-core views, degree-group choices, course details, and concise prerequisite/restriction display.
- A Rutgers Core view with requirement groups, dynamic selection/allocation behavior, AP/waiver treatment, and group-specific constraints.
- Wishlist and semester-plan cards that display course data rather than code-only rows, drag-and-drop scheduling, calendar/section selection, and persistence in the browser.
- A WebReg-inspired weekly section grid with course/section detail and campus location handling.
- Program selection and RBS double-count/advisory messaging. These are planning aids, not an official degree audit.

The user previously reported and the project addressed issues involving required/wishlist display, calendar overlap, Core grouping, modal overload, restrictions text, business-core duplication, and unclear double-count notices. Retest any of these when touching related logic; do not assume visual behavior from unit tests alone.

## Newly implemented: term-aware eligibility foundation

### Why it exists

Users must not schedule a course requiring a credit threshold in the same or a later term that creates those credits. Example: a 45-prior-credit course stays locked in sophomore fall if the student has only 44 credits at the end of freshman spring; it can become eligible in sophomore spring only if the qualifying credits were completed earlier.

AP/transfer/completed credits count as real completed credits for eligibility even when they do not satisfy a degree requirement. Planned and wishlist courses do not count as completed credits. This distinction is intentional.

### Code and commits

Feature commits, newest first:

```text
c6e0b58 Document SAS pilot design
cfc169c Correct dev preview bundle checklist
c151243 Apply term-aware eligibility in planner
f9c2639 Serve reviewed course eligibility data
0599d3b Add term-aware eligibility logic
dc23bcf Ignore local worktrees
d5aacda Plan term-aware eligibility implementation
d60a5a0 Document term-aware eligibility design
```

Key files:

- `eligibility-logic.js` — pure evaluator exposed as `globalThis.ScheduleRUEligibilityLogic`.
- `worker/tests/eligibility-logic.test.mjs` — ordering, AP/transfer, co-requisite, and exact 44/45 tests.
- `worker/schema/schema_course_eligibility_conditions.sql` — new review-gated D1 tables.
- `worker/tests/course-eligibility-integration.test.mjs` — Worker/public API tests.
- `worker/src/programs.js` — reviewed eligibility lookup and public `/api/course-eligibility` endpoint.
- `index.html` — planner drop validation, storage migration, and concise planner eligibility labels.
- `docs/superpowers/specs/2026-07-19-term-aware-eligibility-design.md`
- `docs/superpowers/plans/2026-07-19-term-aware-eligibility-implementation.md`

### Exact safety model

- Rule types: `prerequisite_course`, `corequisite_course`, `minimum_prior_credits`, `minimum_plan_year`.
- A rule must have `review_status: "reviewed"` to permit or block based on its conditions.
- A reviewed explicit `no_known_conditions: 1` means eligible with no known conditions.
- Missing, stale, malformed, or unreviewed rule data produces `needs_review`; it must **not** fabricate a restriction or eligibility claim.
- Same-term/future courses never satisfy a prerequisite or prior-credit threshold. Co-requisites alone may use the same term.
- A planned earlier course may satisfy a requirement only as a clear `planned_assumption`, never as completed credit.
- The planner only blocks a drop when a reviewed rule is known to fail. `needs_review` stays manually plannable with no false assurance.
- Requirement cards are not globally greyed solely by a term-specific credit gate: a card could be dropped in a later term where it is valid. The target-term drop validator is the correct enforcement point.

No course-specific reviewed eligibility rows were seeded. This is purposeful. The UI cannot demonstrate a live 45-credit block until a human-reviewed official source supports a specific rule.

### Tests

The full suite had most recently passed **58 tests, 0 failures**. Node may show `MODULE_TYPELESS_PACKAGE_JSON` warnings because the parent `C:\Users\soham\package.json` lacks `type: module`; do not modify that parent file just to silence a warning.

Run from the active worktree:

```powershell
node --test worker/tests/*.test.mjs
git diff --check
```

Run focused eligibility checks while iterating:

```powershell
node --test worker/tests/eligibility-logic.test.mjs worker/tests/course-eligibility-integration.test.mjs
```

## Development deployment currently live

These are development-only, safe for testing:

- Dev Pages: `https://dev.scheduleru-9fb.pages.dev`
- Dev Worker: `https://rutgers-course-sync-dev.housselllaura.workers.dev`
- Dev D1 database: `rutgers_courses_dev` (`566147eb-e368-4293-a65a-41429e44a3cf`)
- Current deployed Worker version: `26aae339-6e1f-4e35-b026-60fdb8dece71`

The dev D1 database has the two new empty tables:

- `course_eligibility_reviews`
- `course_eligibility_conditions`

They are empty on purpose. Public dev verification at handoff returned:

```text
GET /api/course-eligibility?codes=01:198:111
{"eligibility":{}}
```

The dev Pages smoke check returned HTTP 200 and confirmed both planner version/migration and eligibility logic are present. A visual browser click-through was not run in the prior environment because no browser session was available; do that before a production request.

### Safe dev deployment recipe

1. Run the full test suite first.
2. Deploy only the dev Worker, preserving existing secrets:

```powershell
Set-Location worker
npx.cmd wrangler deploy --env dev --keep-vars
```

3. Apply schema only to dev D1 when needed:

```powershell
npx.cmd wrangler d1 execute rutgers_courses_dev --env dev --remote --file=schema/schema_course_eligibility_conditions.sql
```

4. Deploy a deliberately minimal public Pages bundle. The only public files are:

```text
index.html
requirement-group-logic.js
course-selector-logic.js
eligibility-logic.js
```

Create a temporary directory with `New-Item -ItemType Directory -Path ...` (do not use `-LiteralPath` with `New-Item` in this PowerShell), copy exactly those four files, validate the contents, then run:

```powershell
npx.cmd wrangler pages deploy <temporary-public-directory> --project-name scheduleru --branch dev
```

5. Remove only the exact, verified temporary directory after deployment.

Never deploy `.pages-preview`, Worker configuration, source-only files, or any secret file as Pages content.

### Secrets and production safety

- Never read, print, rotate, or replace the existing admin secret. The user explicitly asked that it remain unchanged.
- Do not inspect or commit `worker/admin-secret.txt`.
- Always use `--keep-vars` for Worker deploys so secrets are retained.
- Production Worker, production D1, production Pages, and production secrets were **not** touched by this feature work.
- A dev deployment is not permission to publish production. Ask explicitly before production deploy.

## SAS expansion: approved design, not yet implemented

Read these two documents first:

- `docs/superpowers/specs/2026-07-19-sas-pilot-design.md`
- `SAS_PILOT_SOURCE_INVENTORY.md`

The intended safe pilot is:

- School: SAS, Rutgers–New Brunswick.
- Programs: Political Science BA (code 790) and Philosophy, Politics & Economics minor (code 792).
- Cross-school case: an RBS + SAS selection should be shown as `requires_approval` advisory until the exact policy is verified for the selected program.
- No SAS concentration, track, or certificate should be visible in the first pilot.
- Keep the existing single Programs modal; use correct SAS wording (`Major`, `Minor`). Do not create a separate bloated SAS page.

### Evidence already reviewed

- Political Science department current page:
  `https://polisci.rutgers.edu/academics/undergraduate/major-in-political-science`
- Political Science current PDF:
  `https://polisci.rutgers.edu/images/ACCESSIBLE_CC_Edits_BA_MAJOR_rvsd_JUN2026.pdf`
- PPE minor:
  `https://philosophy.rutgers.edu/minor-in-philosophy-politics-and-economics`
- SAS degree/minor policies:
  `https://sasundergrad.rutgers.edu/majors-and-core-curriculum/degree-requirements`
  `https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/completion-of-a-major-and-a-minor`
  `https://www.sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-restrictions`
- RBS policies:
  `https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/policies-procedures`

### Critical Political Science blocker

The reviewed current official material confirms Political Science BA structure—39 credits/13 courses, foundations, research, three in-depth areas, seminar, and elective/upper-level constraints—but it does **not** provide an official current course-to-area membership table for Political Philosophy, American Institutions and Politics, and International/Comparative Politics.

Do **not** infer those memberships from titles, historic catalogs, or search results. Political Science must remain hidden/unselectable until a current official mapping is obtained and stored with provenance.

PPE is more finite and can be prepared first, but still requires reviewed provenance and a careful model for cross-listed courses, per-field limits, and grade/residency advisories.

## Next implementation order

The new exact plan is at `docs/superpowers/plans/2026-07-19-sas-pilot-implementation.md`.

Follow its order:

1. Add reusable reviewed credit-count requirement groups with tests.
2. Add generic exclusive allocation families, so one cross-listed course cannot quietly satisfy multiple non-double-countable groups. Allocation must be deterministic and explainable.
3. Add structured advisory-only messages for grade, residency, transfer, and approval rules. Never turn an advising caveat into a false pass/fail audit.
4. Populate only evidence-complete reviewed program data. PPE may be possible; Political Science is gated by the blocker above.
5. Human-review data, test, then deploy dev only. Do not publish production until the user has tested it.

This foundation is more important than a quick UI: it avoids later per-school hard-coding and supports Core, minors, double-count policies, and future cross-school rules consistently.

## Policy / terminology decisions already made

- `Concentration` and `track` are school/program-specific labels. The UI should not assume every program uses either one.
- Program availability may depend on school enrollment or major selection. Represent that as reviewed data/advisory, not a guessed global cap.
- Do not assume a universal number of majors/minors/concentrations. Check each school/program’s current policy before adding selection limits.
- Rutgers–New Brunswick only means do not include Newark/Camden alternatives unless an official NB policy explicitly treats them as eligible and the user later approves it.
- Cross-school double-counting/second-major policies are highly program-specific. Explain planning impact in plain language; label unresolved rules as advising review.
- AP and transfer credit can be real earned credit for eligibility but may not satisfy an individual degree requirement. Preserve the distinction in future student-record work.

## Recommended future work after SAS pilot

1. Build source/provenance review tooling or a repeatable import workflow before importing many schools.
2. Add the remaining SAS programs only in reviewed batches, then other Rutgers–New Brunswick schools.
3. Add a student academic-record model (manual/AP/transfer/Rutgers completed courses) before uploads/accounts.
4. Revisit accounts and cross-device persistence when the data model is stable.
5. Design the eight-semester assistant only after the required program/eligibility data supports it. It should offer multiple explainable schedules, honor locked user choices, allow summer/online preferences, honors requirements, and show tradeoffs—not force a single schedule.
6. Later add AI as a constrained assistant over verified course/section data, never as the source of official rules. It can translate requests such as “avoid early mornings” into filters and explain schedule tradeoffs.

## Working conventions for the next session

- Start with a short user-facing progress update, then inspect the active worktree and read the design/plan/source inventory.
- Use `rg` first when finding code.
- Before changing behavior, write/extend focused tests. Keep rule evaluation pure where possible.
- Use `apply_patch` for edits. Preserve unrelated dirty work.
- Prefer dev deployments only; do not touch production or secrets without explicit authority.
- After any meaningful change, run targeted tests; before reporting completion, run the full suite and `git diff --check`.
- Commit coherent units with clear messages. Do not use `git reset --hard` or destructive checkout commands.
- If a current official source is unavailable or ambiguous, log the source gap and stop that data import rather than guessing.

## Suggested first commands

From the active worktree:

```powershell
git status --short
git branch --show-current
git log --oneline -10
node --test worker/tests/*.test.mjs
git diff --check
```

Then read:

```text
CODEX_HANDOFF_FULL.md
docs/superpowers/specs/2026-07-19-sas-pilot-design.md
docs/superpowers/plans/2026-07-19-sas-pilot-implementation.md
SAS_PILOT_SOURCE_INVENTORY.md
SCHEDULERU_IMPLEMENTATION_ROADMAP.md
```

## Handoff checklist

- [x] Term-aware eligibility implementation committed on the feature branch.
- [x] Term-aware eligibility dev Worker/Pages deployment completed; development D1 schema applied.
- [x] Dev database intentionally has no fabricated course eligibility rows.
- [x] SAS pilot design and safe implementation plan are documented.
- [x] Production and existing admin secret left untouched.
- [ ] Obtain an official current Political Science in-depth-area course mapping.
- [ ] Implement generic reviewed credit-count/allocation/advisory foundations.
- [ ] Import only fully reviewed SAS pilot data, test in dev, and obtain user approval before production.
